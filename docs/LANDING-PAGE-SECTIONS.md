# Landing Page Sections Documentation

This document outlines all the current sections on the guardrail landing page.

## Main Landing Page Structure

The landing page is composed of the following sections in order:

### 1. Navigation
- **Location**: Fixed top navigation bar
- **Components**: Logo, navigation links (CLI, MCP, How it works, Pricing), GitHub link, Login/Signup buttons
- **Features**: Mobile responsive menu, scroll-based styling changes

### 2. Hero Section
- **Component**: `Hero` function (lines 488-644)
- **Content**: 
  - Headline: "Built with AI? Ship with confidence."
  - Subheadline: "One command tells you if your app actually works—or just looks like it does."
  - CTA: "Get Started Free →"
  - Visual: TerminalVideo component with floating animation
- **Background**: WarpBackground with parallax effects
- **Animation**: Scroll-based parallax, blur effects, staggered text animations

### 3. Problem Strip
- **Component**: `ProblemStrip` function (lines 1748-1872)
- **Purpose**: Highlights common issues with AI-generated code

### 4. Context CLI Section
- **Component**: `ContextCLISection` function (lines 915-1048)
- **Focus**: CLI capabilities and natural language commands

### 5. MCP Section
- **Component**: `MCPSection` function (lines 1211-1513)
- **Content**: Model Context Protocol integration features

### 6. AI Guardrails Section
- **Component**: `AIGuardrailsSection` function (lines 1050-1209)
- **Focus**: AI code validation and guardrails

### 7. CLI vs MCP Strip
- **Component**: `CLIvsMCPStrip` function (lines 1515-1620)
- **Purpose**: Comparison between CLI and MCP approaches

### 8. Reality Mode Section
- **Component**: `RealityModeSection` function (lines 1874-2009)
- **Background**: WarpBackground effect
- **Content**: Real browser testing capabilities

### 9. MockProof Gate Section
- **Component**: `MockProofGateSection` function (lines 2012-2134)
- **Focus**: Mock detection and prevention

### 10. AI Agent Section
- **Component**: `AIAgentSection` function (lines 2136-2317)
- **Features**: Autonomous AI testing and bug detection
- **Interactive**: Copy prompt functionality

### 11. Autopilot Section
- **Component**: `AutopilotSection` function (lines 2319-2486)
- **Content**: Continuous protection and automation

### 12. Intelligence Suite Section
- **Component**: `IntelligenceSuiteSection` function (lines 2487-2609)
- **Focus**: Advanced AI-powered features

### 13. How It Works Section
- **Component**: `HowItWorks` function (lines 2611-3104)
- **Purpose**: Step-by-step process explanation

### 14. Pricing Section
- **Component**: `Pricing` function (referenced from sections/pricing-section.tsx)
- **Tiers**: Free, Starter ($29/mo), Pro ($99/mo), Enterprise
- **Features**: Tier comparison, annual billing options

### 15. FAQ Section
- **Component**: `FAQ` function (lines 3106-3338)
- **Content**: Common questions and answers
- **Format**: Accordion-style expandable items

### 16. CTA Section
- **Component**: `CTA` function (referenced from sections/cta-section.tsx)
- **Purpose**: Final call-to-action before footer

### 17. Footer
- **Component**: `Footer` function (lines 3341-end)
- **Content**: Links, legal information, modals for various content

## Visual Effects and Animations

### Background Effects
- **Infinite Grid Background**: Main page background (opacity 0.12)
- **Warp Background**: Used in Hero and Reality Mode sections
- **Liquid Gradient Background**: Available for additional sections

### Interactive Elements
- **Liquid Metal Buttons**: Primary CTAs with magnetic effects
- **Glass Cards**: Content containers with glassmorphism
- **Terminal Video**: Interactive terminal demonstration
- **Floating Elements**: Various components with subtle animations

### Motion Libraries
- **Framer Motion**: Primary animation library
- **Reduced Motion Support**: Accessibility considerations
- **Scroll-based Animations**: Parallax and reveal effects

## Component Architecture

### Section Components (in `/sections/`)
- `hero-section.tsx` - Standalone hero component
- `pricing-section.tsx` - Pricing tiers and plans
- `faq-section.tsx` - FAQ accordion
- `cta-section.tsx` - Call-to-action
- `how-it-works-section.tsx` - Process explanation

### Supporting Components
- `animated-section.tsx` - Animation utilities
- `glass-card.tsx` - Glassmorphism containers
- `liquid-metal-button.tsx` - Interactive buttons
- `magnetic-button.tsx` - Magnetic hover effects
- `terminal-video.tsx` - Terminal demonstration
- Various background components (warp, liquid gradient, infinite grid)

## Responsive Design

- **Mobile Optimized**: All sections adapt to mobile layouts
- **Performance**: Heavy components use dynamic imports with no SSR
- **Accessibility**: Reduced motion preferences respected
- **Touch Interactions**: Mobile-friendly buttons and navigation

## Content Strategy

### Value Proposition
1. **Problem**: AI-generated code may look functional but have hidden issues
2. **Solution**: Automated testing and validation
3. **Benefits**: Ship with confidence, prevent bugs, protect production

### Feature Hierarchy
1. **Core Features**: Reality Mode, AI Agent, MockProof
2. **Advanced Features**: Autopilot, Intelligence Suite
3. **Supporting Features**: CLI, MCP, Ship Badge

### User Journey
1. **Awareness**: Hero section highlights the problem
2. **Interest**: Feature sections demonstrate capabilities
3. **Consideration**: Pricing and FAQ provide details
4. **Conversion**: CTA and signup flow

## Technical Notes

- **Framework**: Next.js with TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **3D Effects**: Three.js (via custom components)
- **State Management**: React hooks
- **Routing**: Next.js App Router

This documentation provides a comprehensive overview of the current landing page structure and can be used for maintenance, updates, or as reference for new development.
