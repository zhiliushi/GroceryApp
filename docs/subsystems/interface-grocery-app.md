# Interface & UI/UX Subsystem - GroceryApp

## Design Philosophy

GroceryApp follows a **clean, minimal, and intuitive** design approach focused on:
- **Simplicity**: Easy to use without training
- **Speed**: Quick access to common actions
- **Clarity**: Clear visual hierarchy and feedback
- **Consistency**: Familiar patterns across the app

## Design System

### Color Palette

#### Primary Colors
```typescript
export const colors = {
  primary: {
    main: '#4CAF50',      // Green (grocery/fresh theme)
    light: '#81C784',
    dark: '#388E3C',
  },
  secondary: {
    main: '#FF9800',      // Orange (alerts/expiry)
    light: '#FFB74D',
    dark: '#F57C00',
  },
  background: {
    default: '#FFFFFF',
    paper: '#F5F5F5',
    dark: '#121212',
  },
  text: {
    primary: '#212121',
    secondary: '#757575',
    disabled: '#BDBDBD',
    hint: '#9E9E9E',
  },
  status: {
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#F44336',
    info: '#2196F3',
  },
  expiry: {
    expired: '#F44336',    // Red
    expiring: '#FF9800',   // Orange
    fresh: '#4CAF50',      // Green
  }
};
```

### Typography

```typescript
export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  button: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
  }
};
```

### Spacing

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

### Component Library

Using **React Native Paper** as base, with custom theming.

## Screen Layouts

### 1. Home Screen (Inventory Overview)

**Purpose**: Main dashboard showing inventory at a glance

**Layout**:
```
┌─────────────────────────────┐
│ ☰  Inventory       🔔  ⚙️  │ Header
├─────────────────────────────┤
│ 🔍 Search items...          │ Search Bar
├─────────────────────────────┤
│ Quick Stats Card            │
│ ┌─────┬─────┬─────┐        │
│ │ 45  │  3  │ $125│        │
│ │Items│Exp  │Month│        │
│ └─────┴─────┴─────┘        │
├─────────────────────────────┤
│ Categories Chips            │
│ [All] [Dairy] [Produce]...  │
├─────────────────────────────┤
│ Item List (FlatList)        │
│ ┌───────────────────────┐  │
│ │ 🥛 Milk          $4.99│  │
│ │ 2L | Expires: 2d     │  │
│ └───────────────────────┘  │
│ ┌───────────────────────┐  │
│ │ 🍞 Bread         $2.50│  │
│ │ 1 loaf | Fresh       │  │
│ └───────────────────────┘  │
│                             │
│                             │
└─────────────────────────────┘
│     [+] Add Item            │ FAB
└─────────────────────────────┘
```

**Components**:
- Header with menu, title, notifications, settings
- Search bar with filters
- Stats card showing key metrics
- Category filter chips
- Scrollable item list
- Floating Action Button (FAB) for quick add

**Item Card Design**:
```typescript
interface ItemCardProps {
  item: Item;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

// Visual structure:
// ┌──────────────────────────────┐
// │ Icon  Name              $9.99│
// │       2 units | Expires: 3d  │
// │       [────────■─────] 70%   │ Quantity indicator
// └──────────────────────────────┘
```

### 2. Barcode Scanner Screen

**Purpose**: Quick product scanning

**Layout**:
```
┌─────────────────────────────┐
│ ← Back                      │ Minimal header
├─────────────────────────────┤
│                             │
│        Camera View          │
│                             │
│    ┌─────────────┐         │
│    │             │         │ Scan area overlay
│    │   Aim Here  │         │
│    │             │         │
│    └─────────────┘         │
│                             │
│   Scan a barcode to         │
│   add to inventory          │
│                             │
├─────────────────────────────┤
│  [🔦] Flashlight            │
│                             │
│  [⌨️] Enter Manually        │ Manual entry option
└─────────────────────────────┘
```

**Scan Result Modal**:
```
┌─────────────────────────────┐
│  Product Found! ✓           │
├─────────────────────────────┤
│  [Product Image]            │
│                             │
│  Coca-Cola 2L               │
│  Beverages > Soft Drinks    │
│                             │
│  ┌─────────────────────┐   │
│  │ Quantity: [  2  ]   │   │ Edit fields
│  │ Price:    [$2.99]   │   │
│  └─────────────────────┘   │
│                             │
│  [Add to Inventory]         │
│  [Scan Another]             │
└─────────────────────────────┘
```

### 3. Item Detail Screen

**Purpose**: View and edit item details

**Layout**:
```
┌─────────────────────────────┐
│ ←           Edit  Delete    │
├─────────────────────────────┤
│    [Product Image]          │
│                             │
├─────────────────────────────┤
│ Name:    Whole Milk         │
│ Barcode: 012345678905       │
│ Category: Dairy             │
│                             │
│ Quantity: 2 L               │
│ Price:    $4.99             │
│ Store:    Walmart           │
│                             │
│ Purchase: Jan 25, 2026      │
│ Expires:  Jan 29, 2026      │
│ Status:   ⚠️ Expiring Soon  │
│                             │
│ Location: Fridge            │
│ Notes:    Organic           │
│                             │
│ [View Purchase History]     │
│ [Add to Shopping List]      │
└─────────────────────────────┘
```

### 4. Shopping List Screen

**Purpose**: Manage shopping lists

**Layout**:
```
┌─────────────────────────────┐
│ ☰  Shopping Lists    + New  │
├─────────────────────────────┤
│ Weekly Groceries    ⋮       │ List header
│ 8 items • $45.20 estimate   │
├─────────────────────────────┤
│ ☐ Milk                      │
│   2L • $4.99                │
├─────────────────────────────┤
│ ☑ Bread                     │ Checked item
│   1 loaf • $2.50            │
├─────────────────────────────┤
│ ☐ Eggs                      │
│   1 dozen • $5.99           │
├─────────────────────────────┤
│                             │
│ AI Suggestions (Premium) 🔒 │
│ ┌─────────────────────────┐│
│ │ Based on your usage:    ││
│ │ + Add Cheese            ││
│ │ + Add Yogurt            ││
│ └─────────────────────────┘│
└─────────────────────────────┘
```

### 5. Analytics Screen (Premium)

**Purpose**: View spending insights and trends

**Layout**:
```
┌─────────────────────────────┐
│ ← Analytics                 │
├─────────────────────────────┤
│ [Week] [Month] [Year]       │ Time filter
├─────────────────────────────┤
│ Total Spending              │
│    $325.40                  │
│    ↑ 12% vs last month      │
├─────────────────────────────┤
│ [Spending Chart]            │
│  │                          │
│ $│    ╱╲                    │
│  │   ╱  ╲  ╱╲              │
│  │  ╱    ╲╱  ╲             │
│  └──────────────            │
├─────────────────────────────┤
│ Top Categories              │
│ ┌─────────────────────┐    │
│ │ Dairy       $45 ███││    │
│ │ Produce     $38 ██─││    │
│ │ Meat        $32 ██─││    │
│ └─────────────────────┘    │
├─────────────────────────────┤
│ Insights 🤖                 │
│ • You buy milk every 3 days │
│ • Produce waste: 15%        │
│ • Best deals at Walmart     │
└─────────────────────────────┘
```

### 6. Settings Screen

**Purpose**: App configuration and account management

**Layout**:
```
┌─────────────────────────────┐
│ ← Settings                  │
├─────────────────────────────┤
│ Account                     │
│ ┌─────────────────────────┐│
│ │ 👤 John Doe             ││
│ │ john@example.com        ││
│ │ Premium Member 🌟      ││
│ └─────────────────────────┘│
├─────────────────────────────┤
│ General                     │
│  Theme              [Auto]  │
│  Currency           [USD]   │
│  Language           [EN]    │
├─────────────────────────────┤
│ Data & Sync (Premium)       │
│  Cloud Sync         [ON]    │
│  Last synced: 5 min ago     │
│  Auto-sync          [ON]    │
├─────────────────────────────┤
│ Notifications               │
│  Low stock alerts   [ON]    │
│  Expiry alerts      [ON]    │
│  Price drops        [ON]    │
├─────────────────────────────┤
│ Privacy                     │
│  Export Data                │
│  Delete Account             │
├─────────────────────────────┤
│ About                       │
│  Version 1.0.0              │
│  Terms & Privacy            │
│  Help & Support             │
└─────────────────────────────┘
```

## Navigation Structure

### Tab Navigation (Bottom Tabs)

```
┌─────────────────────────────┐
│                             │
│      Screen Content         │
│                             │
│                             │
├─────────────────────────────┤
│ [🏠] [📦] [📸] [📊] [⚙️]  │
│ Home  List Scan Chart Set   │
└─────────────────────────────┘
```

**Tabs**:
1. **Home**: Inventory overview
2. **Lists**: Shopping lists
3. **Scan**: Barcode scanner (center, prominent)
4. **Charts**: Analytics (premium feature)
5. **Settings**: App settings

### Navigation Flow

```
Auth Flow
    ├── Splash Screen
    ├── Login Screen
    ├── Signup Screen
    └── Forgot Password

Main Flow (After Login)
    └── Tab Navigator
        ├── Home Tab
        │   ├── Inventory List
        │   ├── Item Detail
        │   └── Add/Edit Item
        ├── Shopping Lists Tab
        │   ├── Lists Overview
        │   ├── List Detail
        │   └── Add List Item
        ├── Scanner Tab
        │   └── Barcode Scanner
        ├── Analytics Tab (Premium)
        │   ├── Overview
        │   ├── Category Details
        │   └── Expense History
        └── Settings Tab
            ├── Profile
            ├── Subscription
            └── Preferences
```

## Interactive Elements

### Buttons

**Primary Button**:
```typescript
<Button
  mode="contained"
  style={{ backgroundColor: colors.primary.main }}
>
  Add Item
</Button>
```

**Secondary Button**:
```typescript
<Button
  mode="outlined"
  style={{ borderColor: colors.primary.main }}
>
  Cancel
</Button>
```

### Input Fields

```typescript
<TextInput
  label="Item Name"
  mode="outlined"
  placeholder="Enter item name"
  value={itemName}
  onChangeText={setItemName}
/>
```

### Cards

```typescript
<Card elevation={2}>
  <Card.Content>
    <Title>Card Title</Title>
    <Paragraph>Card content</Paragraph>
  </Card.Content>
</Card>
```

### Chips (Categories)

```typescript
<Chip
  selected={selected}
  onPress={() => onSelect()}
  mode="outlined"
>
  Dairy
</Chip>
```

## Animations & Transitions

### Screen Transitions
- **Default**: Slide from right (iOS), Slide from bottom (Android)
- **Modal**: Slide from bottom with backdrop
- **Tab switch**: Fade transition

### Micro-interactions
- **Button press**: Scale down to 0.95
- **Item swipe**: Reveal actions (edit, delete)
- **Pull to refresh**: Rotate icon animation
- **Loading**: Skeleton screens with shimmer effect
- **Success feedback**: Checkmark animation + haptic

### Skeleton Screens

```typescript
// While loading items
<SkeletonPlaceholder>
  <SkeletonPlaceholder.Item flexDirection="row" alignItems="center">
    <SkeletonPlaceholder.Item width={60} height={60} borderRadius={8} />
    <SkeletonPlaceholder.Item marginLeft={20}>
      <SkeletonPlaceholder.Item width={200} height={20} />
      <SkeletonPlaceholder.Item marginTop={6} width={120} height={16} />
    </SkeletonPlaceholder.Item>
  </SkeletonPlaceholder.Item>
</SkeletonPlaceholder>
```

## Accessibility

### Guidelines
- Minimum touch target: 44x44pt
- Color contrast ratio: 4.5:1 minimum
- Screen reader support for all interactive elements
- Semantic HTML/native components
- Focus management for keyboard navigation
- Alternative text for images

### Implementation
```typescript
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Add item to inventory"
  accessibilityHint="Double tap to add a new item"
  accessibilityRole="button"
>
  <Text>Add Item</Text>
</TouchableOpacity>
```

## Responsive Design

### Breakpoints
- Small phones: < 375px width
- Standard phones: 375px - 428px
- Tablets: > 428px

### Adaptations
- Tablets: Two-column layout for lists
- Large screens: Show more content per screen
- Landscape: Adjust layout for horizontal space

## Error States

### Empty States
```
┌─────────────────────────────┐
│                             │
│       [Empty Box Icon]      │
│                             │
│   No items in inventory     │
│                             │
│  Add your first item to     │
│  start tracking groceries   │
│                             │
│    [+ Add First Item]       │
│                             │
└─────────────────────────────┘
```

### Error States
```
┌─────────────────────────────┐
│    [Error Icon] ⚠️          │
│                             │
│  Something went wrong       │
│                             │
│  We couldn't load your      │
│  items. Please try again.   │
│                             │
│     [Try Again]             │
│                             │
└─────────────────────────────┘
```

### Loading States
- Skeleton screens for content
- Spinner for actions (save, delete)
- Progress bar for sync
- Shimmer effect for placeholders

## Premium Feature Indicators

### Locked Feature UI
```
┌─────────────────────────────┐
│ AI Shopping Lists 🔒        │
│                             │
│ Get intelligent shopping    │
│ list suggestions based on   │
│ your purchase history       │
│                             │
│  [Upgrade to Premium]       │
└─────────────────────────────┘
```

### Subtle Badges
- 🌟 Premium badge on features
- Lock icon on unavailable features
- "Upgrade" prompts (non-intrusive)

## Platform-Specific Considerations

### iOS
- Use iOS-native navigation patterns
- Swipe gestures for navigation
- iOS-style modals and alerts
- SF Symbols for icons

### Android
- Material Design guidelines
- Bottom sheets for modals
- Floating Action Buttons
- Material icons

## Performance Optimizations

### Image Optimization
- Use react-native-fast-image for caching
- Lazy load images
- Compress and resize before upload
- WebP format where supported

### List Performance
- FlatList with windowSize optimization
- getItemLayout for fixed-size items
- keyExtractor for stable keys
- removeClippedSubviews on Android

### Interaction Optimization
- Throttle search input
- Debounce expensive operations
- Use InteractionManager for animations
- Optimize re-renders with React.memo
