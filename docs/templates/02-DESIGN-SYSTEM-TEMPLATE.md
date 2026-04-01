# UNIVERSAL DESIGN SYSTEM TEMPLATE

## Overview

This template sets up a complete design system with tokens, theming, and Figma sync. Works for any project regardless of framework or styling solution.

---

## CONFIGURATION (Edit These)

```yaml
PROJECT_NAME: "Your App"

# Brand Colors
COLORS:
  primary: "#6366f1"
  primary_light: "#818cf8"
  primary_dark: "#4f46e5"
  secondary: "#8b5cf6"
  accent: "#22d3ee"
  
  # Semantic Colors
  success: "#10b981"
  warning: "#f59e0b"
  error: "#ef4444"
  info: "#3b82f6"

# Neutrals (usually don't change much)
NEUTRALS:
  50: "#fafafa"
  100: "#f4f4f5"
  200: "#e4e4e7"
  300: "#d4d4d8"
  400: "#a1a1aa"
  500: "#71717a"
  600: "#52525b"
  700: "#3f3f46"
  800: "#27272a"
  900: "#18181b"
  950: "#09090b"

# Typography
TYPOGRAPHY:
  font_primary: "Inter"
  font_display: "Inter" # or different display font
  font_mono: "JetBrains Mono"
  
  # Scale (use default or customize)
  scale: "default" # default | compact | comfortable

# Spacing Base
SPACING_UNIT: 4 # 4px base (4, 8, 12, 16, 20, 24, 32, etc.)

# Border Radius
RADIUS:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"

# Shadows
SHADOW_COLOR: "0, 0, 0" # RGB for shadow color

# Theme Modes
THEMES:
  - light
  - dark
  # - custom_theme_name (optional)
```

---

## MASTER PROMPT

```
Create a complete design system for [PROJECT_NAME] with the following specifications:

## BRAND CONFIGURATION

Primary: [COLORS.primary]
Secondary: [COLORS.secondary]
Accent: [COLORS.accent]

Success: [COLORS.success]
Warning: [COLORS.warning]
Error: [COLORS.error]
Info: [COLORS.info]

Fonts:
- Primary: [TYPOGRAPHY.font_primary]
- Display: [TYPOGRAPHY.font_display]
- Mono: [TYPOGRAPHY.font_mono]

Themes: [THEMES]

## DELIVERABLES

### 1. DESIGN TOKENS FILE

Create `/src/design-system/tokens.ts`:

```typescript
/**
 * [PROJECT_NAME] Design System Tokens
 * 
 * Single source of truth for all design values.
 * Generated from design system configuration.
 */

// ==============================================
// COLOR PALETTE
// ==============================================

export const palette = {
  // Brand Colors
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '[PRIMARY]',      // Main brand color
    600: '[PRIMARY_DARK]',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  
  secondary: {
    // Similar scale for secondary
  },
  
  // Semantic Colors
  success: {
    light: '#d1fae5',
    DEFAULT: '[SUCCESS]',
    dark: '#059669',
  },
  
  warning: {
    light: '#fef3c7',
    DEFAULT: '[WARNING]',
    dark: '#d97706',
  },
  
  error: {
    light: '#fee2e2',
    DEFAULT: '[ERROR]',
    dark: '#dc2626',
  },
  
  info: {
    light: '#dbeafe',
    DEFAULT: '[INFO]',
    dark: '#2563eb',
  },
  
  // Neutrals
  neutral: {
    0: '#ffffff',
    50: '[NEUTRALS.50]',
    100: '[NEUTRALS.100]',
    200: '[NEUTRALS.200]',
    300: '[NEUTRALS.300]',
    400: '[NEUTRALS.400]',
    500: '[NEUTRALS.500]',
    600: '[NEUTRALS.600]',
    700: '[NEUTRALS.700]',
    800: '[NEUTRALS.800]',
    900: '[NEUTRALS.900]',
    950: '[NEUTRALS.950]',
    1000: '#000000',
  },
} as const;

// ==============================================
// SEMANTIC TOKENS (Theme-Aware)
// ==============================================

export const semanticTokens = {
  light: {
    // Backgrounds
    bg: {
      primary: palette.neutral[0],
      secondary: palette.neutral[50],
      tertiary: palette.neutral[100],
      inverse: palette.neutral[900],
      
      // Interactive
      hover: palette.neutral[100],
      active: palette.neutral[200],
      disabled: palette.neutral[100],
      
      // Brand
      accent: palette.primary[500],
      accentSubtle: palette.primary[50],
    },
    
    // Text
    text: {
      primary: palette.neutral[900],
      secondary: palette.neutral[600],
      tertiary: palette.neutral[500],
      disabled: palette.neutral[400],
      inverse: palette.neutral[0],
      
      // Brand
      accent: palette.primary[600],
      onAccent: palette.neutral[0],
    },
    
    // Borders
    border: {
      default: palette.neutral[200],
      subtle: palette.neutral[100],
      strong: palette.neutral[300],
      focus: palette.primary[500],
    },
    
    // Shadows
    shadow: {
      sm: `0 1px 2px rgba([SHADOW_COLOR], 0.05)`,
      md: `0 4px 6px rgba([SHADOW_COLOR], 0.1)`,
      lg: `0 10px 15px rgba([SHADOW_COLOR], 0.1)`,
      xl: `0 20px 25px rgba([SHADOW_COLOR], 0.15)`,
    },
  },
  
  dark: {
    // Backgrounds
    bg: {
      primary: palette.neutral[950],
      secondary: palette.neutral[900],
      tertiary: palette.neutral[800],
      inverse: palette.neutral[50],
      
      hover: palette.neutral[800],
      active: palette.neutral[700],
      disabled: palette.neutral[900],
      
      accent: palette.primary[500],
      accentSubtle: 'rgba(99, 102, 241, 0.1)', // primary with opacity
    },
    
    // Text
    text: {
      primary: palette.neutral[50],
      secondary: palette.neutral[400],
      tertiary: palette.neutral[500],
      disabled: palette.neutral[600],
      inverse: palette.neutral[900],
      
      accent: palette.primary[400],
      onAccent: palette.neutral[0],
    },
    
    // Borders
    border: {
      default: palette.neutral[800],
      subtle: palette.neutral[900],
      strong: palette.neutral[700],
      focus: palette.primary[500],
    },
    
    // Shadows (more subtle in dark mode)
    shadow: {
      sm: `0 1px 2px rgba(0, 0, 0, 0.3)`,
      md: `0 4px 6px rgba(0, 0, 0, 0.4)`,
      lg: `0 10px 15px rgba(0, 0, 0, 0.5)`,
      xl: `0 20px 25px rgba(0, 0, 0, 0.6)`,
    },
  },
} as const;

// ==============================================
// TYPOGRAPHY
// ==============================================

export const typography = {
  // Font Families
  fontFamily: {
    primary: "'[FONT_PRIMARY]', system-ui, sans-serif",
    display: "'[FONT_DISPLAY]', system-ui, sans-serif",
    mono: "'[FONT_MONO]', monospace",
  },
  
  // Font Sizes
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
    '6xl': '3.75rem',  // 60px
    '7xl': '4.5rem',   // 72px
  },
  
  // Font Weights
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  
  // Line Heights
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  
  // Letter Spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// ==============================================
// SPACING
// ==============================================

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
  36: '9rem',       // 144px
  40: '10rem',      // 160px
  44: '11rem',      // 176px
  48: '12rem',      // 192px
  52: '13rem',      // 208px
  56: '14rem',      // 224px
  60: '15rem',      // 240px
  64: '16rem',      // 256px
  72: '18rem',      // 288px
  80: '20rem',      // 320px
  96: '24rem',      // 384px
} as const;

// ==============================================
// BORDER RADIUS
// ==============================================

export const radius = {
  none: '0',
  sm: '[RADIUS.sm]',
  md: '[RADIUS.md]',
  lg: '[RADIUS.lg]',
  xl: '[RADIUS.xl]',
  '2xl': '[RADIUS.2xl]',
  '3xl': '1.5rem',
  full: '[RADIUS.full]',
} as const;

// ==============================================
// SHADOWS
// ==============================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba([SHADOW_COLOR], 0.05)',
  DEFAULT: '0 1px 3px 0 rgba([SHADOW_COLOR], 0.1), 0 1px 2px -1px rgba([SHADOW_COLOR], 0.1)',
  md: '0 4px 6px -1px rgba([SHADOW_COLOR], 0.1), 0 2px 4px -2px rgba([SHADOW_COLOR], 0.1)',
  lg: '0 10px 15px -3px rgba([SHADOW_COLOR], 0.1), 0 4px 6px -4px rgba([SHADOW_COLOR], 0.1)',
  xl: '0 20px 25px -5px rgba([SHADOW_COLOR], 0.1), 0 8px 10px -6px rgba([SHADOW_COLOR], 0.1)',
  '2xl': '0 25px 50px -12px rgba([SHADOW_COLOR], 0.25)',
  inner: 'inset 0 2px 4px 0 rgba([SHADOW_COLOR], 0.05)',
} as const;

// ==============================================
// Z-INDEX
// ==============================================

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// ==============================================
// TRANSITIONS
// ==============================================

export const transitions = {
  duration: {
    fastest: '50ms',
    faster: '100ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    slowest: '500ms',
  },
  
  easing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// ==============================================
// BREAKPOINTS
// ==============================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

export type Theme = 'light' | 'dark';

export function getSemanticToken(theme: Theme, category: string, token: string) {
  return semanticTokens[theme]?.[category]?.[token];
}

export function getColor(colorPath: string) {
  const [color, shade] = colorPath.split('.');
  return palette[color]?.[shade] || palette[color]?.DEFAULT || colorPath;
}
```

### 2. CSS CUSTOM PROPERTIES

Create `/src/design-system/tokens.css`:

```css
:root {
  /* Color Palette */
  --color-primary-50: #eff6ff;
  --color-primary-500: [PRIMARY];
  --color-primary-600: [PRIMARY_DARK];
  /* ... all palette colors */
  
  /* Typography */
  --font-primary: '[FONT_PRIMARY]', system-ui, sans-serif;
  --font-display: '[FONT_DISPLAY]', system-ui, sans-serif;
  --font-mono: '[FONT_MONO]', monospace;
  
  /* Font Sizes */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  
  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  
  /* Border Radius */
  --radius-sm: [RADIUS.sm];
  --radius-md: [RADIUS.md];
  --radius-lg: [RADIUS.lg];
  --radius-xl: [RADIUS.xl];
  --radius-full: [RADIUS.full];
  
  /* Transitions */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Z-Index */
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-modal: 1400;
  --z-toast: 1700;
  --z-tooltip: 1800;
}

/* Light Theme (default) */
:root,
[data-theme="light"] {
  /* Backgrounds */
  --bg-primary: var(--color-neutral-0);
  --bg-secondary: var(--color-neutral-50);
  --bg-tertiary: var(--color-neutral-100);
  --bg-hover: var(--color-neutral-100);
  --bg-active: var(--color-neutral-200);
  
  /* Text */
  --text-primary: var(--color-neutral-900);
  --text-secondary: var(--color-neutral-600);
  --text-tertiary: var(--color-neutral-500);
  --text-disabled: var(--color-neutral-400);
  
  /* Borders */
  --border-default: var(--color-neutral-200);
  --border-subtle: var(--color-neutral-100);
  --border-strong: var(--color-neutral-300);
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

/* Dark Theme */
[data-theme="dark"] {
  /* Backgrounds */
  --bg-primary: var(--color-neutral-950);
  --bg-secondary: var(--color-neutral-900);
  --bg-tertiary: var(--color-neutral-800);
  --bg-hover: var(--color-neutral-800);
  --bg-active: var(--color-neutral-700);
  
  /* Text */
  --text-primary: var(--color-neutral-50);
  --text-secondary: var(--color-neutral-400);
  --text-tertiary: var(--color-neutral-500);
  --text-disabled: var(--color-neutral-600);
  
  /* Borders */
  --border-default: var(--color-neutral-800);
  --border-subtle: var(--color-neutral-900);
  --border-strong: var(--color-neutral-700);
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
}
```

### 3. TAILWIND CONFIGURATION

Create design-system-aware `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50)',
          // ... all shades
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
        },
        // ... other colors
        
        // Semantic colors (use CSS variables)
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
      },
      
      fontFamily: {
        primary: 'var(--font-primary)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
      
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },
      
      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        tooltip: 'var(--z-tooltip)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### 4. FIGMA SYNC SCRIPT

Create `/scripts/sync-figma.ts` for syncing with Figma Tokens Studio:

[Include the sync script from earlier - handles parsing Tokens Studio JSON export and generating tokens.ts and tokens.css]

### 5. THEME PROVIDER

Create `/src/design-system/ThemeProvider.tsx`:

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.setAttribute('data-theme', systemTheme);
      setResolvedTheme(systemTheme);
    } else {
      root.setAttribute('data-theme', theme);
      setResolvedTheme(theme);
    }
    
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

### 6. DOCUMENTATION

Create `/src/design-system/README.md` with:
- Token reference
- Usage examples
- Migration guide
- Figma sync instructions
- Component styling guide

---

## DIRECTORY STRUCTURE

```
/src/design-system
├── tokens.ts           # TypeScript design tokens
├── tokens.css          # CSS custom properties
├── ThemeProvider.tsx   # Theme context provider
├── index.ts            # Barrel export
└── README.md           # Documentation

/scripts
└── sync-figma.ts       # Figma sync script

/figma-tokens.json      # Exported from Figma (Tokens Studio)
```

---

## USAGE

```typescript
// Import tokens
import { palette, typography, spacing } from '@/design-system/tokens';

// Use in component
<div style={{ color: palette.primary[500], padding: spacing[4] }}>

// Or use CSS variables
<div className="bg-primary text-primary-foreground">

// Or use Tailwind classes
<div className="bg-bg-primary text-text-primary">

// Theme switching
import { useTheme } from '@/design-system';
const { theme, setTheme } = useTheme();
```

---

Now create all files with the configuration values filled in. Make sure CSS variables, TypeScript tokens, and Tailwind config are all synchronized.
```
