#!/usr/bin/env node

/**
 * Design System Wizard
 * 
 * Interactive wizard for non-coders to create and lock design systems
 * Prevents AI from creating inconsistent designs
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
// Design system builder (inline for now, can be moved to separate file)
const PREBUILT_THEMES = {
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
        fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem' },
        fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
      },
      spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
      borderRadius: { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', full: '9999px' },
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
        fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem' },
        fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
      },
      spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
      borderRadius: { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', full: '9999px' },
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
        fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem' },
        fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
      },
      spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem', '3xl': '4rem' },
      borderRadius: { none: '0', sm: '0.25rem', md: '0.5rem', lg: '0.75rem', full: '9999px' },
      shadows: {
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    },
  },
};

const designSystemBuilder = {
  currentSystem: null,
  selectTheme(themeName) {
    const theme = PREBUILT_THEMES[themeName];
    if (!theme) throw new Error(`Theme "${themeName}" not found`);
    this.currentSystem = { ...theme };
    return this.currentSystem;
  },
  customizeColors(colors) {
    if (!this.currentSystem) throw new Error('No design system selected');
    this.currentSystem.tokens.colors = { ...this.currentSystem.tokens.colors, ...colors };
  },
  getCurrentSystem() { return this.currentSystem; },
  lock() {
    if (!this.currentSystem) throw new Error('No design system selected');
    this.currentSystem.locked = true;
  },
  generateCSSVariables() {
    if (!this.currentSystem) throw new Error('No design system selected');
    const tokens = this.currentSystem.tokens;
    let css = ':root {\n';
    Object.entries(tokens.colors).forEach(([key, value]) => {
      css += `  --color-${key}: ${value};\n`;
    });
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
    Object.entries(tokens.spacing).forEach(([key, value]) => {
      css += `  --spacing-${key}: ${value};\n`;
    });
    Object.entries(tokens.borderRadius).forEach(([key, value]) => {
      css += `  --radius-${key}: ${value};\n`;
    });
    Object.entries(tokens.shadows).forEach(([key, value]) => {
      css += `  --shadow-${key}: ${value};\n`;
    });
    css += '}\n';
    return css;
  },
  generateTailwindConfig() {
    if (!this.currentSystem) throw new Error('No design system selected');
    const tokens = this.currentSystem.tokens;
    const config = {
      theme: {
        extend: {
          colors: tokens.colors,
          fontFamily: { sans: tokens.typography.fontFamily.split(', '), heading: tokens.typography.fontFamilyHeading.split(', ') },
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
  },
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt, defaultValue = '') {
  return new Promise((resolve) => {
    const fullPrompt = defaultValue
      ? `${prompt} [${defaultValue}]: `
      : `${prompt}: `;
    rl.question(fullPrompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function selectOption(prompt, options) {
  return new Promise((resolve) => {
    console.log(`\n${prompt}`);
    options.forEach((opt, index) => {
      console.log(`  ${index + 1}. ${opt.name}${opt.description ? ` - ${opt.description}` : ''}`);
    });
    rl.question('\nSelect option (1-' + options.length + '): ', (answer) => {
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < options.length) {
        resolve(options[index].value);
      } else {
        console.log('Invalid selection, using first option');
        resolve(options[0].value);
      }
    });
  });
}

async function welcome() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        🎨 Design System Builder - No Coding Required!        ║
║                                                              ║
║  Create a consistent design system and lock it in place      ║
║  so AI agents can't drift off and create mismatched designs ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

async function selectTheme() {
  console.log('\n🎨 Choose a pre-built design theme:\n');
  console.log('These themes are professionally designed and locked to prevent AI drift.\n');

  const themes = Object.entries(PREBUILT_THEMES).map(([value, theme]) => ({
    value,
    name: theme.name,
    description: 'Professionally designed, locked theme',
  }));

  const selected = await selectOption('Select a theme:', themes);
  designSystemBuilder.selectTheme(selected);
  
  console.log(`\n✅ Selected "${PREBUILT_THEMES[selected].name}" theme`);
  return selected;
}

async function customizeColors() {
  const system = designSystemBuilder.getCurrentSystem();
  if (!system) return;

  console.log('\n🎨 Customize Colors (Optional)\n');
  console.log('Current colors:');
  console.log(`  Primary: ${system.tokens.colors.primary}`);
  console.log(`  Secondary: ${system.tokens.colors.secondary}`);
  console.log(`  Accent: ${system.tokens.colors.accent}\n`);

  const customize = await question('Customize colors? (yes/no)', 'no');
  if (customize.toLowerCase() !== 'yes') {
    return;
  }

  const primary = await question('Primary color (hex code)', system.tokens.colors.primary);
  const secondary = await question('Secondary color (hex code)', system.tokens.colors.secondary);
  const accent = await question('Accent color (hex code)', system.tokens.colors.accent);

  designSystemBuilder.customizeColors({
    primary: primary.startsWith('#') ? primary : `#${primary}`,
    secondary: secondary.startsWith('#') ? secondary : `#${secondary}`,
    accent: accent.startsWith('#') ? accent : `#${accent}`,
  });

  console.log('\n✅ Colors customized!');
}

async function generateFiles(targetDir) {
  const system = designSystemBuilder.getCurrentSystem();
  if (!system) {
    throw new Error('No design system selected');
  }

  console.log('\n📝 Generating design system files...\n');

  // Create design-system directory
  const designSystemDir = path.join(targetDir, 'src', 'design-system');
  if (!fs.existsSync(designSystemDir)) {
    fs.mkdirSync(designSystemDir, { recursive: true });
  }

  // Generate tokens.ts
  const tokensContent = `/**
 * Design System Tokens
 * 
 * LOCKED: This file is locked to prevent AI agents from creating inconsistent designs.
 * All components MUST use these tokens - no hardcoded colors, spacing, or values.
 */

export const designTokens = ${JSON.stringify(system.tokens, null, 2)};

export const colors = designTokens.colors;
export const typography = designTokens.typography;
export const spacing = designTokens.spacing;
export const borderRadius = designTokens.borderRadius;
export const shadows = designTokens.shadows;
`;

  fs.writeFileSync(
    path.join(designSystemDir, 'tokens.ts'),
    tokensContent
  );
  console.log('   ✅ src/design-system/tokens.ts');

  // Generate tokens.css
  const cssContent = designSystemBuilder.generateCSSVariables();
  fs.writeFileSync(
    path.join(designSystemDir, 'tokens.css'),
    cssContent
  );
  console.log('   ✅ src/design-system/tokens.css');

  // Generate Tailwind config if using Tailwind
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.dependencies?.tailwindcss || packageJson.devDependencies?.tailwindcss) {
      const tailwindConfig = designSystemBuilder.generateTailwindConfig();
      fs.writeFileSync(
        path.join(targetDir, 'tailwind.config.ts'),
        tailwindConfig
      );
      console.log('   ✅ tailwind.config.ts');
    }
  }

  // Generate .design-system-lock file
  const lockContent = {
    locked: true,
    theme: system.name,
    lockedAt: new Date().toISOString(),
    message: 'This design system is locked. AI agents must use these tokens and cannot create inconsistent designs.',
  };

  fs.writeFileSync(
    path.join(targetDir, '.design-system-lock.json'),
    JSON.stringify(lockContent, null, 2)
  );
  console.log('   ✅ .design-system-lock.json');

  // Update .cursorrules to enforce design system
  const cursorRulesPath = path.join(targetDir, '.cursorrules');
  let cursorRules = '';
  if (fs.existsSync(cursorRulesPath)) {
    cursorRules = fs.readFileSync(cursorRulesPath, 'utf8');
  }

  const designSystemRules = `

## DESIGN SYSTEM RULES (LOCKED)

### CRITICAL: Design Consistency
- NEVER use hardcoded colors, spacing, or design values
- ALWAYS use design tokens from src/design-system/tokens.ts
- NEVER create new colors or spacing values
- ALL components MUST use the locked design system

### Design Tokens to Use:
- Colors: Use colors.* from design tokens
- Spacing: Use spacing.* from design tokens
- Typography: Use typography.* from design tokens
- Border Radius: Use borderRadius.* from design tokens
- Shadows: Use shadows.* from design tokens

### Example:
❌ WRONG: <div style={{ color: '#3B82F6', padding: '16px' }}>
✅ CORRECT: <div className="text-primary p-md">

### Validation:
All components are validated against the design system.
Inconsistent designs will be rejected.
`;

  fs.appendFileSync(cursorRulesPath, designSystemRules);
  console.log('   ✅ Updated .cursorrules with design system rules');
}

async function main() {
  try {
    await welcome();

    // Select theme
    await selectTheme();

    // Customize (optional)
    await customizeColors();

    // Lock the system
    designSystemBuilder.lock();
    console.log('\n🔒 Design system locked! AI agents cannot change it.');

    // Generate files
    const targetDir = process.cwd();
    await generateFiles(targetDir);

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              ✅ Design System Created & Locked!             ║
║                                                              ║
║  Your design system is now locked in place. AI agents       ║
║  will be forced to use these tokens, preventing drift.      ║
║                                                              ║
║  All components will now be consistent! 🎨                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

    rl.close();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

