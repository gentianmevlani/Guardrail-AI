# Animation Templates

Complete animation setup that AI agents often miss.

## Quick Start

```bash
# Install GSAP
npm install gsap

# Copy templates to your project
cp templates/animations/gsap-setup.ts src/lib/animations.ts
```

## Usage

```typescript
import { fadeIn, slideIn, scrollReveal } from '@/lib/animations';

// Fade in on mount
useEffect(() => {
  fadeIn('.my-element');
}, []);

// Scroll reveal
scrollReveal('.my-element');

// Slide in
slideIn('.my-element', 'left', 0.6);
```

## Available Animations

- `fadeIn` - Fade in with optional slide
- `slideIn` - Slide in from any direction
- `scaleIn` - Scale in with bounce
- `staggerIn` - Stagger multiple elements
- `scrollReveal` - Reveal on scroll
- `hoverScale` - Scale on hover
- `textReveal` - Animated text reveal
- `loadingSpinner` - Rotating spinner
- `pulse` - Pulsing animation
- `createTimeline` - Complex animations

All animations are production-ready and optimized!

