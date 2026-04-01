/**
 * Design System Builder
 * 
 * Makes it easy for non-coders to create and maintain consistent design systems
 * Prevents AI agents from drifting off and creating inconsistent designs
 */

export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    fontFamilyHeading: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

export interface DesignSystem {
  name: string;
  tokens: DesignTokens;
  locked: boolean; // Prevents AI from changing
}

// Pre-built design system themes
export const PREBUILT_THEMES: Record<string, DesignSystem> = {
  modern: {
    name: 'Modern',
    locked: true,
    tokens: {
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        accent: '#10B981',
        background: '#FFFFFF',
        surface: '#F9FAFB',
        text: '#111827',
        textSecondary: '#6B7280',
        border: '#E5E7EB',
        error: '#EF4444',
        warning: '#F59E0B',
        success: '#10B981',
        info: '#3B82F6',
      },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontFamilyHeading: 'Inter, system-ui, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
          '4xl': '2.25rem',
        },
        fontWeight: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700,
        },
        lineHeight: {
          tight: 1.25,
          normal: 1.5,
          relaxed: 1.75,
        },
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      borderRadius: {
        none: '0',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        full: '9999px',
      },
      shadows: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  dark: {
    name: 'Dark',
    locked: true,
    tokens: {
      colors: {
        primary: '#60A5FA',
        secondary: '#A78BFA',
        accent: '#34D399',
        background: '#111827',
        surface: '#1F2937',
        text: '#F9FAFB',
        textSecondary: '#9CA3AF',
        border: '#374151',
        error: '#F87171',
        warning: '#FBBF24',
        success: '#34D399',
        info: '#60A5FA',
      },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontFamilyHeading: 'Inter, system-ui, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
          '4xl': '2.25rem',
        },
        fontWeight: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700,
        },
        lineHeight: {
          tight: 1.25,
          normal: 1.5,
          relaxed: 1.75,
        },
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      borderRadius: {
        none: '0',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        full: '9999px',
      },
      shadows: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  elegant: {
    name: 'Elegant',
    locked: true,
    tokens: {
      colors: {
        primary: '#6366F1',
        secondary: '#8B5CF6',
        accent: '#EC4899',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        text: '#0F172A',
        textSecondary: '#64748B',
        border: '#E2E8F0',
        error: '#F43F5E',
        warning: '#F59E0B',
        success: '#10B981',
        info: '#3B82F6',
      },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontFamilyHeading: 'Inter, system-ui, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
          '4xl': '2.25rem',
        },
        fontWeight: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700,
        },
        lineHeight: {
          tight: 1.25,
          normal: 1.5,
          relaxed: 1.75,
        },
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      borderRadius: {
        none: '0',
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        full: '9999px',
      },
      shadows: {
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    },
  },
};

class DesignSystemBuilder {
  private currentSystem: DesignSystem | null = null;

  /**
   * Select a pre-built theme
   */
  selectTheme(themeName: string): DesignSystem {
    const theme = PREBUILT_THEMES[themeName];
    if (!theme) {
      throw new Error(`Theme "${themeName}" not found`);
    }
    this.currentSystem = { ...theme };
    return this.currentSystem;
  }

  /**
   * Customize colors (for non-coders, simple color picker)
   */
  customizeColors(colors: Partial<DesignTokens['colors']>): void {
    if (!this.currentSystem) {
      throw new Error('No design system selected');
    }

    // Merge with existing colors
    this.currentSystem.tokens.colors = {
      ...this.currentSystem.tokens.colors,
      ...colors,
    };
  }

  /**
   * Get current design system
   */
  getCurrentSystem(): DesignSystem | null {
    return this.currentSystem;
  }

  /**
   * Lock design system (prevents AI from changing)
   */
  lock(): void {
    if (!this.currentSystem) {
      throw new Error('No design system selected');
    }
    this.currentSystem.locked = true;
  }

  /**
   * Generate CSS variables
   */
  generateCSSVariables(): string {
    if (!this.currentSystem) {
      throw new Error('No design system selected');
    }

    const tokens = this.currentSystem.tokens;
    let css = ':root {\n';

    // Colors
    Object.entries(tokens.colors).forEach(([key, value]) => {
      css += `  --color-${key}: ${value};\n`;
    });

    // Typography
    css += `  --font-family: ${tokens.typography.fontFamily};\n`;
    css += `  --font-family-heading: ${tokens.typography.fontFamilyHeading};\n`;
    Object.entries(tokens.typography.fontSize).forEach(([key, value]) => {
      css += `  --font-size-${key}: ${value};\n`;
    });
    Object.entries(tokens.typography.fontWeight).forEach(([key, value]) => {
      css += `  --font-weight-${key}: ${value};\n`;
    });
    Object.entries(tokens.typography.lineHeight).forEach(([key, value]) => {
      css += `  --line-height-${key}: ${value};\n`;
    });

    // Spacing
    Object.entries(tokens.spacing).forEach(([key, value]) => {
      css += `  --spacing-${key}: ${value};\n`;
    });

    // Border radius
    Object.entries(tokens.borderRadius).forEach(([key, value]) => {
      css += `  --radius-${key}: ${value};\n`;
    });

    // Shadows
    Object.entries(tokens.shadows).forEach(([key, value]) => {
      css += `  --shadow-${key}: ${value};\n`;
    });

    css += '}\n';
    return css;
  }

  /**
   * Generate Tailwind config
   */
  generateTailwindConfig(): string {
    if (!this.currentSystem) {
      throw new Error('No design system selected');
    }

    const tokens = this.currentSystem.tokens;
    const config = {
      theme: {
        extend: {
          colors: tokens.colors,
          fontFamily: {
            sans: tokens.typography.fontFamily.split(', '),
            heading: tokens.typography.fontFamilyHeading.split(', '),
          },
          fontSize: tokens.typography.fontSize,
          fontWeight: tokens.typography.fontWeight,
          lineHeight: tokens.typography.lineHeight,
          spacing: tokens.spacing,
          borderRadius: tokens.borderRadius,
          boxShadow: tokens.shadows,
        },
      },
    };

    return `module.exports = ${JSON.stringify(config, null, 2)};`;
  }

  /**
   * Validate component against design system
   */
  validateComponent(componentCode: string): {
    valid: boolean;
    issues: string[];
  } {
    if (!this.currentSystem) {
      return { valid: false, issues: ['No design system selected'] };
    }

    const issues: string[] = [];
    const tokens = this.currentSystem.tokens;

    // Check for hardcoded colors
    const colorRegex = /#[0-9A-Fa-f]{6}|rgb\(|rgba\(/g;
    const hardcodedColors = componentCode.match(colorRegex);
    if (hardcodedColors) {
      issues.push(
        `Found hardcoded colors: ${hardcodedColors.join(', ')}. Use design tokens instead.`
      );
    }

    // Check for hardcoded spacing
    const spacingRegex = /(?:padding|margin|gap):\s*\d+px/g;
    const hardcodedSpacing = componentCode.match(spacingRegex);
    if (hardcodedSpacing) {
      issues.push(
        `Found hardcoded spacing: ${hardcodedSpacing.join(', ')}. Use design tokens instead.`
      );
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

export const designSystemBuilder = new DesignSystemBuilder();

