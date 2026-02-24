# Development Rules - GroceryApp

## Golden Rule

**Update documentation after every change.** Whenever code, configuration, dependencies, or project structure is modified, all related documentation (README files, ACTIVE_TASKS.md, PROJECT_CONTEXT.md, subsystem docs, inline comments, etc.) must be updated in the same session. No change is complete until its documentation is current.

**Log every change.** Every request and its resulting changes must be appended to `docs/changes_record.md`. This file is append-only -- never modify past entries. When reading, only load the latest entries to save context.

## Code Standards

### TypeScript
- **Strict mode enabled**: All TypeScript files must compile with `strict: true`
- **No `any` types**: Use proper typing or `unknown` with type guards
- **Interfaces over types**: Use interfaces for object shapes, types for unions/intersections
- **Explicit return types**: All functions must have explicit return types
- **Named exports**: Prefer named exports over default exports

### Code Style
- **Formatting**: Use Prettier with provided config
- **Linting**: ESLint must pass with no warnings
- **Line length**: Maximum 100 characters
- **File naming**:
  - Components: PascalCase (e.g., `InventoryList.tsx`)
  - Utilities: camelCase (e.g., `formatDate.ts`)
  - Constants: UPPER_SNAKE_CASE files (e.g., `API_CONSTANTS.ts`)

### React Native Best Practices
- **Functional components only**: No class components
- **Hooks**: Use hooks for state and side effects
- **Component size**: Maximum 200 lines; split if larger
- **Props**: Define props interface for every component
- **Memoization**: Use `React.memo`, `useMemo`, `useCallback` appropriately
- **No inline styles**: Use StyleSheet.create() for all styles

## Item Data Lifecycle (3-Stage Model)

All items in the app follow a 3-stage lifecycle. This is a core architectural rule.

| Stage | Table | Status | Description |
|-------|-------|--------|-------------|
| **1 — Scan** | `scanned_items` | n/a | Temporary data from barcode scan before purchase decision. Ephemeral — auto-deleted after 24h TTL or when user discards. Promoted to Stage 2 on "confirm bought / add to inventory". |
| **2 — Active Inventory** | `inventory_items` | `active` | Confirmed items the user owns, stored in fridge/pantry/freezer. Full relations to categories, units, price, notes, etc. |
| **3 — Consumed/Used** | `inventory_items` | `consumed` / `expired` / `discarded` | Same row as Stage 2, status changed. Keeps all original data plus consumed_date, reason, quantity_remaining. User-deletable. |

### Lifecycle Rules
- **Stage 1 is local-only**: Never synced to cloud. Scratch data only.
- **Stage 2 → Stage 3 is a status change**, not a copy/move. The `status`, `consumed_date`, `reason`, and `quantity_remaining` fields are updated on the existing row.
- **Stage 3 records are user-deletable** at any time.
- **Analytics events track all transitions** between stages (`item_scanned`, `scan_promoted`, `scan_discarded`, `item_consumed`).

### Entry Paths
- **Barcode scan** → Stage 1 (scanned_items) → user confirms → Stage 2 (inventory_items, status='active')
- **Manual add** → directly to Stage 2 (inventory_items, status='active'). Bypasses Stage 1.

### Duplicate Barcodes
Multiple inventory rows can share the same barcode (e.g. same product bought on different dates). Each row tracks its own quantity. Barcode is indexed but NOT unique.

### Open Food Facts Integration
- **Read-only**: Only the barcode string is sent to OFF. No user data is shared.
- **OFF returns**: `product_name`, `brands`, `categories`, `image_url`, `image_front_url`, `quantity`, `nutriments`, `nutriscore_grade`, `ecoscore_grade`
- **Two-tier lookup**: Backend API → OFF (primary), direct client → OFF (fallback for offline).

## Architecture Patterns

### State Management
- **Local state**: useState for component-local state
- **Shared state**: Redux Toolkit or Zustand for app-wide state
- **Server state**: React Query for API data caching
- **Form state**: React Hook Form for complex forms

### Database Operations
- **Async/Await**: All database operations must be async
- **Transactions**: Use transactions for multi-step writes
- **Error handling**: Wrap all DB calls in try-catch
- **Connection management**: Use connection pooling
- **Migrations**: Version all schema changes

### API Integration
- **Error handling**: Catch and handle all API errors gracefully
- **Retry logic**: Implement exponential backoff for failed requests
- **Timeout**: Set reasonable timeouts for all requests
- **Loading states**: Always show loading indicators
- **Offline handling**: Queue requests when offline (for paid tier)

### Firebase Integration
- **Security Rules**: Never disable security rules
- **Batch operations**: Use batched writes for multiple updates
- **Real-time listeners**: Clean up listeners in component unmount
- **Firestore queries**: Optimize queries with indexes
- **Auth persistence**: Handle auth state changes properly

## Testing Requirements

### Unit Tests
- **Coverage target**: Minimum 70% code coverage
- **Test files**: Co-locate with source files (`*.test.ts`)
- **Naming**: `describe('ComponentName')` and `it('should...')`
- **Mocking**: Mock external dependencies (APIs, Firebase, SQLite)

### Integration Tests
- **API endpoints**: Test all backend endpoints
- **Database operations**: Test all CRUD operations
- **Firebase integration**: Test auth and sync flows

### E2E Tests
- **Critical paths**: Test main user flows
- **Tools**: Detox for React Native E2E testing
- **CI/CD**: Run E2E tests before deployment

## Git Workflow

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions/updates

### Commit Messages
- Follow Conventional Commits format
- Format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Example: `feat(barcode): add product lookup from Open Food Facts`

### Pull Requests
- **Descriptive title**: Clearly state what the PR does
- **Description**: Include context, changes, and testing notes
- **Link issues**: Reference related issues
- **Review required**: At least one approval before merge
- **CI checks**: All checks must pass
- **Conflicts**: Resolve conflicts before merge

## Security Guidelines

### Environment Variables
- **Never commit**: .env files must be in .gitignore
- **Example files**: Provide .env.example with dummy values
- **Access**: Use process.env or import from config module
- **Validation**: Validate all env vars at startup

### API Keys & Secrets
- **Firebase config**: Use different configs for dev/staging/prod
- **Backend secrets**: Store in Render environment variables
- **Rotation**: Rotate keys periodically
- **Exposure**: Never log or expose secrets in error messages

### User Data Protection
- **Encryption**: Encrypt sensitive data in SQLite
- **Validation**: Sanitize all user inputs
- **Auth tokens**: Store securely, never in plain text
- **HTTPS only**: All network calls over HTTPS
- **Rate limiting**: Implement on backend APIs

## Performance Guidelines

### React Native Optimization
- **FlatList**: Use FlatList for long lists, never ScrollView
- **Image optimization**: Compress and cache images
- **Bundle size**: Monitor and minimize bundle size
- **Native modules**: Use native modules for heavy operations
- **Memory leaks**: Clean up listeners and timers

### Database Performance
- **Indexing**: Index frequently queried columns
- **Query optimization**: Avoid N+1 queries
- **Pagination**: Implement for large datasets
- **Lazy loading**: Load data on demand
- **Caching**: Cache frequently accessed data

### Backend Performance
- **Async operations**: Use async/await for I/O operations
- **Connection pooling**: Reuse database connections
- **Caching**: Cache API responses where appropriate
- **Rate limiting**: Prevent abuse
- **Monitoring**: Track response times and errors

## Error Handling

### Frontend
- **User-friendly messages**: Never show technical errors to users
- **Error boundaries**: Implement React error boundaries
- **Logging**: Log errors to monitoring service
- **Fallbacks**: Provide graceful degradation
- **Retry mechanisms**: Allow users to retry failed operations

### Backend
- **HTTP status codes**: Use correct status codes
- **Error responses**: Consistent error response format
- **Validation errors**: Return detailed validation messages
- **Logging**: Log all errors with context
- **Monitoring**: Set up alerts for critical errors

## Documentation Requirements

### Code Comments
- **When to comment**: Complex logic, non-obvious solutions, workarounds
- **When not to comment**: Self-explanatory code
- **JSDoc**: Use for public APIs and exported functions
- **TODO comments**: Include ticket number and description

### README Files
- **Project README**: Setup instructions, architecture overview
- **Package READMEs**: Document each major package/module
- **API documentation**: Document all backend endpoints
- **Update regularly**: Keep documentation in sync with code

## Deployment Guidelines

### Pre-deployment Checklist
- [ ] All tests passing
- [ ] No console.log or debug code
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] API keys rotated (if needed)
- [ ] Performance tested
- [ ] Security scan completed

### Version Management
- **Semantic versioning**: Follow MAJOR.MINOR.PATCH
- **Changelog**: Maintain CHANGELOG.md
- **Release notes**: Document all changes
- **App versions**: Increment for each release

### Rollback Plan
- **Database migrations**: Ensure rollback scripts exist
- **Feature flags**: Use for risky changes
- **Monitoring**: Watch metrics after deployment
- **Quick rollback**: Ability to rollback within 5 minutes

## Code Review Checklist

### Functionality
- [ ] Code works as intended
- [ ] Edge cases handled
- [ ] Error handling implemented
- [ ] Tests added/updated

### Code Quality
- [ ] Follows style guide
- [ ] No code duplication
- [ ] Readable and maintainable
- [ ] Properly typed (TypeScript)

### Performance
- [ ] No obvious performance issues
- [ ] Proper use of memoization
- [ ] Database queries optimized
- [ ] Images/assets optimized

### Security
- [ ] No hardcoded secrets
- [ ] User input validated
- [ ] Authentication checked
- [ ] Authorization implemented

## Continuous Integration

### Required Checks
- Linting (ESLint)
- Type checking (TypeScript)
- Unit tests
- Integration tests
- Code coverage
- Build success

### Automated Actions
- Run on every PR
- Run on every commit to main
- Deploy to staging on main branch
- Deploy to production on release tags

## Tools & Dependencies

### Required Tools
- Node.js (LTS version)
- npm or yarn
- TypeScript
- React Native CLI
- Android Studio / Xcode
- Python 3.11+
- Git

### Dependency Management
- **Lock files**: Commit package-lock.json / yarn.lock
- **Updates**: Review and test dependency updates
- **Security**: Run npm audit / yarn audit regularly
- **Minimal dependencies**: Only add necessary dependencies
