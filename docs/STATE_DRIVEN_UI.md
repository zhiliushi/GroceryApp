# State-Driven UI

Every page and component in the web admin renders actions based on **current data state + required-field completeness + user role**. This follows a pattern like a PO system: draft shows only "Publish"; published shows stage-appropriate actions; archived is read-only.

## Why

- **No hardcoded button visibility** scattered across components (prone to bugs)
- **Predictable UX** — same action icon/label everywhere; user learns once
- **Easy to test** — pure function `getAvailableActions(data)` → list of actions
- **Easy to extend** — add new state → update one resolver function

## Core pattern: action resolver

```typescript
// utils/actionResolver.ts

export interface Action {
  key: string;                   // "mark_used" | "throw" | "give" | "edit" | "delete"
  label: string;                 // "Mark Used"
  icon?: string;                 // "✓"
  style: "primary" | "secondary" | "danger" | "disabled";
  disabled?: boolean;
  disabledReason?: string;       // tooltip explaining why
  onClick?: () => void;          // bound by caller
}

export function getAvailableActions(
  data: PurchaseEvent | CatalogEntry | ShoppingList,
  user: UserInfo,
): Action[] {
  // Dispatch by type
  if (isPurchaseEvent(data)) return getPurchaseEventActions(data, user);
  if (isCatalogEntry(data)) return getCatalogEntryActions(data, user);
  if (isShoppingList(data)) return getShoppingListActions(data, user);
  return [];
}
```

Components consume it:

```tsx
function ItemCard({ event, user }: Props) {
  const actions = getAvailableActions(event, user);
  return (
    <div className="card">
      <h3>{event.catalog_display}</h3>
      <ExpiryChip expiry={event.expiry_date} />
      <div className="actions">
        {actions.map(a => (
          <Button key={a.key} variant={a.style} disabled={a.disabled} onClick={a.onClick}>
            {a.icon} {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

## Purchase Event state machine

| Data state | Conditions | Primary action | Secondary actions |
|-----------|------------|---------------|-------------------|
| **Draft** | status=active, no expiry, no location | `[Set expiry]` | `[Set location]` `[Delete]` |
| **Active, no expiry** | status=active, no expiry, has location | `[Set expiry]` | `[Mark Used]` `[Delete]` (no "Thrown" — can't throw "expired" without expiry) |
| **Active, has expiry, not expiring** | status=active, expiry > now+7d | `[Mark Used]` | `[Give Away]` (no urgent "Throw") |
| **Active, expiring ≤3 days** | status=active, expiry ≤ now+3d | `[Mark Used]` **urgent** | `[Give Away]` emphasised |
| **Active, expired** | status=active, expiry < now | `[Throw]` **red** | `[Mark Used (still good)]` `[Give Away]` |
| **Used** | status=used | (none — read-only) | `[View history]` |
| **Thrown** | status=thrown | (none — read-only) | `[View history]` shown in waste stats |
| **Transferred** | status=transferred | (none — read-only) | `[View history]` linked to foodbank |

### Resolver function

```typescript
function getPurchaseEventActions(event: PurchaseEvent, user: UserInfo): Action[] {
  // Read-only terminal states
  if (event.status === "used" || event.status === "thrown" || event.status === "transferred") {
    return [{ key: "view_history", label: "View History", style: "secondary" }];
  }

  const actions: Action[] = [];
  const daysUntilExpiry = event.expiry_date 
    ? Math.floor((new Date(event.expiry_date).getTime() - Date.now()) / 86400000)
    : null;

  // Draft: no location yet
  if (!event.location) {
    actions.push({ key: "set_location", label: "Set Location", style: "primary" });
  }

  // No expiry: primary = set expiry
  if (!event.expiry_date) {
    actions.push({ key: "set_expiry", label: "Set Expiry", style: "primary", icon: "📅" });
    actions.push({ key: "mark_used", label: "Mark Used", style: "secondary", icon: "✓" });
    actions.push({ key: "delete", label: "Delete", style: "danger" });
    return actions;
  }

  // Expired: primary = throw
  if (daysUntilExpiry !== null && daysUntilExpiry < 0) {
    actions.push({ key: "throw", label: "Throw", style: "danger", icon: "🗑" });
    actions.push({ key: "mark_used", label: "Mark Used (still good)", style: "secondary" });
    actions.push({ key: "give", label: "Give Away", style: "secondary" });
    return actions;
  }

  // Expiring soon: primary = mark used
  if (daysUntilExpiry !== null && daysUntilExpiry <= 3) {
    actions.push({ key: "mark_used", label: "Mark Used", style: "primary", icon: "✓" });
    actions.push({ key: "give", label: "Give Away", style: "secondary", icon: "🎁" });
    actions.push({ key: "throw", label: "Throw", style: "danger" });
    return actions;
  }

  // Normal active
  actions.push({ key: "mark_used", label: "Mark Used", style: "primary", icon: "✓" });
  actions.push({ key: "give", label: "Give Away", style: "secondary", icon: "🎁" });
  return actions;
}
```

## Catalog Entry state machine

| State | Conditions | Actions |
|-------|-----------|---------|
| **Empty** | active=0, total=0 | `[Delete]` |
| **Historical** | active=0, total>0 | `[Edit name]` `[Merge into another]` `[Delete (force)]` |
| **Active** | active>0 | `[Edit name]` `[Merge into another]` (Delete hidden) |
| **Linked to barcode** | barcode != null | + `[Unlink barcode]` |
| **Needs review** | needs_review=true | Banner "Review needed" + regular actions |

## Shopping List state machine

| State | Conditions | Actions |
|-------|-----------|---------|
| **Empty** | items=0 | `[Add first item]` large CTA |
| **Draft** | items>0, bought=0, state="draft" | `[Add items]` `[Start shopping]` |
| **Shopping** | state="shopping" | Scan-at-checkout, `[Finish shopping]` |
| **Finished** | state="finished" | Read-only, `[View purchases]` (events created during shopping) |

## Required-field-driven visibility

Actions can be **disabled** (shown but inert with tooltip) or **hidden** (not rendered) based on whether required fields are filled.

Example: `[Save]` button in QuickAddModal:

```typescript
function getSaveAction(form: QuickAddForm, flags: FeatureFlags): Action {
  if (!form.name || _normalize(form.name) === "") {
    return { key: "save", label: "Save", style: "disabled", disabled: true, disabledReason: "Enter a name or scan" };
  }
  if (form.expiry_raw && !parseExpiry(form.expiry_raw).confident) {
    return { key: "save", label: "Save", style: "disabled", disabled: true, disabledReason: "Can't understand expiry — use calendar or rephrase" };
  }
  if (flags.financial_tracking && form.price !== undefined && form.price < 0) {
    return { key: "save", label: "Save", style: "disabled", disabled: true, disabledReason: "Price cannot be negative" };
  }
  return { key: "save", label: "Save", style: "primary" };
}
```

## Feature-flag-driven visibility

Flags affect which actions/fields appear, not the data state machine itself:

```typescript
// Inline financial toggle, only if feature flag on AND user has >=10 items
if (flags.financial_tracking && userItemCount >= 10) {
  form.fields.push(paymentMethodField);
}
```

## Per-page state machines

Each major page has its own state, computed from its data, driving its layout:

### Dashboard

```typescript
function computeDashboardState(data: DashboardData): "empty" | "active" | "warning" | "critical" {
  if (data.total_items === 0) return "empty";
  const healthScore = computeHealthScore(data);
  if (healthScore < 30) return "critical";
  if (healthScore < 60) return "warning";
  return "active";
}

function Dashboard() {
  const { data } = useDashboard();
  const state = computeDashboardState(data);

  if (state === "empty") return <EmptyDashboard />;      // big CTA to add first item
  if (state === "critical") return <CriticalDashboard />; // health bar red, urgent banner
  if (state === "warning") return <WarningDashboard />;   // health bar yellow, expiring emphasised
  return <HealthyDashboard />;                             // all sections normal
}
```

### My Items

```typescript
function MyItemsPage() {
  const { data: purchases } = useActivePurchases();
  
  if (purchases.length === 0) return <EmptyMyItems />;
  
  const groups = groupByExpiryUrgency(purchases);
  // groups: { expiring: [...], active: [...], noExpiry: [...] }
  
  return (
    <div>
      {groups.expiring.length > 0 && <ExpiringSection items={groups.expiring} />}
      {groups.active.length > 0 && <ActiveSection items={groups.active} />}
      {groups.noExpiry.length > 0 && <NoExpirySection items={groups.noExpiry} />}
    </div>
  );
}
```

Each section only renders if it has items (no empty sections cluttering the view).

## React propagation

When data changes via mutation:

1. Mutation updates Firestore
2. React Query invalidates relevant query keys (`['purchases']`, `['dashboard']`)
3. Queries refetch
4. Components re-render with new data
5. `getAvailableActions()` returns new action list
6. Buttons swap instantly

All without imperative "show/hide this button" logic in mutation success callbacks.

## Testing

- **Unit tests** on resolver functions (pure functions, easy to test):
  ```typescript
  test("expired event shows Throw as primary", () => {
    const event = mockEvent({ status: "active", expiry_date: yesterday });
    const actions = getPurchaseEventActions(event, mockUser());
    expect(actions[0]).toMatchObject({ key: "throw", style: "danger" });
  });
  ```
- **Integration tests** with React Testing Library:
  ```typescript
  test("marking event as used removes it from active list", async () => {
    render(<MyItemsPage />);
    await userEvent.click(screen.getByText("Mark Used"));
    expect(screen.queryByText("Milk")).not.toBeInTheDocument();
  });
  ```
