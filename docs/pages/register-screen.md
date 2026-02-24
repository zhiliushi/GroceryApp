# RegisterScreen

**File:** `src/screens/auth/RegisterScreen.tsx`
**Header Title:** Create Account (modal presentation)

## Objective

Register a new user account with name, email, and password.

## User View

| Section | Data Displayed |
|---------|---------------|
| Title | "Create Account" |
| Form | Full Name, Email, Password, Confirm Password |
| Actions | Create Account button + Sign In link |

### Form Fields

| Field | Type | Validation |
|-------|------|------------|
| Full Name | Text | Required |
| Email | Email input (auto-lowercase) | Zod: valid email format |
| Password | Masked text | Zod: required, min length |
| Confirm Password | Masked text | Zod: must match password |

### Actions

| Button | Action |
|--------|--------|
| Create Account | Validates, calls `AuthService.register()`, saves profile to Firestore, navigates to Main |
| Already have an account? Sign In | Navigate back to LoginScreen |
| Close (header) | Dismiss modal |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `handleRegister()` | Validates with Zod, creates Firebase Auth user, saves profile via `FirestoreService.saveUserProfile()` |

## Filters

None (auth form).
