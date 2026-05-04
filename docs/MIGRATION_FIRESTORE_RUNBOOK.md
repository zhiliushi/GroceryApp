---
title: Firestore Migration Runbook (wife-doable)
audience: Shahir's wife, or any non-developer who needs to execute the cutover
when_to_run: After Phase 1 market validation confirms marketable (~30% W4 retention at user N=50). See BOOTSTRAP_ROADMAP.md Tier 3.
duration: 60–90 minutes including verification
prerequisite_tools: Web browser, Google account, gcloud CLI
risk: Low if you follow the steps. Rollback in Step 9 takes ~5 min.
last_validated: 2026-05-03
---

# Firestore Migration Runbook

This guide moves all live GroceryApp data from the OLD Firebase project (asia-northeast2 / Osaka) to a NEW Firebase project (asia-southeast1 / Singapore). Every step is self-contained — finish one, verify it worked, then move to the next.

> **If something looks wrong, STOP and call Shahir.** Do not improvise. The rollback in Step 9 brings everything back to where it was if you stop within 24 hours.

## Vocabulary

- **Source project** = the OLD Firebase project (Osaka). This is where the live data is now.
- **Target project** = the NEW Firebase project (Singapore). This is where the data is going.
- **Project ID** = the unique string for each project. Looks like `groceryapp-12345`. Find it in Firebase Console → Project Settings → "Project ID."

You will need both project IDs in front of you for every step. Write them on a sticky note now.

```
SOURCE_PROJECT_ID = ___________________________ (Osaka, current)
TARGET_PROJECT_ID = ___________________________ (Singapore, new)
```

---

## Pre-flight checklist (do all of these BEFORE Step 1)

- [ ] **Source project** has Blaze plan enabled with $0.01 budget alert. (Firebase Console → Settings → Billing → "Modify plan" → Blaze. Then Cloud Console → Billing → Budgets → set $0.01 alert.)
- [ ] **Target project** is created in Firebase Console with location `asia-southeast1` (Singapore). **Region cannot be changed after creation** — re-do Step 1 if you got it wrong.
- [ ] **Target project** also has Blaze plan + $0.01 budget alert.
- [ ] gcloud CLI installed on your laptop ([install instructions](https://cloud.google.com/sdk/docs/install)).
- [ ] You ran `gcloud auth login` and signed in with the same Google account that owns both Firebase projects.
- [ ] You can see both projects when you run: `gcloud projects list`
- [ ] You scheduled a 60-minute downtime window. Tell users via email or in-app banner: "GroceryApp will be in maintenance mode from HH:MM to HH:MM today."
- [ ] You have access to the Render dashboard ([dashboard.render.com](https://dashboard.render.com)).
- [ ] You opened a fresh browser tab with Firebase Console for both projects (separate tabs).

If any item is unchecked, stop here. Migration only works when all of the above are ready.

---

## Step 1 — Create the export bucket in Cloud Storage

A "bucket" is just a folder in Google's cloud where Firebase will dump the data file before importing it into the new project.

```bash
# Replace SOURCE_PROJECT_ID with your actual source project ID.
# Note: bucket names must be globally unique. If "already exists" error,
#       add a number at the end like -2026.
gsutil mb -p SOURCE_PROJECT_ID -l asia-northeast2 gs://SOURCE_PROJECT_ID-migration-export
```

**Verify:** the command finishes with no error, and you see this text:
```
Creating gs://SOURCE_PROJECT_ID-migration-export/...
```

If you see "AccessDeniedException" — you don't have permission. Ask Shahir to add you as Storage Admin on the source project.

---

## Step 2 — Stop writes to the source project (maintenance mode)

The app must stop accepting writes during the export so no data is lost in transit.

1. Open Render dashboard → your GroceryApp API service → **Environment** tab
2. Add or update the env var: `MAINTENANCE_MODE=true`
3. Click **Save Changes**
4. Render will redeploy automatically (~3–5 min)
5. Open the app on your phone — you should see "Service in maintenance mode" message
6. **Wait 60 seconds** for any in-flight requests to finish

**Verify:** open the app, try to add a new grocery item — it should fail with a maintenance-mode banner. Good. That means writes are stopped.

---

## Step 3 — Export source data

```bash
# Replace SOURCE_PROJECT_ID with your actual source project ID.
gcloud firestore export gs://SOURCE_PROJECT_ID-migration-export \
    --project=SOURCE_PROJECT_ID
```

This takes 5–30 minutes depending on data volume. The terminal will show progress. **Don't close the terminal until it finishes.**

When it's done, you'll see something like:
```
Waiting for [projects/SOURCE_PROJECT_ID/databases/(default)/operations/...] to complete...done.
metadata:
  '@type': type.googleapis.com/google.firestore.admin.v1.ExportDocumentsMetadata
  endTime: '2026-05-03T...'
  outputUriPrefix: gs://SOURCE_PROJECT_ID-migration-export/2026-05-03T...
```

**Copy the entire `outputUriPrefix` line.** You need it for Step 5. It looks like:
```
gs://SOURCE_PROJECT_ID-migration-export/2026-05-03T10-30-45_12345
```

---

## Step 4 — Grant the target project access to the export bucket

The target project needs permission to read the file the source project just wrote.

```bash
# Replace BOTH project IDs.
gsutil iam ch \
  serviceAccount:TARGET_PROJECT_ID@appspot.gserviceaccount.com:objectViewer \
  gs://SOURCE_PROJECT_ID-migration-export
```

**Verify:** no error message. Run `gsutil iam get gs://SOURCE_PROJECT_ID-migration-export` — you should see the target project's service account in the list.

---

## Step 5 — Import into the target project

```bash
# Use the outputUriPrefix you copied in Step 3.
# Replace TARGET_PROJECT_ID with your actual target project ID.
gcloud firestore import gs://SOURCE_PROJECT_ID-migration-export/2026-05-03T10-30-45_12345 \
    --project=TARGET_PROJECT_ID
```

This takes about as long as the export (5–30 min). When done:
```
Waiting for [...] to complete...done.
metadata:
  '@type': type.googleapis.com/google.firestore.admin.v1.ImportDocumentsMetadata
  endTime: '2026-05-03T...'
```

**Verify:** open Firebase Console → target project → Firestore. You should see all the collections (`users`, `catalog_entries`, `app_config`, etc.) with the same data as the source project.

---

## Step 6 — Deploy security rules to the target project

The data is in but the rules aren't. Deploy them now.

```bash
# In the GroceryApp folder on your laptop:
cd F:/ClaudeProjects/GroceryApp
firebase deploy --only firestore:rules,firestore:indexes \
    --project=TARGET_PROJECT_ID
```

If asked to log in: `firebase login` first.

**Verify:** Firebase Console → target project → Firestore → Rules tab. The rules text should match the source project.

---

## Step 7 — Switch the backend to the target project

In Render dashboard for the GroceryApp API service → **Environment** tab:

1. Update `FIREBASE_CREDENTIALS_JSON` to the **target project's** service account JSON.
   - Get this from: Firebase Console → target project → Project Settings → Service Accounts → "Generate new private key" → download → open the JSON file → copy the entire contents → paste into the env var.
2. Update `FIREBASE_DATABASE_URL` to the target project's URL.
   - Get this from: Firebase Console → target project → Project Settings → look for `databaseURL`. It looks like `https://TARGET_PROJECT_ID.firebaseio.com`.
3. Update `FIREBASE_WEB_PROJECT_ID` to `TARGET_PROJECT_ID`.
4. Update `FIREBASE_WEB_API_KEY` to the target project's web API key.
   - Get this from: Firebase Console → target project → Project Settings → General → Web app config → `apiKey`.
5. Update `FIREBASE_WEB_AUTH_DOMAIN` to `TARGET_PROJECT_ID.firebaseapp.com`.
6. Update `MAINTENANCE_MODE=false`.
7. Click **Save Changes**.

Render redeploys (~3–5 min). Watch the logs (Render dashboard → Logs tab) and look for:
```
Firebase initialized with JSON credentials from env
sentry: error tracking enabled (env=production)
unit-type backfill: ...
Background scheduler started
```

If you see "Failed to parse FIREBASE_CREDENTIALS_JSON" — the JSON paste was incomplete. Re-paste, including the surrounding `{` and `}`.

---

## Step 8 — Verify the cutover

1. **Open the app on your phone** — sign in.
   - **Important**: Firebase Auth tokens are project-scoped. You will be logged out and need to log in again. This is normal.
2. **Check existing data**: your purchases, catalog, and stores should all be there.
3. **Add a new grocery item** → save → close app → reopen → item is still there.
4. **Hit the health endpoint**: `https://groceryapp-backend-7af2.onrender.com/health`. Response should be:
   ```json
   {"status":"healthy","firestore":"ok"}
   ```
5. **Send a test message to Shahir**: "Migration done, app working, see you on the other side!"

If any of these fail, go to Step 9 (rollback).

---

## Step 9 — IF SOMETHING IS WRONG: Rollback (within 24 hours)

If anything in Step 8 didn't work, don't panic. The source project is untouched — we can switch back.

In Render dashboard → Environment tab:

1. Set `FIREBASE_CREDENTIALS_JSON` back to the source project's service account JSON.
2. Set `FIREBASE_DATABASE_URL` back to `https://SOURCE_PROJECT_ID.firebaseio.com`.
3. Set `FIREBASE_WEB_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_AUTH_DOMAIN` back to source.
4. Keep `MAINTENANCE_MODE=false`.
5. Click **Save Changes**.

Render redeploys (~3–5 min). Verify the app works against the source project. **Done. We are back where we started.** Tell Shahir what went wrong; he'll figure out next steps.

---

## Step 10 — Clean up (only after 7 days of stable operation)

Wait at least 7 days after Step 8. If everything is still working, the source project is no longer needed. To remove it:

1. **Delete the export bucket** (stops storage costs):
   ```bash
   gsutil rm -r gs://SOURCE_PROJECT_ID-migration-export
   ```
2. **Pause the source Firebase project** (do NOT delete yet — keep as cold backup):
   - Firebase Console → source project → Project Settings → "Disable" the project
3. After 30 more days of stability, you can fully delete:
   - Firebase Console → source project → Project Settings → bottom of page → "Delete project"

---

## Common errors and fixes

| Symptom | Cause | Fix |
|---|---|---|
| "AccessDeniedException" on Step 1 | Account doesn't have Storage Admin | Ask Shahir to grant Storage Admin role on source project |
| "Bucket already exists" on Step 1 | Name collision | Add a number suffix: `gs://SOURCE_PROJECT_ID-migration-export-2026` |
| Step 3 takes >2 hours | Large dataset | This is normal for 5,000+ users. Just wait. |
| "Permission denied" on Step 5 | Step 4 was skipped | Run Step 4 again, then retry Step 5 |
| App shows blank screen after Step 7 | SPA cached old Firebase config | Hard reload: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac) |
| All users say "I'm logged out" | Expected | Auth tokens are project-scoped. Users re-login once. |
| Render deploy fails | JSON paste was malformed | Re-copy the service account JSON file in full, including outer braces |
| Firestore rules look empty in target | Step 6 was skipped | Run Step 6 |
| Indexes missing in target | Indexes deploy is slow | Firebase Console → Firestore → Indexes — they may show "Building" for 2–10 min |

---

## Why this runbook is ordered this way

- Step 1 (bucket) before Step 2 (maintenance) — bucket creation is reversible; maintenance mode is user-visible. Get the cheap thing right first.
- Step 2 (maintenance) before Step 3 (export) — no new data lands during export.
- Step 4 (grant access) BEFORE Step 5 (import) — without this, import fails with a generic permission error.
- Step 6 (rules) AFTER Step 5 (import) — rules deploy is independent of data; doing it last avoids race conditions.
- Step 7 (env vars) AFTER Step 5+6 — backend points at target only when target has data + rules.
- Step 8 (verify) BEFORE Step 9 (rollback) — verify is the gate that decides rollback or proceed.
- Step 10 (cleanup) AFTER 7 days — stability window.

If you ever need to deviate from the order, call Shahir first.
