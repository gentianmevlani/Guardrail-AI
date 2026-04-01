# Enhanced Components Template

## Overview

This template includes all the polish and animations that AI agents often miss unless specifically asked. Use these in your projects for professional, polished components.

## 🎨 What's Included

### 1. GSAP Animation Setup
- Complete GSAP configuration
- Common animation functions
- Scroll triggers
- Timeline builders

**File:** `templates/animations/gsap-setup.ts`

**Usage:**
```typescript
import { fadeIn, slideIn, scrollReveal } from '@/templates/animations/gsap-setup';

// Fade in element
fadeIn('.my-element', 0.6, 0.2);

// Slide in from left
slideIn('.my-element', 'left', 0.6);

// Scroll reveal
scrollReveal('.my-element');
```

### 2. Animated Button Component
- Hover effects with 3D tilt
- Ripple click effects
- Loading states with spinner
- Shine animation on hover
- Multiple variants (primary, secondary, outline, ghost)
- Icon support

**File:** `templates/components/AnimatedButton.tsx`

**Usage:**
```tsx
import { AnimatedButton } from '@/templates/components/AnimatedButton';

<AnimatedButton
  variant="primary"
  size="lg"
  icon={<ArrowRight />}
  onClick={handleClick}
>
  Get Started
</AnimatedButton>
```

### 3. Animated Card Component
- Entrance animations
- Hover 3D tilt effect
- Glow effects
- Scroll-triggered animations
- Smooth transitions

**File:** `templates/components/AnimatedCard.tsx`

**Usage:**
```tsx
import { AnimatedCard } from '@/templates/components/AnimatedCard';

<AnimatedCard hover glow delay={0.2}>
  <h3>Card Title</h3>
  <p>Card content</p>
</AnimatedCard>
```

### 4. Page Transition Hooks
- Smooth page transitions
- Fade transitions
- Slide transitions
- Route change animations

**File:** `templates/hooks/usePageTransition.ts`

**Usage:**
```tsx
import { usePageTransition, useFadeTransition } from '@/templates/hooks/usePageTransition';

function MyPage() {
  const { isTransitioning } = usePageTransition();
  const isVisible = useFadeTransition();
  
  return <div className={isVisible ? 'fade-transition' : ''}>Content</div>;
}
```

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install gsap framer-motion
```

### 2. Copy Templates

Copy the template files to your project:
- `templates/animations/gsap-setup.ts` → `src/lib/animations.ts`
- `templates/components/AnimatedButton.tsx` → `src/components/ui/AnimatedButton.tsx`
- `templates/components/AnimatedCard.tsx` → `src/components/ui/AnimatedCard.tsx`
- `templates/hooks/usePageTransition.ts` → `src/hooks/usePageTransition.ts`

### 3. Use in Your Components

```tsx
import { AnimatedButton } from '@/components/ui/AnimatedButton';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { fadeIn } from '@/lib/animations';

function MyComponent() {
  useEffect(() => {
    fadeIn('.my-element');
  }, []);

  return (
    <AnimatedCard glow>
      <AnimatedButton variant="primary">Click Me</AnimatedButton>
    </AnimatedCard>
  );
}
```

## ✨ Features

### Animations Included:
- ✅ Fade in/out
- ✅ Slide in (all directions)
- ✅ Scale in/out
- ✅ Stagger animations
- ✅ Scroll reveals
- ✅ Hover effects
- ✅ Click animations
- ✅ Loading states
- ✅ Text reveals
- ✅ Page transitions

### Button Features:
- ✅ 3D tilt on hover
- ✅ Ripple click effect
- ✅ Shine animation
- ✅ Loading spinner
- ✅ Icon support
- ✅ Multiple variants
- ✅ Size options
- ✅ Disabled states

### Card Features:
- ✅ Entrance animations
- ✅ 3D hover tilt
- ✅ Glow effects
- ✅ Scroll triggers
- ✅ Smooth transitions

## 🎯 Why This Matters

### What AI Agents Miss:
- ❌ Hover effects
- ❌ Click animations
- ❌ Loading states
- ❌ Transitions
- ❌ Scroll animations
- ❌ Polish and details

### What This Template Provides:
- ✅ All animations included
- ✅ Professional polish
- ✅ Ready to use
- ✅ Well-documented
- ✅ Type-safe

## 📋 Complete Component Checklist

When creating components, include:
- [ ] Hover effects
- [ ] Click animations
- [ ] Loading states
- [ ] Transitions
- [ ] Entrance animations
- [ ] Responsive behavior
- [ ] Accessibility
- [ ] Error states
- [ ] Success states

## 🎉 Result

Your components will have:
- ✅ Professional polish
- ✅ Smooth animations
- ✅ Delightful interactions
- ✅ Modern feel
- ✅ Better UX

**All without asking AI specifically!** 🚀

