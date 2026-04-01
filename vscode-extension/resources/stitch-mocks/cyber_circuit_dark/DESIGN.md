# Creative Directive: The Kinetic Archive

## 1. Overview & Creative North Star
The visual language of this design system is anchored in a concept we call **"The Kinetic Archive."** 

In an enterprise environment as dense as a VS Code sidebar, traditional UI becomes a cage of borders and boxes. We are breaking that. Our North Star is the idea of **Information as Light**: data should feel like it is projected onto layers of dark obsidian and smoked glass. We move away from "standard" software aesthetics by utilizing intentional asymmetry, deep tonal layering, and high-contrast "neon" signals that cut through the darkness. This isn't just a dark mode; it is a high-fidelity workspace designed for focus, where depth is felt through atmospheric shifts rather than structural lines.

---

## 2. Colors & Surface Philosophy
The palette is built on a foundation of Deep Slate (`surface`) and Charcoal, punctuated by "Energy" accents.

### The "No-Line" Rule
Explicitly prohibit the use of 1px solid borders to define sections. In this design system, boundaries are non-physical. You must define hierarchy solely through **background color shifts**. For example, a navigation panel might use `surface_container_low` sitting atop the `background` (`#111316`). If you feel the urge to draw a line, instead shift the inner container to `surface_container_high`.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested, physical layers.
*   **Base Layer:** `surface` or `surface_dim` for the absolute background.
*   **Interactive Panels:** Use `surface_container` for primary sidebar content.
*   **Floating Elements:** Use `surface_bright` with a backdrop blur to create a "lifted" effect.
*   **Nesting Logic:** An inner card should always be one step higher or lower in the tier (e.g., a `surface_container_lowest` search bar inside a `surface_container` panel) to create a soft, natural sense of depth.

### The "Glass & Gradient" Rule
To achieve a premium, custom feel, use **Glassmorphism** for transient elements like tooltips or popovers. Apply a 60% opacity to your `surface_container` color and pair it with a `20px` backdrop-blur. 
**Signature Texture:** Use subtle linear gradients for primary CTAs, transitioning from `primary` (`#c3f5ff`) to `primary_container` (`#00e5ff`) at a 135-degree angle. This provides a "glow-wire" energy that flat colors cannot replicate.

---

## 3. Typography: The Technical Editorial
We are pairing the clean, Swiss-inspired **Inter** with the geometric, wide-aperture **Space Grotesk**.

*   **Space Grotesk (Headings):** Use this for `display` and `headline` scales. It carries a "high-tech" DNA that feels intentional and authoritative. Keep tracking tight (-2%) for headlines to maintain a premium feel.
*   **Inter (Body & Labels):** Use for all functional data. Inter is our workhorse for readability. At `label-sm` scales, ensure you are using `on_surface_variant` to prevent visual fatigue.
*   **Hierarchy Strategy:** Use extreme scale contrast. A `display-sm` heading in Space Grotesk next to a `label-md` Inter caption creates an editorial, "NASA-dashboard" aesthetic that feels sophisticated rather than cluttered.

---

## 4. Elevation & Depth
We do not use shadows to mimic light; we use tonal shifts to mimic atmospheric occlusion.

*   **The Layering Principle:** Avoid "Drop Shadows" in the traditional sense. Instead, "stack" the surface tiers. A `surface_container_high` element on a `surface_dim` background provides all the separation required.
*   **Ambient Glows:** When an element must "float" (like a primary action button), use an **Ambient Glow** instead of a shadow. Apply a blur to the `primary` color at 10% opacity with a large spread (`15px - 30px`). It should look like the component is emitting light onto the surface below it.
*   **The "Ghost Border" Fallback:** If accessibility requires a container edge, use a "Ghost Border": `outline_variant` at 15% opacity. Never use 100% opaque lines.

---

## 5. Components

### Buttons
*   **Primary:** A gradient fill (`primary` to `primary_container`) with a subtle `primary_fixed` outer glow on hover. Text should be `on_primary_fixed` for maximum legibility.
*   **Secondary:** No fill. A `Ghost Border` using `outline`. On hover, the background shifts to `surface_container_high`.
*   **Tertiary:** Text-only using `primary_fixed_dim`. Use `Space Grotesk` for these to make them feel like "commands" rather than just buttons.

### Lists & Navigation
*   **Forbid Dividers:** Never use a horizontal rule between list items. Use vertical spacing (Scale `2` or `3`) to separate items.
*   **Selection State:** Instead of a full-color background, use a vertical "energy bar" (2px wide) of `primary` on the left edge, and shift the background to `surface_container_highest`.

### Input Fields
*   **Structure:** Use `surface_container_lowest` for the input track. 
*   **States:** On focus, the border doesn't just change color; it "activates" with a `primary` glow. Error states use `error` (`#ffb4ab`) with a soft `error_container` outer glow.

### Icons
*   **Weight:** All icons must be thin-weight (1px or light). 
*   **Color:** Use `on_surface_variant` for inactive icons and `primary_fixed` for active states. This maintains the "sleek tech" look.

---

## 6. Do's and Don'ts

### Do
*   **Use Asymmetry:** Place labels and data in a way that feels like a customized terminal, not a bootstrap grid.
*   **Embrace Negative Space:** Use the Spacing Scale (especially `8` and `10`) to let high-density data breathe.
*   **Prioritize High Contrast:** Ensure `on_surface` text sits against the darkest `surface_container_lowest` for maximum readability in tech environments.

### Don't
*   **Don't use "Pure" Black:** Always use our `surface` (`#111316`) to maintain the "Deep Slate" tonal depth.
*   **Don't use Rounded Corners for everything:** Stick to `sm` (`0.125rem`) or `none` for a more "precision instrument" feel. Reserve `xl` only for floating pills.
*   **Don't over-use the "Security Red":** Use `tertiary` or `error` accents only for critical warnings. If everything is red, nothing is urgent.

---

## 7. Spacing & Rhythm
The spacing scale is built on a tight `0.2rem` base to allow for the density required in a VS Code sidebar. 
*   **Internal Padding:** Use `2.5` (`0.5rem`) for component internals.
*   **Section Gaps:** Use `6` (`1.3rem`) to separate major logical groups.
*   **The Vertical Rhythm:** Align all text to a baseline grid to ensure that even with intentional asymmetry, the "Archive" feels engineered and precise.