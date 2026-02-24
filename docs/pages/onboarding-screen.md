# OnboardingScreen

**File:** `src/screens/auth/OnboardingScreen.tsx`
**Header:** None (full-screen)

## Objective

First-time user welcome screen. Collects the user's name for personalization without requiring account creation.

## User View

| Section | Data Displayed |
|---------|---------------|
| Icon | Shopping cart emoji in circle |
| Welcome text | "Welcome to GroceryApp" + tagline |
| Form | Name + Location fields |
| Footer | "Your data is stored locally on your device" |

### Form Fields

| Field | Type | Required |
|-------|------|----------|
| Your Name | Text | Yes |
| Location/City | Text | No |

### Actions

| Button | Action |
|--------|--------|
| Get Started | Saves name to AsyncStorage (`@user_name`), navigates to Main |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `handleGetStarted()` | Saves name to AsyncStorage, marks onboarding complete, navigates to main app |

## Filters

None (onboarding screen).
