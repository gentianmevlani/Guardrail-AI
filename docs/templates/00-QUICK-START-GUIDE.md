# PROJECT SETUP - QUICK START GUIDE

## Overview

Use these three templates together to set up any new project with:
1. **Scalable architecture** (feature-based organization)
2. **Design system** (tokens, theming, Figma sync)
3. **UI/UX system** (components, animations, hooks)

---

## SETUP ORDER

```
1. Architecture (skeleton)     → Template 03
2. Design System (foundation)  → Template 02
3. UI/UX System (components)   → Template 01
```

---

## STEP 1: PROJECT SCAFFOLD

Use **Template 03 (Architecture)** first to set up the folder structure.

### Quick Command:

```
I'm starting a new project called [NAME]. It's a [TYPE] with these features:
- Feature 1
- Feature 2
- Feature 3
- etc.

Use the feature-based architecture pattern to create:
1. The complete directory structure
2. Feature module scaffolds for each feature
3. Shared component structure
4. Route files (thin layer)
5. Configuration files

Don't implement anything yet - just create the skeleton with placeholder files.
```

### Result:

```
/src
├── /features
│   ├── /feature-1
│   │   ├── /components
│   │   ├── /hooks
│   │   ├── /services
│   │   ├── /types
│   │   └── index.ts
│   └── /feature-2
│       └── ...
├── /components
│   ├── /ui
│   └── /layout
├── /hooks
├── /lib
├── /styles
└── /app
```

---

## STEP 2: DESIGN SYSTEM

Use **Template 02 (Design System)** to create tokens and theming.

### Quick Command:

```
Now set up the design system with these brand values:

Colors:
- Primary: #[HEX]
- Secondary: #[HEX]
- Accent: #[HEX]

Typography:
- Primary Font: [FONT]
- Display Font: [FONT]

Theme: [dark/light/dual]

Create:
1. /src/design-system/tokens.ts - TypeScript tokens
2. /src/design-system/tokens.css - CSS custom properties
3. /src/design-system/ThemeProvider.tsx - Theme context
4. Update tailwind.config.ts with design tokens
5. Create Figma sync script at /scripts/sync-figma.ts
```

### Result:

```
/src/design-system
├── tokens.ts           # All design values as TypeScript
├── tokens.css          # CSS custom properties
├── ThemeProvider.tsx   # Theme switching
└── index.ts

/scripts
└── sync-figma.ts       # Figma integration
```

---

## STEP 3: UI COMPONENTS

Use **Template 01 (UI/UX System)** to create the component library.

### Quick Command:

```
Now create the UI component library using our design tokens.

Create these base components with CVA variants and Framer Motion:
1. Button (primary, secondary, ghost, danger)
2. Input (with label, error, icons)
3. Card / GlassCard
4. Modal
5. Toast
6. Skeleton
7. Dropdown
8. Tabs
9. Toggle
10. Badge

Also create:
- /src/lib/motion.ts - Animation presets
- /src/lib/cn.ts - className utility
- /src/hooks/useDisclosure.ts, useDebounce.ts, etc.
- /src/components/providers/ToastProvider.tsx

All components must:
- Use design tokens (not hardcoded values)
- Have TypeScript interfaces
- Include animations
- Be accessible
```

### Result:

```
/src/components/ui
├── Button.tsx
├── Input.tsx
├── Card.tsx
├── Modal.tsx
├── Toast.tsx
├── Skeleton.tsx
└── index.ts

/src/lib
├── motion.ts
├── cn.ts
└── utils.ts

/src/hooks
├── useDisclosure.ts
├── useDebounce.ts
└── index.ts
```

---

## STEP 4: IMPLEMENT FEATURES

Now implement each feature using the patterns from Template 03.

### Quick Command (per feature):

```
Implement the [FEATURE_NAME] feature:

What it does: [Description]

Components needed:
- [Component 1] - [what it does]
- [Component 2] - [what it does]

API endpoints:
- GET /api/[endpoint] - [what it returns]
- POST /api/[endpoint] - [what it does]

State:
- [What state needs to be managed]

Create:
1. All components in /features/[name]/components
2. Hooks in /features/[name]/hooks
3. Services in /features/[name]/services
4. Types in /features/[name]/types
5. Main container [Name].tsx
6. Update index.ts exports
7. Create route file /app/[route]/page.tsx

Use our UI components and design tokens throughout.
```

---

## COMPLETE EXAMPLE

### Project: "Trackr" - Expense Tracking App

**Step 1 - Architecture:**
```
Features: auth, dashboard, expenses, budgets, reports, settings
```

**Step 2 - Design System:**
```yaml
Colors:
  primary: "#10b981"  # Green (money)
  secondary: "#6366f1"
  accent: "#f59e0b"   # Warning/attention
Fonts:
  primary: "Inter"
Theme: "dual" (light/dark)
```

**Step 3 - UI Components:**
```
Base components + expense-specific patterns
```

**Step 4 - Feature Implementation:**
```
1. Auth → Login, signup, session management
2. Dashboard → Overview, quick stats, recent expenses
3. Expenses → CRUD, categories, receipts
4. Budgets → Budget management, progress tracking
5. Reports → Charts, exports, date filtering
6. Settings → Profile, preferences, categories
```

---

## TEMPLATE QUICK REFERENCE

| Template | What It Creates | When to Use |
|----------|----------------|-------------|
| **01 - UI/UX** | Components, animations, hooks | Every project |
| **02 - Design System** | Tokens, theming, Figma sync | Every project |
| **03 - Architecture** | Folder structure, patterns | Every project |

---

## CUSTOMIZATION TIPS

### For a Simple Landing Page:
- Skip feature architecture (use simple `/components`)
- Full design system still recommended
- Focus on animations and effects

### For a Complex SaaS:
- Full feature architecture essential
- Add more shared hooks
- Consider state management (Zustand/Jotai)
- Add testing structure

### For a Mobile-First App:
- Add responsive breakpoint utilities
- Focus on touch interactions
- Add gesture support to motion presets

### For a Data-Heavy Dashboard:
- Add chart components
- Add table components with sorting/filtering
- Focus on loading/skeleton states
- Consider virtualization for long lists

---

## MAINTENANCE

### Adding New Features:
1. Create feature folder using Template 03 pattern
2. Create types first
3. Create services
4. Create hooks
5. Create components
6. Create main container
7. Export from index.ts
8. Add route file

### Updating Design System:
1. Update Figma
2. Export tokens
3. Run `npm run sync:figma`
4. Review generated files
5. Test visual changes

### Adding New Components:
1. Check if feature-specific or shared
2. If shared, add to `/components/ui`
3. Use CVA for variants
4. Add Framer Motion animations
5. Export from index.ts

---

## FILE LOCATIONS CHEAT SHEET

| What | Where |
|------|-------|
| Design tokens | `/src/design-system/tokens.ts` |
| CSS variables | `/src/design-system/tokens.css` |
| UI components | `/src/components/ui/` |
| Layout components | `/src/components/layout/` |
| Feature code | `/src/features/[name]/` |
| Shared hooks | `/src/hooks/` |
| Utilities | `/src/lib/` |
| Animations | `/src/lib/motion.ts` |
| Route pages | `/src/app/[route]/page.tsx` |
| API routes | `/src/app/api/[route]/route.ts` |
| Global styles | `/src/styles/globals.css` |
| Tailwind config | `/tailwind.config.ts` |

---

## COMMON ISSUES

### "Can't find module @/features/..."
- Check tsconfig.json paths are set up
- Ensure index.ts exists and exports

### "Styles not applying"
- Check CSS is imported in layout.tsx
- Verify Tailwind content paths
- Check CSS variable names match

### "Animations not working"
- Verify Framer Motion installed
- Check 'use client' directive
- Ensure variants are applied correctly

### "Types not working"
- Run `npm run typecheck`
- Check exports in index.ts
- Verify import paths

---

**Now you have everything you need to start any project with a solid foundation!**
