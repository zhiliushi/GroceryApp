# GroceryApp — Pages Reference

Complete documentation of all screens in the mobile app.

## Navigation Structure

```
Bottom Tabs
  |-- Home Tab          --> HomeScreen (Dashboard)
  |     |-- InventoryDetail
  |     |-- Restock
  |     |-- AddMethod --> ContextScanner --> AddItem
  |     |-- PastItems --> InventoryDetail
  |
  |-- Scan Tab          --> BarcodeScannerScreen
  |     |-- AddItem
  |     |-- ListPicker --> AddListItem
  |
  |-- Inventory Tab     --> InventoryScreen (All Items)
  |     |-- InventoryDetail
  |     |-- AddMethod --> ContextScanner --> AddItem
  |     |-- PastItems --> InventoryDetail
  |
  |-- Shopping Tab      --> ShoppingListsScreen
  |     |-- ListDetail
  |     |-- AddMethod --> ContextScanner --> AddListItem
  |     |-- EditListItem
  |     |-- ShoppingCheckout --> AddItem
  |
  |-- Settings Tab      --> SettingsScreen

Root Stack (modals)
  |-- Login
  |-- Register
  |-- Onboarding
```

## Page Index

| # | Page | File | Module | Description |
|---|------|------|--------|-------------|
| 1 | [HomeScreen](home-screen.md) | `screens/home/HomeScreen.tsx` | Home | Dashboard with stats and quick actions |
| 2 | [InventoryScreen](inventory-screen.md) | `screens/inventory/InventoryScreen.tsx` | Inventory | Active inventory list grouped by location |
| 3 | [InventoryDetailScreen](inventory-detail-screen.md) | `screens/inventory/InventoryDetailScreen.tsx` | Inventory | Single item view with quantity controls |
| 4 | [AddInventoryItemScreen](add-inventory-item-screen.md) | `screens/inventory/AddInventoryItemScreen.tsx` | Inventory | Form to add new inventory item |
| 5 | [RestockScreen](restock-screen.md) | `screens/inventory/RestockScreen.tsx` | Inventory | Track and manage items needing restock |
| 6 | [PastItemsScreen](past-items-screen.md) | `screens/inventory/PastItemsScreen.tsx` | Inventory | View consumed/expired/discarded items |
| 7 | [ShoppingListsScreen](shopping-lists-screen.md) | `screens/lists/ShoppingListsScreen.tsx` | Shopping | Manage shopping lists |
| 8 | [ListDetailScreen](list-detail-screen.md) | `screens/lists/ListDetailScreen.tsx` | Shopping | Items inside a shopping list |
| 9 | [AddListItemScreen](add-list-item-screen.md) | `screens/lists/AddListItemScreen.tsx` | Shopping | Add items to a shopping list |
| 10 | [EditListItemScreen](edit-list-item-screen.md) | `screens/lists/EditListItemScreen.tsx` | Shopping | Edit price/qty/expiry on a list item |
| 11 | [ShoppingCheckoutScreen](shopping-checkout-screen.md) | `screens/lists/ShoppingCheckoutScreen.tsx` | Shopping | Checkout purchased items into inventory |
| 12 | [ListPickerScreen](list-picker-screen.md) | `screens/lists/ListPickerScreen.tsx` | Shopping | Pick a list after barcode scan |
| 13 | [BarcodeScannerScreen](barcode-scanner-screen.md) | `screens/scanner/BarcodeScannerScreen.tsx` | Scanner | Standalone barcode scanner |
| 14 | [ContextScannerScreen](context-scanner-screen.md) | `screens/common/ContextScannerScreen.tsx` | Common | Context-aware barcode scanner |
| 15 | [AddMethodScreen](add-method-screen.md) | `screens/common/AddMethodScreen.tsx` | Common | Choose scan vs manual entry |
| 16 | [SettingsScreen](settings-screen.md) | `screens/settings/SettingsScreen.tsx` | Settings | App preferences and account |
| 17 | [LoginScreen](login-screen.md) | `screens/auth/LoginScreen.tsx` | Auth | Sign in |
| 18 | [RegisterScreen](register-screen.md) | `screens/auth/RegisterScreen.tsx` | Auth | Create account |
| 19 | [OnboardingScreen](onboarding-screen.md) | `screens/auth/OnboardingScreen.tsx` | Auth | First-time welcome |
