# UNIVERSAL UI/UX SYSTEM TEMPLATE

## Overview

This template sets up a complete, production-ready UI system for any project. Copy this prompt and customize the variables at the top for your specific project.

---

## CONFIGURATION (Edit These)

```yaml
PROJECT_NAME: "Your App Name"
PROJECT_TYPE: "web-app" # web-app | mobile-app | dashboard | landing | saas
FRAMEWORK: "nextjs" # nextjs | vite | remix | astro
STYLING: "tailwind" # tailwind | styled-components | css-modules
ANIMATION_LIB: "framer-motion" # framer-motion | gsap | none
COMPONENT_LIB: "shadcn" # shadcn | radix | headless-ui | none
THEME_MODE: "dark" # dark | light | system | dual
BRAND_COLORS:
  primary: "#6366f1" # Your primary brand color
  secondary: "#8b5cf6" # Your secondary color
  accent: "#22d3ee" # Accent/highlight color
FONT_PRIMARY: "Inter" # Your main font
FONT_DISPLAY: "Cal Sans" # Display/heading font (optional)
```

---

## MASTER PROMPT

```
You are setting up a complete UI/UX system for [PROJECT_NAME], a [PROJECT_TYPE] built with [FRAMEWORK].

## PROJECT CONTEXT

- Framework: [FRAMEWORK]
- Styling: [STYLING]
- Animation: [ANIMATION_LIB]
- Component Base: [COMPONENT_LIB]
- Theme: [THEME_MODE]
- Primary Color: [BRAND_COLORS.primary]
- Secondary Color: [BRAND_COLORS.secondary]
- Accent Color: [BRAND_COLORS.accent]
- Primary Font: [FONT_PRIMARY]
- Display Font: [FONT_DISPLAY]

## DELIVERABLES

Create a complete UI foundation with:

### 1. DIRECTORY STRUCTURE

```
/src
├── /components
│   ├── /ui                 # Base UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Dropdown.tsx
│   │   ├── Tabs.tsx
│   │   ├── Toggle.tsx
│   │   ├── Tooltip.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Progress.tsx
│   │   └── index.ts
│   │
│   ├── /layout             # Layout components
│   │   ├── PageLayout.tsx
│   │   ├── Container.tsx
│   │   ├── Section.tsx
│   │   ├── Stack.tsx
│   │   ├── Grid.tsx
│   │   └── index.ts
│   │
│   ├── /feedback           # Feedback components
│   │   ├── LoadingSpinner.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorState.tsx
│   │   └── index.ts
│   │
│   └── /providers          # Context providers
│       ├── ThemeProvider.tsx
│       ├── ToastProvider.tsx
│       └── index.ts
│
├── /hooks                  # Custom hooks
│   ├── useDisclosure.ts
│   ├── useDebounce.ts
│   ├── useMediaQuery.ts
│   ├── useLocalStorage.ts
│   ├── useOnClickOutside.ts
│   ├── useClipboard.ts
│   ├── useToast.ts
│   └── index.ts
│
├── /lib                    # Utilities
│   ├── cn.ts              # className utility
│   ├── motion.ts          # Animation presets
│   └── utils.ts           # General utilities
│
├── /styles
│   ├── globals.css        # Global styles
│   └── tokens.css         # CSS custom properties
│
└── /types
    └── ui.ts              # Shared UI types
```

### 2. MOTION PRESETS (/lib/motion.ts)

Create reusable animation variants:

```typescript
// Transitions
- spring (snappy)
- springBouncy (playful)
- smooth (elegant)
- quick (instant feedback)

// Component Animations
- buttonHover, buttonTap
- cardHover, cardLift
- fadeIn, fadeOut
- slideUp, slideDown, slideLeft, slideRight
- scaleIn, scaleOut
- modalBackdrop, modalContent
- dropdownOpen, dropdownClose
- toastEnter, toastExit

// Stagger Patterns
- staggerContainer
- staggerItem
- staggerFast, staggerSlow

// Special Effects
- shimmer (loading)
- pulse (attention)
- shake (error)
- spin (loading)
- float (decorative)
```

### 3. BASE COMPONENTS

Each component must have:
- TypeScript interfaces
- CVA variants (variant, size, color scheme)
- Animation states (hover, tap, focus, disabled, loading)
- Accessibility (ARIA, keyboard navigation)
- Ref forwarding

#### Button.tsx
- Variants: primary, secondary, ghost, outline, danger, link
- Sizes: xs, sm, md, lg, xl
- States: default, hover, active, loading, disabled
- Props: leftIcon, rightIcon, isLoading, loadingText, fullWidth

#### Input.tsx
- Variants: default, filled, flushed
- Sizes: sm, md, lg
- States: default, focus, error, disabled
- Props: label, error, helperText, leftIcon, rightIcon

#### Card.tsx
- Variants: default, elevated, outlined, ghost
- Props: padding, hoverable, clickable, as (div/article/section)
- Animation: lift on hover (optional)

#### Modal.tsx
- Sizes: sm, md, lg, xl, full
- Animation: backdrop fade, content scale+fade
- Props: isOpen, onClose, title, closeOnOverlay, closeOnEsc
- Focus trap, scroll lock

#### Toast.tsx
- Variants: success, error, warning, info
- Animation: slide in from edge
- Props: duration, isClosable, position
- Stack management

#### Skeleton.tsx
- Variants: text, circle, rect, card
- Animation: shimmer
- Props: width, height, count

#### Dropdown.tsx
- Animation: scale + fade from anchor
- Keyboard navigation
- Click outside to close
- Position awareness (flip if near edge)

#### Tabs.tsx
- Animation: indicator slides between tabs
- Variants: line, enclosed, pills
- Keyboard navigation

#### Toggle.tsx
- Animation: knob slides, color morphs
- Props: checked, onChange, disabled, size

#### Tooltip.tsx
- Animation: fade + slight scale
- Delay before show
- Position awareness

#### Badge.tsx
- Variants: solid, outline, subtle
- Colors: default, success, warning, error, info
- Props: dot (notification dot)

#### Avatar.tsx
- Fallback to initials
- Loading state
- Group/stack variant
- Sizes: xs, sm, md, lg, xl

#### Progress.tsx
- Variants: bar, circular
- Animation: smooth width/stroke transition
- Props: value, max, showValue, indeterminate

### 4. LAYOUT COMPONENTS

#### PageLayout.tsx
- Page transition animation
- Optional header/footer slots
- Loading state
- Error boundary

#### Container.tsx
- Max-width variants: sm, md, lg, xl, full
- Centered with padding

#### Section.tsx
- Consistent vertical spacing
- Optional title with action slot
- Divider option

#### Stack.tsx
- Direction: vertical, horizontal
- Gap from spacing scale
- Dividers option
- Responsive direction

#### Grid.tsx
- Auto-fit responsive grid
- Column count variants
- Gap from spacing scale
- Stagger animation on children

### 5. FEEDBACK COMPONENTS

#### LoadingSpinner.tsx
- Sizes: sm, md, lg
- Color inherits or custom
- Optional label

#### EmptyState.tsx
- Icon slot
- Title, description
- Action button slot

#### ErrorState.tsx
- Icon
- Title, description
- Retry button
- Optional details collapse

### 6. PROVIDERS

#### ThemeProvider.tsx
- Theme state (light/dark/system)
- Persist to localStorage
- System preference detection
- CSS variable switching

#### ToastProvider.tsx
- Toast queue management
- Position configuration
- Auto-dismiss
- useToast() hook

### 7. CUSTOM HOOKS

```typescript
// State Management
useDisclosure() - isOpen, onOpen, onClose, onToggle
useLocalStorage(key, initial) - persisted state
useDebounce(value, delay) - debounced value
useDebouncedCallback(fn, delay) - debounced function

// DOM
useOnClickOutside(ref, handler) - detect outside clicks
useMediaQuery(query) - responsive breakpoints
useScrollLock() - prevent body scroll
useKeyboardShortcut(key, handler) - keyboard shortcuts

// Utilities
useClipboard() - copy with feedback
useToast() - show toast notifications
useMounted() - check if mounted (SSR safe)
usePrevious(value) - previous render value
```

### 8. UTILITY FUNCTIONS

```typescript
// /lib/cn.ts
cn(...classes) - merge Tailwind classes

// /lib/utils.ts
formatNumber(num) - locale number formatting
formatCurrency(num, currency) - currency formatting
formatDate(date, format) - date formatting
truncate(str, length) - truncate with ellipsis
sleep(ms) - promise-based delay
```

### 9. CSS CONFIGURATION

#### globals.css
- CSS reset/normalize
- Base typography
- Scrollbar styling
- Focus visible styles
- Animation keyframes
- Utility classes

#### tokens.css
- Color CSS variables
- Typography variables
- Spacing variables
- Radius variables
- Shadow variables
- Transition variables
- Dark mode overrides

### 10. TAILWIND EXTENSION

Extend tailwind.config with:
- Custom colors from brand
- Custom fonts
- Extended spacing scale
- Custom animations
- Custom keyframes
- Container settings

---

## COMPONENT PATTERNS

Every component should follow this pattern:

```typescript
'use client'; // if needed

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

// 1. CVA Variants
const componentVariants = cva(
  'base-classes-here',
  {
    variants: {
      variant: { /* ... */ },
      size: { /* ... */ },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

// 2. TypeScript Interface
export interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {
  // additional props
}

// 3. Component with forwardRef
export const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(componentVariants({ variant, size }), className)}
        // animation props
        {...props}
      />
    );
  }
);

Component.displayName = 'Component';
```

---

## EXECUTION ORDER

1. Create directory structure
2. Set up /lib utilities (cn.ts, motion.ts, utils.ts)
3. Create CSS tokens and globals
4. Update Tailwind config
5. Create base UI components (Button first, then others)
6. Create layout components
7. Create feedback components
8. Create providers
9. Create hooks
10. Create barrel exports (index.ts files)
11. Test with example page

---

## QUALITY CHECKLIST

For each component, verify:
- [ ] TypeScript types complete
- [ ] All variants working
- [ ] Animations smooth
- [ ] Keyboard accessible
- [ ] Screen reader friendly
- [ ] Loading state (if applicable)
- [ ] Error state (if applicable)
- [ ] Disabled state working
- [ ] Ref forwarding works
- [ ] className prop merges correctly

---

Now create each file with complete, production-ready code. Start with the utilities and work through the components systematically.
```

---

## QUICK CUSTOMIZATION EXAMPLES

### For a SaaS Dashboard:
```yaml
PROJECT_TYPE: "dashboard"
THEME_MODE: "dark"
BRAND_COLORS:
  primary: "#6366f1"
  secondary: "#8b5cf6"
FONT_PRIMARY: "Inter"
```

### For an E-commerce Site:
```yaml
PROJECT_TYPE: "web-app"
THEME_MODE: "light"
BRAND_COLORS:
  primary: "#000000"
  secondary: "#666666"
  accent: "#ff4d00"
FONT_PRIMARY: "DM Sans"
```

### For a Crypto/Web3 App:
```yaml
PROJECT_TYPE: "web-app"
THEME_MODE: "dark"
BRAND_COLORS:
  primary: "#00d4ff"
  secondary: "#00ff88"
FONT_PRIMARY: "Rajdhani"
```

### For a Creative Agency:
```yaml
PROJECT_TYPE: "landing"
THEME_MODE: "dual"
BRAND_COLORS:
  primary: "#ff3366"
  secondary: "#ff9500"
FONT_PRIMARY: "Syne"
FONT_DISPLAY: "Clash Display"
```
