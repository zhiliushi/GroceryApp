---
title: Local AI help — pointing Luqman + GroceryApp at a local Ollama
audience: Shahir (or future-Claude reading Luqman's project context)
purpose: Cut pay-per-token AI costs (receipt OCR fallback, insights, recipe heuristics) by routing GroceryApp's `AI_SERVICE_URL` at a local Ollama instance — and let Luqman's Developer Dashboard manage the Ollama lifecycle.
last_validated: 2026-05-04
---

# Local AI help

Two things this enables:

1. **Cost cut**: GroceryApp's optional AI features (insights, receipt OCR fallback, recipe nudges) call Mistral / OpenAI at ~$0.01–$0.05 per call when configured. Pointing `AI_SERVICE_URL` at a local Ollama on your dev machine drops that to $0 after hardware. Already wired in [config.py:25-27](../backend/app/core/config.py#L25-L27).
2. **Luqman as orchestrator**: Luqman's Developer Dashboard at `http://localhost:1420` already manages local services (it manages GroceryApp's start/stop). Add Ollama as another managed process so when you start dev work, Luqman boots Ollama too.

---

## Setup — local Ollama in 4 steps

### Step 1 — Install Ollama

Windows: download installer from [ollama.com/download](https://ollama.com/download). Installs as a Windows service.

After install, confirm:
```bash
curl http://localhost:11434/api/tags
```
Should return `{"models":[]}` if no models pulled yet.

### Step 2 — Pull a small model

For grocery-app use cases (insights, recipe pairing, basic receipt parsing fallback), `llama3.2` (3B params, ~2 GB) is enough. The big models aren't worth the RAM cost for these tasks.

```bash
ollama pull llama3.2
ollama list
```

Larger options if you have ≥16 GB RAM and want better quality:
- `qwen2.5:7b` — ~4.7 GB, stronger at structured extraction (receipts)
- `mistral:7b` — ~4.4 GB, balanced

### Step 3 — Point GroceryApp at it

In `backend/.env`:
```
AI_SERVICE_URL=http://localhost:11434
AI_MODEL_NAME=llama3.2
```

Restart the backend (via `start.bat`). Test with any AI-using endpoint, e.g. insights generation.

For PRODUCTION to use local Ollama, you'd need to expose `localhost:11434` via Cloudflare Tunnel (free, no port-forwarding). That's a Tier-3+ optimisation per [BOOTSTRAP_ROADMAP.md](BOOTSTRAP_ROADMAP.md). Until then, prod stays on Mistral free tier or OpenAI; local dev uses Ollama.

### Step 4 — Have Luqman manage it (optional but useful)

Luqman's Developer Dashboard already starts/stops local services. To register Ollama:

1. Open Luqman at `http://localhost:1420`
2. Dev Hub → Developer Dashboard → "Add managed service"
3. Configure:
   - **Name**: `Ollama`
   - **Start command**: `ollama serve` (no-op if Windows service is already running, idempotent)
   - **Port**: `11434`
   - **Health check**: `GET http://localhost:11434/api/tags`
   - **Stop command**: `taskkill /F /IM ollama.exe` (Windows; or just leave to the OS service)

Now Luqman shows Ollama status alongside GroceryApp + AI-Sha. You see at a glance whether your local AI is up.

---

## How Luqman can help "later"

Luqman is your command center — it already knows about all four projects (Luqman / AI-Sha / GroceryApp / Field Scheduler) and has tool registry, AI chat, knowledge base. Concrete ways it helps:

| Scenario | How Luqman helps |
|---|---|
| Need to debug GroceryApp logs | Dev Hub → Logs tab pulls Render API + tails locally. No need to open Render dashboard separately |
| Want to test a feature flag toggle | Luqman has the flag matrix — flip it in admin, immediate Firestore write, no manual Firestore Console editing |
| Local Ollama for ad-hoc questions about GroceryApp code | Luqman's RAG-on-codebase loads GroceryApp/.claude/docs as a knowledge base. Ask "where is health-score weighted?" → returns file:line citations |
| Drafting an invitation email manually | Luqman's chat with local Ollama can draft the email body at $0 cost. Paste into your client. Saves Mistral quota |
| Pre-flight before deploying GroceryApp changes | Luqman's Developer Dashboard runs `tsc --noEmit` + `vite build` + `pytest` in one click against any project |
| Watching the Onboarding v2 rollout | Luqman's Business → Grocery → Launch Readiness → **Monitor** tab tracks free-tier quotas. Manually update after each Firebase Console check |

---

## Common gotchas

- **Ollama RAM**: llama3.2 needs ~3 GB free. Close Chrome tabs before running heavy queries
- **First call latency**: cold model load takes 5–15 seconds. Subsequent calls are <1s
- **GPU acceleration**: Windows installer auto-detects NVIDIA. AMD requires manual ROCm setup; CPU-only works but slower
- **GroceryApp falls back gracefully**: if `AI_SERVICE_URL` returns 5xx, the code paths use deterministic heuristics. So losing Ollama doesn't break the app
- **Production exposure**: don't expose `localhost:11434` to the internet directly. Use Cloudflare Tunnel (free) or stay on cloud LLMs in prod

## Cross-references

- GroceryApp config: [`backend/app/core/config.py`](../backend/app/core/config.py) — `AI_SERVICE_URL` + `AI_MODEL_NAME`
- Cost-tier roadmap: [`BOOTSTRAP_ROADMAP.md`](BOOTSTRAP_ROADMAP.md) — Tier-3+ section mentions self-hosted Ollama as a tier-3 cost optimisation
- Luqman feature catalog: [`F:\ClaudeProjects\AI-Shaman\luqman\AI_skills.md`](F:\ClaudeProjects\AI-Shaman\luqman\AI_skills.md) — full list of Luqman tools that can help
