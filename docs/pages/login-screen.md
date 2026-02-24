# LoginScreen

**File:** `src/screens/auth/LoginScreen.tsx`
**Header Title:** Sign In (modal presentation)

## Objective

Authenticate an existing user with email and password.

## User View

| Section | Data Displayed |
|---------|---------------|
| Logo | GroceryApp logo/icon |
| Form | Email + Password fields |
| Actions | Sign In button + Register link |

### Form Fields

| Field | Type | Validation |
|-------|------|------------|
| Email | Email input (auto-lowercase) | Zod: valid email format |
| Password | Masked text | Zod: required |

### Actions

| Button | Action |
|--------|--------|
| Sign In | Validates form, calls `AuthService.signIn()`, navigates to Main on success |
| Don't have an account? Sign Up | Navigate to RegisterScreen |
| Close (header) | Dismiss modal |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `handleSignIn()` | Validates with Zod schema, calls Firebase Auth, shows error on failure |

## Filters

None (auth form).
