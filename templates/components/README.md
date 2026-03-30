# Enhanced Component Templates

Complete component library that AI agents often miss.

## Components Included

### 1. ErrorBoundary
Catches React errors and displays beautiful error UI.

**Usage:**
```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary>
  <YourApp />
</ErrorBoundary>
```

### 2. NotFound (404 Page)
Beautiful custom 404 page.

**Usage:**
```tsx
import { NotFound } from '@/pages/NotFound';

// In your router
<Route path="*" element={<NotFound />} />
```

### 3. Breadcrumbs
Automatic breadcrumb navigation.

**Usage:**
```tsx
import { Breadcrumbs } from '@/components/Breadcrumbs';

<Breadcrumbs />
// Or with custom items
<Breadcrumbs items={[
  { label: 'Home', path: '/' },
  { label: 'Products', path: '/products' },
  { label: 'Details', path: '/products/123' },
]} />
```

### 4. LoadingState
Beautiful loading states.

**Usage:**
```tsx
import { LoadingState, PageLoading } from '@/components/LoadingState';

<LoadingState variant="spinner" message="Loading data..." />
<PageLoading />
```

### 5. EmptyState
Empty states for when there's no data.

**Usage:**
```tsx
import { EmptyState, EmptyStates } from '@/components/EmptyState';

<EmptyState
  title="No items"
  description="Get started by adding your first item."
  action={{ label: 'Add Item', onClick: handleAdd }}
/>

// Or use pre-built variants
<EmptyStates.NoData action={{ label: 'Add Item', onClick: handleAdd }} />
```

## Auto-Growth

Run `npm run auto-grow` to automatically add these features as your project grows!

The system detects:
- When to add error boundaries (React detected)
- When to add 404 pages (Router detected)
- When to add breadcrumbs (Multiple routes)
- When to add loading states (API calls detected)
- When to add empty states (List components detected)

## Installation

### Manual
Copy templates to your project:
```bash
cp templates/components/*.tsx src/components/
cp templates/components/*.css src/components/
cp templates/pages/*.tsx src/pages/
```

### Automatic
```bash
npm run auto-grow
```

## Dependencies

These components require:
- React 18+
- Framer Motion (for animations)
- React Router (for breadcrumbs/404)

Install:
```bash
npm install framer-motion react-router-dom
```

## Complete Checklist

When your project grows, you should have:
- [x] Error boundary
- [x] 404 page
- [x] Breadcrumbs
- [x] Loading states
- [x] Empty states
- [x] Error pages
- [x] Success states
- [x] Form validation
- [x] Toast notifications
- [x] Modals/dialogs

**Auto-grow adds these automatically!** 🌱

