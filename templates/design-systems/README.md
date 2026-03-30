# 🎨 Design System Templates

**Apple-tier, production-ready design systems that save developers time**

## Overview

This collection includes professional, production-ready design system templates that developers can immediately use to build high-quality applications. All templates follow best practices and are optimized for performance and maintainability.

---

## 📁 Available Templates

### 1. **global.css** - Design System Tokens
Complete design system foundation with:
- ✅ Typography system (fluid, responsive)
- ✅ Color palette (light + dark mode)
- ✅ Spacing scale (comprehensive)
- ✅ Border radius values
- ✅ Shadow system
- ✅ Z-index layers
- ✅ Transitions & animations
- ✅ Breakpoints
- ✅ Container widths
- ✅ Blur effects
- ✅ Opacity scale

**Usage:**
```html
<link rel="stylesheet" href="global.css">
```

```css
/* Use design tokens in your CSS */
.my-component {
  padding: var(--space-4);
  font-size: var(--text-lg);
  color: var(--color-primary-600);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}
```

### 2. **components.css** - Component Library
Production-ready UI components:
- ✅ Buttons (5 variants, 4 sizes)
- ✅ Cards (3 variants)
- ✅ Forms (inputs, textareas, selects)
- ✅ Badges (6 variants)
- ✅ Alerts (4 types)
- ✅ Modals (with animations)
- ✅ Tooltips
- ✅ Loading states (spinner, skeleton)
- ✅ Navigation
- ✅ Tables

**Usage:**
```html
<link rel="stylesheet" href="global.css">
<link rel="stylesheet" href="components.css">

<!-- Button -->
<button class="btn btn-primary">Primary Button</button>
<button class="btn btn-outline btn-lg">Large Outline</button>

<!-- Card -->
<div class="card">
  <div class="card-header">
    <h3>Card Title</h3>
  </div>
  <div class="card-body">
    <p>Card content goes here...</p>
  </div>
</div>

<!-- Form -->
<div class="form-group">
  <label class="form-label">Email</label>
  <input type="email" class="form-input" placeholder="Enter email">
  <span class="form-hint">We'll never share your email</span>
</div>

<!-- Badge -->
<span class="badge badge-success">Success</span>

<!-- Alert -->
<div class="alert alert-info">
  This is an informational message.
</div>
```

---

## 🚀 Quick Start

### Option 1: Copy Files
```bash
# Copy design system files to your project
cp templates/design-systems/global.css your-project/styles/
cp templates/design-systems/components.css your-project/styles/
```

### Option 2: Import in your CSS
```css
/* your-main.css */
@import 'path/to/global.css';
@import 'path/to/components.css';
```

### Option 3: Link in HTML
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  
  <!-- Design System -->
  <link rel="stylesheet" href="styles/global.css">
  <link rel="stylesheet" href="styles/components.css">
</head>
<body>
  <div class="container">
    <h1>Welcome</h1>
    <button class="btn btn-primary">Get Started</button>
  </div>
</body>
</html>
```

---

## 🎯 Design Tokens Reference

### Typography

```css
/* Font Families */
--font-sans: 'SF Pro Display', -apple-system, ...
--font-mono: 'SF Mono', 'Fira Code', ...
--font-display: 'SF Pro Display', ...

/* Font Sizes (Fluid Typography) */
--text-2xs to --text-7xl

/* Font Weights */
--font-weight-thin: 100
--font-weight-normal: 400
--font-weight-bold: 700
--font-weight-black: 900

/* Line Heights */
--leading-tight: 1.25
--leading-normal: 1.5
--leading-loose: 2
```

### Colors

```css
/* Primary (Blue) */
--color-primary-50 to --color-primary-950

/* Secondary (Purple) */
--color-secondary-50 to --color-secondary-950

/* Neutral (Gray) */
--color-neutral-50 to --color-neutral-950

/* Semantic */
--color-success-*
--color-warning-*
--color-error-*
--color-info-*
```

### Spacing

```css
/* 0px to 384px */
--space-0: 0
--space-1: 4px
--space-2: 8px
--space-4: 16px
--space-8: 32px
--space-16: 64px
--space-96: 384px
```

### Shadows

```css
--shadow-xs   /* Subtle */
--shadow-sm   /* Small */
--shadow-base /* Default */
--shadow-md   /* Medium */
--shadow-lg   /* Large */
--shadow-xl   /* Extra large */
--shadow-2xl  /* Huge */
```

---

## 📦 Component Examples

### Button Variants
```html
<!-- Styles -->
<button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-outline">Outline</button>
<button class="btn btn-ghost">Ghost</button>
<button class="btn btn-danger">Danger</button>

<!-- Sizes -->
<button class="btn btn-xs">Extra Small</button>
<button class="btn btn-sm">Small</button>
<button class="btn">Default</button>
<button class="btn btn-lg">Large</button>
<button class="btn btn-xl">Extra Large</button>

<!-- States -->
<button class="btn btn-primary" disabled>Disabled</button>
```

### Card Variants
```html
<!-- Standard Card -->
<div class="card">
  <div class="card-header">Header</div>
  <div class="card-body">Body</div>
  <div class="card-footer">Footer</div>
</div>

<!-- Elevated Card -->
<div class="card card-elevated">
  <div class="card-body">Elevated with large shadow</div>
</div>

<!-- Interactive Card -->
<div class="card card-interactive">
  <div class="card-body">Hover to see effect</div>
</div>
```

### Form Components
```html
<!-- Text Input -->
<div class="form-group">
  <label class="form-label">Username</label>
  <input type="text" class="form-input" placeholder="Enter username">
  <span class="form-hint">Choose a unique username</span>
</div>

<!-- With Error -->
<div class="form-group">
  <label class="form-label">Email</label>
  <input type="email" class="form-input form-input-error" value="invalid">
  <span class="form-error">Please enter a valid email</span>
</div>

<!-- Textarea -->
<div class="form-group">
  <label class="form-label">Message</label>
  <textarea class="form-textarea" placeholder="Enter message"></textarea>
</div>

<!-- Select -->
<div class="form-group">
  <label class="form-label">Country</label>
  <select class="form-select">
    <option>United States</option>
    <option>Canada</option>
    <option>United Kingdom</option>
  </select>
</div>
```

### Badges
```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-secondary">Secondary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-error">Error</span>
<span class="badge badge-neutral">Neutral</span>
```

### Alerts
```html
<div class="alert alert-success">
  ✅ Your changes have been saved successfully!
</div>

<div class="alert alert-warning">
  ⚠️ Please review the information before proceeding.
</div>

<div class="alert alert-error">
  ❌ An error occurred. Please try again.
</div>

<div class="alert alert-info">
  ℹ️ New features are now available. Check them out!
</div>
```

### Modal
```html
<!-- Overlay -->
<div class="modal-overlay" onclick="closeModal()"></div>

<!-- Modal -->
<div class="modal">
  <div class="modal-header">
    <h3>Modal Title</h3>
  </div>
  <div class="modal-body">
    <p>Modal content goes here...</p>
  </div>
  <div class="modal-footer">
    <button class="btn btn-ghost">Cancel</button>
    <button class="btn btn-primary">Save Changes</button>
  </div>
</div>
```

### Loading States
```html
<!-- Spinner -->
<div class="spinner"></div>

<!-- Skeleton -->
<div class="skeleton" style="width: 200px; height: 20px;"></div>
<div class="skeleton" style="width: 100%; height: 100px; margin-top: 10px;"></div>
```

---

## 🌗 Dark Mode Support

The design system automatically supports dark mode:

### Option 1: System Preference (Automatic)
```css
/* Automatically applies when user has dark mode enabled */
@media (prefers-color-scheme: dark) {
  /* Dark mode styles applied */
}
```

### Option 2: Class-based (Manual)
```html
<html class="dark">
  <!-- Dark mode styles applied -->
</html>
```

```javascript
// Toggle dark mode
function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
}
```

---

## 📱 Responsive Design

All components are responsive and work across devices:

```css
/* Breakpoints */
--breakpoint-sm: 640px   /* Small devices */
--breakpoint-md: 768px   /* Tablets */
--breakpoint-lg: 1024px  /* Laptops */
--breakpoint-xl: 1280px  /* Desktops */
--breakpoint-2xl: 1536px /* Large displays */
```

### Container System
```html
<div class="container">
  <!-- Automatically sized based on viewport -->
  <!-- Max width: 640px (sm), 768px (md), 1024px (lg), etc. -->
</div>
```

---

## 💡 Time Savings

Using these templates saves developers significant time:

### Traditional Approach (Without Templates)
- Setting up design tokens: **4-6 hours**
- Building component library: **20-30 hours**
- Dark mode implementation: **3-5 hours**
- Responsive design: **5-8 hours**
- Testing across browsers: **3-5 hours**
**Total: 35-54 hours**

### With These Templates
- Copy files: **5 minutes**
- Customize colors: **30 minutes**
- Start building: **Immediately**
**Total: 35 minutes**

**Time Saved: 97-99%** ⚡

---

## 🎨 Customization

### Changing Colors
```css
:root {
  /* Change primary color */
  --color-primary-600: #your-color;
  --color-primary-700: #your-darker-color;
  
  /* Or override specific use cases */
  .btn-primary {
    background-color: #your-brand-color;
  }
}
```

### Changing Fonts
```css
:root {
  --font-sans: 'Your Font', -apple-system, sans-serif;
}
```

### Changing Spacing
```css
:root {
  /* Adjust base spacing scale */
  --space-4: 1.25rem; /* 20px instead of 16px */
}
```

---

## ✅ Production Ready

These templates are:
- ✅ **Tested** across all modern browsers
- ✅ **Accessible** following WCAG guidelines
- ✅ **Performant** with minimal CSS
- ✅ **Maintainable** with clear naming conventions
- ✅ **Flexible** for customization
- ✅ **Well-documented** with examples

---

## 📚 Additional Resources

- See `DESIGN-SYSTEM-GUIDE.md` for advanced usage
- Check existing components in `templates/components/`
- Review `templates/vibecoder/` for specialized templates
- Read `01-UI-UX-SYSTEM-TEMPLATE.md` for UI/UX patterns

---

## 🤝 Contributing

To add more templates or components:

1. Follow the existing naming conventions
2. Use design tokens from `global.css`
3. Ensure dark mode compatibility
4. Add documentation and examples
5. Test across browsers

---

**Built with ❤️ for developers who value their time**

*Part of the guardrail AI revolutionary features suite*
