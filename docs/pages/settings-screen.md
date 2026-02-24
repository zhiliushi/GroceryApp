# SettingsScreen

**File:** `src/screens/settings/SettingsScreen.tsx`
**Tab:** Settings Tab (entry point, direct screen — no nested stack)

## Objective

Configure app preferences including account, appearance, storage locations, quick actions, shopping behavior, notifications, and sync.

## User View

### Account Section

| Row | Data | Action |
|-----|------|--------|
| User info | Display name + email | — |
| Subscription | "Premium" or "Free" | — |
| Sign In button | (when not authenticated) | Navigate to Login |
| Sign Out button | (when authenticated) | Confirm dialog → sign out |

### Appearance Section

| Row | Data | Action |
|-----|------|--------|
| Theme | Current mode (System / Light / Dark) | Tap to cycle: System → Light → Dark → System |

### Storage Locations Section

| Row | Data | Action |
|-----|------|--------|
| Location row | Icon + name + "Default" chip | Tap to set as default |
| Delete button | (per location, if > 1 exist) | Confirm dialog (checks for items first) |
| Add Location | Button | Opens Add Location dialog |

### Quick Actions Section

| Row | Data | Action |
|-----|------|--------|
| Add to Inventory | Switch | Toggle on/off (min 1 required) |
| Add Shopping List | Switch | Toggle on/off |
| Restock Settings | Switch | Toggle on/off |
| Scan Barcode | Switch | Toggle on/off |
| Past Items | Switch | Toggle on/off |

### Shopping Section

| Row | Data | Action |
|-----|------|--------|
| Unticked Item Expiry | "Remove after X days" or "Never auto-remove" | Opens chip selector dialog (3/7/14/30/Never) |

### Notifications Section

| Row | Data | Action |
|-----|------|--------|
| Enable Notifications | Switch | Toggle on/off |
| Expiry Alert Days | "X days before expiry" | Opens stepper dialog (1-14) |

### Data & Sync Section (Premium only)

| Row | Data | Action |
|-----|------|--------|
| Last Synced | Relative time (e.g. "5 minutes ago") | — |
| Sync Now | Button | Triggers manual sync |

### About Section

| Row | Data |
|-----|------|
| Version | "0.0.1" |

## Dialogs

| Dialog | Fields | Options |
|--------|--------|---------|
| Expiry Alert Days | Stepper (+/-) | 1 to 14 days |
| Shopping Item Expiry | Chip selector | 3 days, 7 days, 14 days, 30 days, Never |
| Add Location | Text input | Free text (lowercased, trimmed) |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `toggleQuickAction(key)` | Toggles a quick action on/off (enforces min 1) |
| `handleRemoveLocation(loc)` | Checks for items in location, confirms, removes |
| `handleAddLocation()` | Validates name, adds to store |
| `handleSignOut()` | Confirm dialog, calls `AuthService.signOut()` |
| All settings | Persisted to AsyncStorage via `settingsStore` |

## Filters

None (configuration screen).
