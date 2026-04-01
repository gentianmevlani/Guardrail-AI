#!/usr/bin/env ts-node
/**
 * Figma Tokens Sync Script for Paradox Wallet
 * 
 * Syncs design tokens exported from Figma (via Tokens Studio plugin)
 * to the Paradox design system files.
 * 
 * Usage:
 *   npm run sync:figma
 *   npm run sync:figma -- --dry-run
 *   npm run sync:figma -- --watch
 * 
 * Setup:
 *   1. Install Tokens Studio plugin in Figma
 *   2. Define your tokens in the plugin
 *   3. Export as JSON to ./figma-tokens.json
 *   4. Run this script
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Input: Figma tokens JSON export
  figmaTokensPath: './figma-tokens.json',
  
  // Output files
  outputPaths: {
    tokens: './src/design-system/tokens.ts',
    tailwind: './tailwind.config.ts',
    globalsCss: './src/styles/globals.css',
    designSystemCss: './src/design-system/globals.css',
  },
  
  // Backup directory
  backupDir: './backups/design-system',
};

// ============================================
// TYPES
// ============================================

interface FigmaTokens {
  colors?: Record<string, string>;
  typography?: {
    fontFamilies?: Record<string, string>;
    fontSizes?: Record<string, string | number>;
    fontWeights?: Record<string, number>;
    lineHeights?: Record<string, number>;
    letterSpacing?: Record<string, string>;
  };
  spacing?: Record<string, string | number>;
  borderRadius?: Record<string, string | number>;
  effects?: {
    blur?: Record<string, string | number>;
    shadows?: Record<string, string>;
  };
  // Tokens Studio format
  global?: Record<string, any>;
  degen?: Record<string, any>;
  regen?: Record<string, any>;
}

interface ParsedTokens {
  palette: {
    white: string;
    black: string;
    degen: {
      primary: string;
      secondary: string;
      tertiary: string;
      dark: string;
      darker: string;
      darkest: string;
    };
    regen: {
      primary: string;
      secondary: string;
      tertiary: string;
      dark: string;
      darker: string;
      darkest: string;
    };
  };
  colors: {
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
      overlay: string;
      glass: {
        subtle: string;
        medium: string;
        strong: string;
      };
    };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      muted: string;
    };
    border: {
      subtle: string;
      normal: string;
      strong: string;
      focus: string;
    };
  };
  typography: {
    fontFamily: {
      primary: string;
      mono: string;
      system: string;
    };
    fontSize: Record<string, string>;
    fontWeight: Record<string, number>;
    lineHeight: Record<string, number>;
    letterSpacing: Record<string, string>;
  };
  spacing: Record<string, string>;
  radius: Record<string, string>;
  blur: Record<string, string>;
  shadows: Record<string, string>;
  transitions: {
    duration: Record<string, string>;
    easing: Record<string, string>;
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createBackup(filePath: string): void {
  if (fs.existsSync(filePath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(
      CONFIG.backupDir,
      `${path.basename(filePath)}.${timestamp}.bak`
    );
    ensureDirectoryExists(backupPath);
    fs.copyFileSync(filePath, backupPath);
    console.log(`  📦 Backed up: ${path.basename(filePath)}`);
  }
}

function parseValue(value: any): string {
  if (typeof value === 'object' && value !== null) {
    // Handle Tokens Studio format: { value: "...", type: "..." }
    if (value.value !== undefined) {
      return String(value.value);
    }
  }
  return String(value);
}

function parseColor(value: any): string {
  const parsed = parseValue(value);
  // Handle references like {colors.degen.primary}
  if (parsed.startsWith('{') && parsed.endsWith('}')) {
    return parsed; // Will be resolved later
  }
  return parsed;
}

function resolveReferences(tokens: any, value: string): string {
  if (!value.startsWith('{') || !value.endsWith('}')) {
    return value;
  }
  
  const path = value.slice(1, -1).split('.');
  let current = tokens;
  
  for (const key of path) {
    if (current && current[key] !== undefined) {
      current = current[key];
    } else {
      return value; // Reference not found, return as-is
    }
  }
  
  return parseValue(current);
}

// ============================================
// TOKEN PARSERS
// ============================================

function parseTokensStudioFormat(raw: any): FigmaTokens {
  // Tokens Studio exports in a nested format
  // Flatten it for easier processing
  
  const flattened: FigmaTokens = {
    colors: {},
    typography: {
      fontFamilies: {},
      fontSizes: {},
      fontWeights: {},
      lineHeights: {},
      letterSpacing: {},
    },
    spacing: {},
    borderRadius: {},
    effects: {
      blur: {},
      shadows: {},
    },
  };
  
  function flattenObject(obj: any, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}-${key}` : key;
      
      if (value && typeof value === 'object') {
        if ('value' in value && 'type' in value) {
          // This is a token
          const type = (value as any).type;
          const tokenValue = parseValue(value);
          
          switch (type) {
            case 'color':
              flattened.colors![newKey] = tokenValue;
              break;
            case 'fontFamilies':
            case 'fontFamily':
              flattened.typography!.fontFamilies![newKey] = tokenValue;
              break;
            case 'fontSizes':
            case 'fontSize':
              flattened.typography!.fontSizes![newKey] = tokenValue;
              break;
            case 'fontWeights':
            case 'fontWeight':
              flattened.typography!.fontWeights![newKey] = Number(tokenValue);
              break;
            case 'lineHeights':
            case 'lineHeight':
              flattened.typography!.lineHeights![newKey] = Number(tokenValue);
              break;
            case 'letterSpacing':
              flattened.typography!.letterSpacing![newKey] = tokenValue;
              break;
            case 'spacing':
            case 'dimension':
              flattened.spacing![newKey] = tokenValue;
              break;
            case 'borderRadius':
              flattened.borderRadius![newKey] = tokenValue;
              break;
            case 'boxShadow':
              flattened.effects!.shadows![newKey] = tokenValue;
              break;
            default:
              // Store in most likely category based on key name
              if (newKey.includes('color') || newKey.includes('bg') || newKey.includes('text')) {
                flattened.colors![newKey] = tokenValue;
              } else if (newKey.includes('spacing') || newKey.includes('space')) {
                flattened.spacing![newKey] = tokenValue;
              } else if (newKey.includes('radius')) {
                flattened.borderRadius![newKey] = tokenValue;
              }
          }
        } else {
          // Nested object, recurse
          flattenObject(value, newKey);
        }
      }
    }
  }
  
  flattenObject(raw);
  return flattened;
}

function transformToParadoxTokens(figma: FigmaTokens): ParsedTokens {
  const colors = figma.colors || {};
  const typography = figma.typography || {};
  const spacing = figma.spacing || {};
  const borderRadius = figma.borderRadius || {};
  const effects = figma.effects || {};
  
  // Helper to get color with fallback
  const getColor = (key: string, fallback: string): string => {
    // Try various key formats
    const variations = [
      key,
      key.replace(/-/g, '.'),
      key.replace(/\./g, '-'),
      key.toLowerCase(),
      key.replace('degen-', 'degen.'),
      key.replace('regen-', 'regen.'),
    ];
    
    for (const v of variations) {
      if (colors[v]) return colors[v];
    }
    return fallback;
  };
  
  return {
    palette: {
      white: getColor('white', '#ffffff'),
      black: getColor('black', '#000000'),
      degen: {
        primary: getColor('degen-primary', '#ff3366'),
        secondary: getColor('degen-secondary', '#ff9500'),
        tertiary: getColor('degen-tertiary', '#ff6b6b'),
        dark: getColor('degen-dark', '#cc0000'),
        darker: getColor('degen-darker', '#990000'),
        darkest: getColor('degen-darkest', '#660000'),
      },
      regen: {
        primary: getColor('regen-primary', '#00d4ff'),
        secondary: getColor('regen-secondary', '#00ff88'),
        tertiary: getColor('regen-tertiary', '#00aaff'),
        dark: getColor('regen-dark', '#0066cc'),
        darker: getColor('regen-darker', '#004099'),
        darkest: getColor('regen-darkest', '#003366'),
      },
    },
    colors: {
      background: {
        primary: getColor('bg-primary', 'rgba(0, 0, 0, 0.95)'),
        secondary: getColor('bg-secondary', 'rgba(0, 0, 0, 0.8)'),
        tertiary: getColor('bg-tertiary', 'rgba(0, 0, 0, 0.4)'),
        overlay: getColor('bg-overlay', 'rgba(0, 0, 0, 0.7)'),
        glass: {
          subtle: getColor('bg-glass-subtle', 'rgba(0, 0, 0, 0.4)'),
          medium: getColor('bg-glass-medium', 'rgba(0, 0, 0, 0.6)'),
          strong: getColor('bg-glass-strong', 'rgba(0, 0, 0, 0.8)'),
        },
      },
      text: {
        primary: getColor('text-primary', '#ffffff'),
        secondary: getColor('text-secondary', 'rgba(255, 255, 255, 0.7)'),
        tertiary: getColor('text-tertiary', 'rgba(255, 255, 255, 0.6)'),
        muted: getColor('text-muted', 'rgba(255, 255, 255, 0.4)'),
      },
      border: {
        subtle: getColor('border-subtle', 'rgba(255, 255, 255, 0.1)'),
        normal: getColor('border-normal', 'rgba(255, 255, 255, 0.2)'),
        strong: getColor('border-strong', 'rgba(255, 255, 255, 0.3)'),
        focus: getColor('border-focus', 'rgba(255, 255, 255, 0.5)'),
      },
    },
    typography: {
      fontFamily: {
        primary: typography.fontFamilies?.['primary'] || "'Rajdhani', sans-serif",
        mono: typography.fontFamilies?.['mono'] || 'monospace',
        system: typography.fontFamilies?.['system'] || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      fontSize: {
        hero: typography.fontSizes?.['hero'] as string || 'clamp(48px, 10vw, 120px)',
        title: typography.fontSizes?.['title'] as string || 'clamp(32px, 5vw, 48px)',
        heading: typography.fontSizes?.['heading'] as string || 'clamp(24px, 4vw, 42px)',
        subheading: typography.fontSizes?.['subheading'] as string || 'clamp(20px, 2vw, 28px)',
        body: typography.fontSizes?.['body'] as string || 'clamp(14px, 2vw, 18px)',
        small: typography.fontSizes?.['small'] as string || 'clamp(12px, 2vw, 14px)',
        xs: typography.fontSizes?.['xs'] as string || '12px',
      },
      fontWeight: {
        black: typography.fontWeights?.['black'] || 900,
        extrabold: typography.fontWeights?.['extrabold'] || 800,
        bold: typography.fontWeights?.['bold'] || 700,
        semibold: typography.fontWeights?.['semibold'] || 600,
        medium: typography.fontWeights?.['medium'] || 500,
        normal: typography.fontWeights?.['normal'] || 400,
      },
      lineHeight: {
        tight: typography.lineHeights?.['tight'] || 0.9,
        snug: typography.lineHeights?.['snug'] || 1.3,
        normal: typography.lineHeights?.['normal'] || 1.5,
        relaxed: typography.lineHeights?.['relaxed'] || 1.8,
      },
      letterSpacing: {
        tighter: typography.letterSpacing?.['tighter'] || '-0.02em',
        tight: typography.letterSpacing?.['tight'] || '-0.01em',
        normal: typography.letterSpacing?.['normal'] || '0em',
        wide: typography.letterSpacing?.['wide'] || '0.05em',
        wider: typography.letterSpacing?.['wider'] || '0.1em',
        widest: typography.letterSpacing?.['widest'] || '0.2em',
      },
    },
    spacing: {
      px: spacing['px'] as string || '1px',
      '0': spacing['0'] as string || '0',
      '1': spacing['1'] as string || '4px',
      '2': spacing['2'] as string || '8px',
      '3': spacing['3'] as string || '12px',
      '4': spacing['4'] as string || '16px',
      '5': spacing['5'] as string || '20px',
      '6': spacing['6'] as string || '24px',
      '8': spacing['8'] as string || '32px',
      '10': spacing['10'] as string || '40px',
      '12': spacing['12'] as string || '48px',
      '16': spacing['16'] as string || '64px',
      '20': spacing['20'] as string || '80px',
      '24': spacing['24'] as string || '96px',
    },
    radius: {
      none: borderRadius['none'] as string || '0',
      sm: borderRadius['sm'] as string || '8px',
      md: borderRadius['md'] as string || '12px',
      lg: borderRadius['lg'] as string || '16px',
      xl: borderRadius['xl'] as string || '24px',
      '2xl': borderRadius['2xl'] as string || '32px',
      '3xl': borderRadius['3xl'] as string || '40px',
      full: borderRadius['full'] as string || '9999px',
    },
    blur: {
      none: '0',
      sm: effects.blur?.['sm'] as string || '10px',
      md: effects.blur?.['md'] as string || '20px',
      lg: effects.blur?.['lg'] as string || '40px',
      xl: effects.blur?.['xl'] as string || '100px',
    },
    shadows: {
      sm: effects.shadows?.['sm'] || '0 10px 30px rgba(0, 0, 0, 0.3)',
      md: effects.shadows?.['md'] || '0 20px 60px rgba(0, 0, 0, 0.5)',
      lg: effects.shadows?.['lg'] || '0 20px 60px rgba(0, 0, 0, 0.9)',
    },
    transitions: {
      duration: {
        fast: '200ms',
        normal: '300ms',
        slow: '700ms',
        slower: '1000ms',
      },
      easing: {
        default: 'ease',
        in: 'ease-in',
        out: 'ease-out',
        inOut: 'ease-in-out',
      },
    },
  };
}

// ============================================
// FILE GENERATORS
// ============================================

function generateTokensTs(tokens: ParsedTokens): string {
  const timestamp = new Date().toISOString();
  
  return `/**
 * Paradox Wallet Design System Tokens
 * 
 * ⚠️  AUTO-GENERATED FROM FIGMA - DO NOT EDIT MANUALLY
 * 
 * Last synced: ${timestamp}
 * Source: figma-tokens.json (exported from Tokens Studio)
 * 
 * To update: npm run sync:figma
 */

// ============================================
// CORE COLOR PALETTE
// ============================================

export const palette = {
  white: '${tokens.palette.white}',
  black: '${tokens.palette.black}',
  
  degen: {
    primary: '${tokens.palette.degen.primary}',
    secondary: '${tokens.palette.degen.secondary}',
    tertiary: '${tokens.palette.degen.tertiary}',
    dark: '${tokens.palette.degen.dark}',
    darker: '${tokens.palette.degen.darker}',
    darkest: '${tokens.palette.degen.darkest}',
  },
  
  regen: {
    primary: '${tokens.palette.regen.primary}',
    secondary: '${tokens.palette.regen.secondary}',
    tertiary: '${tokens.palette.regen.tertiary}',
    dark: '${tokens.palette.regen.dark}',
    darker: '${tokens.palette.regen.darker}',
    darkest: '${tokens.palette.regen.darkest}',
  },
  
  neutral: {
    50: 'rgba(255, 255, 255, 0.05)',
    100: 'rgba(255, 255, 255, 0.1)',
    200: 'rgba(255, 255, 255, 0.2)',
    300: 'rgba(255, 255, 255, 0.3)',
    400: 'rgba(255, 255, 255, 0.4)',
    500: 'rgba(255, 255, 255, 0.5)',
    600: 'rgba(255, 255, 255, 0.6)',
    700: 'rgba(255, 255, 255, 0.7)',
    800: 'rgba(255, 255, 255, 0.8)',
    900: 'rgba(255, 255, 255, 0.9)',
  },
} as const;

// ============================================
// SEMANTIC COLOR TOKENS
// ============================================

export const colors = {
  background: {
    primary: '${tokens.colors.background.primary}',
    secondary: '${tokens.colors.background.secondary}',
    tertiary: '${tokens.colors.background.tertiary}',
    overlay: '${tokens.colors.background.overlay}',
    glass: {
      subtle: '${tokens.colors.background.glass.subtle}',
      medium: '${tokens.colors.background.glass.medium}',
      strong: '${tokens.colors.background.glass.strong}',
    },
  },
  
  text: {
    primary: '${tokens.colors.text.primary}',
    secondary: '${tokens.colors.text.secondary}',
    tertiary: '${tokens.colors.text.tertiary}',
    muted: '${tokens.colors.text.muted}',
    inverse: palette.black,
  },
  
  border: {
    subtle: '${tokens.colors.border.subtle}',
    normal: '${tokens.colors.border.normal}',
    strong: '${tokens.colors.border.strong}',
    focus: '${tokens.colors.border.focus}',
  },
  
  surface: {
    base: '${tokens.colors.background.primary}',
    elevated: '${tokens.colors.background.secondary}',
    overlay: 'rgba(255, 255, 255, 0.05)',
    hover: 'rgba(255, 255, 255, 0.1)',
  },
  
  interactive: {
    hover: 'rgba(255, 255, 255, 0.1)',
    active: 'rgba(255, 255, 255, 0.15)',
    disabled: 'rgba(255, 255, 255, 0.05)',
  },
} as const;

// ============================================
// MODE-SPECIFIC ACCENT TOKENS
// ============================================

export const modeColors = {
  degen: {
    accent: {
      primary: palette.degen.primary,
      secondary: palette.degen.secondary,
      tertiary: palette.degen.tertiary,
    },
    
    background: {
      subtle: 'rgba(255, 51, 102, 0.05)',
      light: 'rgba(255, 51, 102, 0.1)',
      medium: 'rgba(255, 51, 102, 0.15)',
      strong: 'rgba(255, 51, 102, 0.2)',
    },
    
    border: {
      subtle: 'rgba(255, 51, 102, 0.2)',
      normal: 'rgba(255, 51, 102, 0.4)',
      strong: 'rgba(255, 51, 102, 0.6)',
      solid: palette.degen.primary,
    },
    
    glow: {
      subtle: 'rgba(255, 51, 102, 0.2)',
      normal: 'rgba(255, 51, 102, 0.4)',
      strong: 'rgba(255, 51, 102, 0.8)',
    },
    
    gradient: {
      primary: \`linear-gradient(90deg, \${palette.degen.primary}, \${palette.degen.secondary})\`,
      button: \`linear-gradient(135deg, \${palette.degen.primary}, \${palette.degen.tertiary}, \${palette.degen.primary})\`,
      background: 'linear-gradient(135deg, rgba(255, 51, 102, 0.1), rgba(255, 107, 107, 0.05))',
      radial: 'radial-gradient(circle at top left, rgba(255, 51, 102, 0.15) 0%, rgba(0, 0, 0, 0.95) 50%)',
    },
  },
  
  regen: {
    accent: {
      primary: palette.regen.primary,
      secondary: palette.regen.secondary,
      tertiary: palette.regen.tertiary,
    },
    
    background: {
      subtle: 'rgba(0, 212, 255, 0.05)',
      light: 'rgba(0, 212, 255, 0.1)',
      medium: 'rgba(0, 212, 255, 0.15)',
      strong: 'rgba(0, 212, 255, 0.2)',
    },
    
    border: {
      subtle: 'rgba(0, 212, 255, 0.2)',
      normal: 'rgba(0, 212, 255, 0.4)',
      strong: 'rgba(0, 212, 255, 0.6)',
      solid: palette.regen.primary,
    },
    
    glow: {
      subtle: 'rgba(0, 212, 255, 0.2)',
      normal: 'rgba(0, 212, 255, 0.4)',
      strong: 'rgba(0, 212, 255, 0.8)',
    },
    
    gradient: {
      primary: \`linear-gradient(90deg, \${palette.regen.primary}, \${palette.regen.secondary})\`,
      button: \`linear-gradient(135deg, \${palette.regen.primary}, \${palette.regen.secondary}, \${palette.regen.primary})\`,
      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 255, 136, 0.05))',
      radial: 'radial-gradient(circle at top right, rgba(0, 212, 255, 0.15) 0%, rgba(0, 0, 0, 0.95) 50%)',
    },
  },
} as const;

// ============================================
// TYPOGRAPHY TOKENS
// ============================================

export const typography = {
  fontFamily: {
    primary: "${tokens.typography.fontFamily.primary}",
    mono: '${tokens.typography.fontFamily.mono}',
    system: '${tokens.typography.fontFamily.system}',
  },
  
  fontSize: {
    hero: '${tokens.typography.fontSize.hero}',
    title: '${tokens.typography.fontSize.title}',
    heading: '${tokens.typography.fontSize.heading}',
    subheading: '${tokens.typography.fontSize.subheading}',
    body: '${tokens.typography.fontSize.body}',
    small: '${tokens.typography.fontSize.small}',
    xs: '${tokens.typography.fontSize.xs}',
    
    fixed: {
      '72': '72px',
      '48': '48px',
      '32': '32px',
      '28': '28px',
      '24': '24px',
      '20': '20px',
      '18': '18px',
      '16': '16px',
      '14': '14px',
      '12': '12px',
    },
  },
  
  fontWeight: {
    black: ${tokens.typography.fontWeight.black},
    extrabold: ${tokens.typography.fontWeight.extrabold},
    bold: ${tokens.typography.fontWeight.bold},
    semibold: ${tokens.typography.fontWeight.semibold},
    medium: ${tokens.typography.fontWeight.medium},
    normal: ${tokens.typography.fontWeight.normal},
  },
  
  lineHeight: {
    tight: ${tokens.typography.lineHeight.tight},
    snug: ${tokens.typography.lineHeight.snug},
    normal: ${tokens.typography.lineHeight.normal},
    relaxed: ${tokens.typography.lineHeight.relaxed},
  },
  
  letterSpacing: {
    tighter: '${tokens.typography.letterSpacing.tighter}',
    tight: '${tokens.typography.letterSpacing.tight}',
    normal: '${tokens.typography.letterSpacing.normal}',
    wide: '${tokens.typography.letterSpacing.wide}',
    wider: '${tokens.typography.letterSpacing.wider}',
    widest: '${tokens.typography.letterSpacing.widest}',
  },
} as const;

// ============================================
// SPACING TOKENS
// ============================================

export const spacing = {
  px: '${tokens.spacing.px}',
  0: '${tokens.spacing['0']}',
  1: '${tokens.spacing['1']}',
  2: '${tokens.spacing['2']}',
  3: '${tokens.spacing['3']}',
  4: '${tokens.spacing['4']}',
  5: '${tokens.spacing['5']}',
  6: '${tokens.spacing['6']}',
  8: '${tokens.spacing['8']}',
  10: '${tokens.spacing['10']}',
  12: '${tokens.spacing['12']}',
  16: '${tokens.spacing['16']}',
  20: '${tokens.spacing['20']}',
  24: '${tokens.spacing['24']}',
  
  button: {
    sm: '8px 16px',
    md: '12px 16px',
    lg: '16px 32px',
    xl: '16px 48px',
  },
  
  card: {
    sm: '16px',
    md: '24px',
    lg: '32px',
  },
  
  section: {
    sm: '32px',
    md: '48px',
    lg: '64px',
    xl: '96px',
  },
} as const;

// ============================================
// BORDER RADIUS TOKENS
// ============================================

export const radius = {
  none: '${tokens.radius.none}',
  sm: '${tokens.radius.sm}',
  md: '${tokens.radius.md}',
  lg: '${tokens.radius.lg}',
  xl: '${tokens.radius.xl}',
  '2xl': '${tokens.radius['2xl']}',
  '3xl': '${tokens.radius['3xl']}',
  full: '${tokens.radius.full}',
  
  card: '24px',
  tunnel: '40px',
} as const;

// ============================================
// SHADOW TOKENS
// ============================================

export const shadows = {
  sm: '${tokens.shadows.sm}',
  md: '${tokens.shadows.md}',
  lg: '${tokens.shadows.lg}',
  
  elevated: '-10px 0 40px rgba(0, 0, 0, 0.5)',
  
  glow: {
    degen: {
      sm: \`0 0 20px \${modeColors.degen.glow.subtle}\`,
      md: \`0 0 40px \${modeColors.degen.glow.normal}\`,
      lg: \`0 0 60px \${modeColors.degen.glow.normal}\`,
      xl: \`0 0 80px \${modeColors.degen.glow.normal}\`,
      elevated: \`0 20px 60px \${modeColors.degen.glow.normal}\`,
      tunnel: '0 0 60px 5px rgba(255, 50, 50, 0.7), inset 0 0 40px rgba(255, 50, 50, 0.1)',
    },
    regen: {
      sm: \`0 0 20px \${modeColors.regen.glow.subtle}\`,
      md: \`0 0 40px \${modeColors.regen.glow.normal}\`,
      lg: \`0 0 60px \${modeColors.regen.glow.normal}\`,
      xl: \`0 0 80px \${modeColors.regen.glow.normal}\`,
      elevated: \`0 20px 60px \${modeColors.regen.glow.normal}\`,
      tunnel: '0 0 60px 5px rgba(0, 150, 255, 0.7), inset 0 0 40px rgba(0, 150, 255, 0.1)',
    },
  },
  
  text: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3)',
    glow: '0 0 80px rgba(255, 255, 255, 0.3)',
  },
} as const;

// ============================================
// BLUR TOKENS
// ============================================

export const blur = {
  none: '${tokens.blur.none}',
  sm: '${tokens.blur.sm}',
  md: '${tokens.blur.md}',
  lg: '${tokens.blur.lg}',
  xl: '${tokens.blur.xl}',
} as const;

// ============================================
// TRANSITION TOKENS
// ============================================

export const transitions = {
  duration: {
    fast: '${tokens.transitions.duration.fast}',
    normal: '${tokens.transitions.duration.normal}',
    slow: '${tokens.transitions.duration.slow}',
    slower: '${tokens.transitions.duration.slower}',
  },
  
  easing: {
    default: '${tokens.transitions.easing.default}',
    in: '${tokens.transitions.easing.in}',
    out: '${tokens.transitions.easing.out}',
    inOut: '${tokens.transitions.easing.inOut}',
  },
  
  all: 'all 300ms ease',
  colors: 'background-color 300ms ease, border-color 300ms ease, color 300ms ease',
  transform: 'transform 300ms ease',
} as const;

// ============================================
// Z-INDEX TOKENS
// ============================================

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  notification: 80,
} as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

export type Mode = 'degen' | 'regen';
export type GlowSize = 'sm' | 'md' | 'lg' | 'xl' | 'elevated' | 'tunnel';
export type GradientType = keyof typeof modeColors.degen.gradient;

export const getAccentColor = (
  mode: Mode,
  variant: 'primary' | 'secondary' | 'tertiary' = 'primary'
): string => {
  return modeColors[mode].accent[variant];
};

export const getGradient = (
  mode: Mode,
  type: GradientType
): string => {
  return modeColors[mode].gradient[type];
};

export const getGlow = (
  mode: Mode,
  size: GlowSize
): string => {
  return shadows.glow[mode][size];
};

export const getBackground = (
  mode: Mode,
  intensity: 'subtle' | 'light' | 'medium' | 'strong'
): string => {
  return modeColors[mode].background[intensity];
};

export const getBorder = (
  mode: Mode,
  intensity: 'subtle' | 'normal' | 'strong' | 'solid'
): string => {
  return modeColors[mode].border[intensity];
};
`;
}

function generateGlobalsCss(tokens: ParsedTokens): string {
  const timestamp = new Date().toISOString();
  
  return `/**
 * Paradox Wallet Global Styles
 * 
 * ⚠️  AUTO-GENERATED FROM FIGMA - DO NOT EDIT MANUALLY
 * 
 * Last synced: ${timestamp}
 * Source: figma-tokens.json (exported from Tokens Studio)
 * 
 * To update: npm run sync:figma
 */

/* ============================================ */
/* CSS CUSTOM PROPERTIES                        */
/* ============================================ */

:root {
  /* Base colors */
  --color-white: ${tokens.palette.white};
  --color-black: ${tokens.palette.black};
  
  /* Degen palette */
  --degen-primary: ${tokens.palette.degen.primary};
  --degen-secondary: ${tokens.palette.degen.secondary};
  --degen-tertiary: ${tokens.palette.degen.tertiary};
  
  /* Regen palette */
  --regen-primary: ${tokens.palette.regen.primary};
  --regen-secondary: ${tokens.palette.regen.secondary};
  --regen-tertiary: ${tokens.palette.regen.tertiary};
  
  /* Background tokens */
  --bg-primary: ${tokens.colors.background.primary};
  --bg-secondary: ${tokens.colors.background.secondary};
  --bg-tertiary: ${tokens.colors.background.tertiary};
  --bg-overlay: ${tokens.colors.background.overlay};
  
  /* Glass background tokens */
  --bg-glass-subtle: ${tokens.colors.background.glass.subtle};
  --bg-glass-medium: ${tokens.colors.background.glass.medium};
  --bg-glass-strong: ${tokens.colors.background.glass.strong};
  
  /* Text tokens */
  --text-primary: ${tokens.colors.text.primary};
  --text-secondary: ${tokens.colors.text.secondary};
  --text-tertiary: ${tokens.colors.text.tertiary};
  --text-muted: ${tokens.colors.text.muted};
  
  /* Border tokens */
  --border-subtle: ${tokens.colors.border.subtle};
  --border-normal: ${tokens.colors.border.normal};
  --border-strong: ${tokens.colors.border.strong};
  --border-focus: ${tokens.colors.border.focus};
  
  /* Interactive states */
  --state-hover: rgba(255, 255, 255, 0.1);
  --state-active: rgba(255, 255, 255, 0.15);
  --state-disabled: rgba(255, 255, 255, 0.05);
  
  /* Typography */
  --font-primary: ${tokens.typography.fontFamily.primary};
  --font-mono: ${tokens.typography.fontFamily.mono};
  
  /* Spacing */
  --spacing-card: ${tokens.spacing['6']};
  --spacing-section: ${tokens.spacing['12']};
  
  /* Border radius */
  --radius-sm: ${tokens.radius.sm};
  --radius-md: ${tokens.radius.md};
  --radius-lg: ${tokens.radius.lg};
  --radius-xl: ${tokens.radius.xl};
  --radius-2xl: ${tokens.radius['2xl']};
  --radius-full: ${tokens.radius.full};
  
  /* Blur */
  --blur-sm: ${tokens.blur.sm};
  --blur-md: ${tokens.blur.md};
  --blur-lg: ${tokens.blur.lg};
  
  /* Transitions */
  --transition-fast: ${tokens.transitions.duration.fast};
  --transition-normal: ${tokens.transitions.duration.normal};
  --transition-slow: ${tokens.transitions.duration.slow};
  
  /* Shadows */
  --shadow-sm: ${tokens.shadows.sm};
  --shadow-md: ${tokens.shadows.md};
  --shadow-lg: ${tokens.shadows.lg};
}

/* Mode-specific custom properties */
[data-mode="degen"] {
  --accent-primary: var(--degen-primary);
  --accent-secondary: var(--degen-secondary);
  --accent-tertiary: var(--degen-tertiary);
  
  --accent-bg-subtle: rgba(255, 51, 102, 0.05);
  --accent-bg-light: rgba(255, 51, 102, 0.1);
  --accent-bg-medium: rgba(255, 51, 102, 0.15);
  --accent-bg-strong: rgba(255, 51, 102, 0.2);
  
  --accent-border-subtle: rgba(255, 51, 102, 0.2);
  --accent-border-normal: rgba(255, 51, 102, 0.4);
  --accent-border-strong: rgba(255, 51, 102, 0.6);
  
  --glow-color: rgba(255, 51, 102, 0.4);
  --glow-sm: 0 0 20px rgba(255, 51, 102, 0.2);
  --glow-md: 0 0 40px rgba(255, 51, 102, 0.4);
  --glow-lg: 0 0 60px rgba(255, 51, 102, 0.4);
}

[data-mode="regen"] {
  --accent-primary: var(--regen-primary);
  --accent-secondary: var(--regen-secondary);
  --accent-tertiary: var(--regen-tertiary);
  
  --accent-bg-subtle: rgba(0, 212, 255, 0.05);
  --accent-bg-light: rgba(0, 212, 255, 0.1);
  --accent-bg-medium: rgba(0, 212, 255, 0.15);
  --accent-bg-strong: rgba(0, 212, 255, 0.2);
  
  --accent-border-subtle: rgba(0, 212, 255, 0.2);
  --accent-border-normal: rgba(0, 212, 255, 0.4);
  --accent-border-strong: rgba(0, 212, 255, 0.6);
  
  --glow-color: rgba(0, 212, 255, 0.4);
  --glow-sm: 0 0 20px rgba(0, 212, 255, 0.2);
  --glow-md: 0 0 40px rgba(0, 212, 255, 0.4);
  --glow-lg: 0 0 60px rgba(0, 212, 255, 0.4);
}

/* ============================================ */
/* BASE STYLES                                  */
/* ============================================ */

* {
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--font-primary);
  background-color: var(--color-black);
  color: var(--text-primary);
  overflow-x: hidden;
}

/* ============================================ */
/* GLASSMORPHISM UTILITY CLASSES               */
/* ============================================ */

.glass-subtle {
  background-color: var(--bg-glass-subtle);
  backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--border-subtle);
}

.glass-medium {
  background-color: var(--bg-glass-medium);
  backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--border-subtle);
}

.glass-strong {
  background-color: var(--bg-glass-strong);
  backdrop-filter: blur(var(--blur-lg));
  border: 1px solid var(--border-normal);
}

.glass-accent {
  background-color: var(--bg-glass-subtle);
  backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--accent-border-normal);
}

.glass-card {
  background-color: var(--bg-glass-medium);
  backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--spacing-card);
  transition: all var(--transition-normal) ease;
}

.glass-card:hover {
  background-color: var(--bg-glass-strong);
  border-color: var(--border-normal);
}

/* ============================================ */
/* BUTTON UTILITY CLASSES                      */
/* ============================================ */

.btn-base {
  font-family: var(--font-primary);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-radius: var(--radius-full);
  transition: all var(--transition-normal) ease;
  cursor: pointer;
  border: none;
  outline: none;
}

.btn-primary {
  background-color: var(--accent-primary);
  color: var(--color-white);
  padding: 12px 32px;
  box-shadow: var(--glow-md);
}

.btn-primary:hover {
  transform: scale(1.05);
  box-shadow: var(--glow-lg);
}

.btn-secondary {
  background-color: transparent;
  color: var(--accent-primary);
  border: 2px solid var(--accent-primary);
  padding: 10px 30px;
}

.btn-secondary:hover {
  background-color: var(--accent-bg-light);
  transform: scale(1.05);
}

.btn-ghost {
  background-color: var(--state-hover);
  color: var(--text-primary);
  padding: 12px 32px;
  border: 1px solid var(--border-subtle);
}

.btn-ghost:hover {
  background-color: var(--state-active);
  border-color: var(--border-normal);
}

/* ============================================ */
/* TEXT UTILITY CLASSES                        */
/* ============================================ */

.text-gradient {
  background: linear-gradient(135deg, var(--regen-primary) 0%, var(--color-white) 50%, var(--degen-primary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.text-glow {
  text-shadow: 0 0 80px rgba(255, 255, 255, 0.3);
}

.text-3d-degen {
  text-shadow: 
    0 0 60px rgba(255, 51, 102, 0.5),
    0 1px 0 #cc0000,
    0 2px 0 #990000,
    0 3px 0 #660000,
    0 4px 0 #330000,
    0 5px 0 #1a0000,
    0 6px 1px rgba(0, 0, 0, 0.3),
    0 8px 3px rgba(0, 0, 0, 0.3),
    0 12px 12px rgba(0, 0, 0, 0.4),
    0 20px 30px rgba(0, 0, 0, 0.5);
}

.text-3d-regen {
  text-shadow: 
    0 0 60px rgba(0, 212, 255, 0.5),
    0 1px 0 #0052cc,
    0 2px 0 #004099,
    0 3px 0 #003366,
    0 4px 0 #002033,
    0 5px 0 #001019,
    0 6px 1px rgba(0, 0, 0, 0.3),
    0 8px 3px rgba(0, 0, 0, 0.3),
    0 12px 12px rgba(0, 0, 0, 0.4),
    0 20px 30px rgba(0, 0, 0, 0.5);
}

/* ============================================ */
/* ANIMATION UTILITY CLASSES                   */
/* ============================================ */

@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: var(--glow-md); }
  50% { box-shadow: var(--glow-lg); }
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

.fade-in {
  animation: fadeIn var(--transition-normal) ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.slide-up {
  animation: slideUp var(--transition-normal) ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ============================================ */
/* LAYOUT UTILITY CLASSES                      */
/* ============================================ */

.container-center {
  max-width: 1280px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 24px;
  padding-right: 24px;
}

.section-spacing {
  padding-top: var(--spacing-section);
  padding-bottom: var(--spacing-section);
}

/* ============================================ */
/* ACCESSIBILITY                                */
/* ============================================ */

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

*:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* ============================================ */
/* SCROLLBAR STYLING                           */
/* ============================================ */

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent-primary);
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) var(--bg-secondary);
}
`;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  console.log('');
  console.log('🎨 Paradox Design System - Figma Token Sync');
  console.log('============================================');
  console.log('');
  
  // Check if figma-tokens.json exists
  if (!fs.existsSync(CONFIG.figmaTokensPath)) {
    console.error('❌ Error: figma-tokens.json not found');
    console.log('');
    console.log('To create it:');
    console.log('  1. Open Figma');
    console.log('  2. Open Tokens Studio plugin');
    console.log('  3. Export tokens as JSON');
    console.log('  4. Save as ./figma-tokens.json');
    console.log('');
    process.exit(1);
  }
  
  console.log('📖 Reading figma-tokens.json...');
  const rawTokens = JSON.parse(fs.readFileSync(CONFIG.figmaTokensPath, 'utf-8'));
  
  console.log('🔄 Parsing Tokens Studio format...');
  const figmaTokens = parseTokensStudioFormat(rawTokens);
  
  console.log('🔀 Transforming to Paradox tokens...');
  const paradoxTokens = transformToParadoxTokens(figmaTokens);
  
  if (dryRun) {
    console.log('');
    console.log('🔍 DRY RUN - No files will be modified');
    console.log('');
    console.log('Parsed tokens:');
    console.log(JSON.stringify(paradoxTokens, null, 2));
    return;
  }
  
  console.log('');
  console.log('📦 Creating backups...');
  Object.values(CONFIG.outputPaths).forEach(createBackup);
  
  console.log('');
  console.log('📝 Generating files...');
  
  // Generate tokens.ts
  console.log('  → tokens.ts');
  const tokensTs = generateTokensTs(paradoxTokens);
  ensureDirectoryExists(CONFIG.outputPaths.tokens);
  fs.writeFileSync(CONFIG.outputPaths.tokens, tokensTs);
  
  // Generate globals.css
  console.log('  → globals.css');
  const globalsCss = generateGlobalsCss(paradoxTokens);
  ensureDirectoryExists(CONFIG.outputPaths.designSystemCss);
  fs.writeFileSync(CONFIG.outputPaths.designSystemCss, globalsCss);
  
  console.log('');
  console.log('✅ Sync complete!');
  console.log('');
  console.log('Files updated:');
  console.log('  • ' + CONFIG.outputPaths.tokens);
  console.log('  • ' + CONFIG.outputPaths.designSystemCss);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review the generated files');
  console.log('  2. Run your app to verify styling');
  console.log('  3. Commit the changes');
  console.log('');
}

main().catch(console.error);
