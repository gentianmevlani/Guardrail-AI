# Stitch design references (Kinetic Archive)

Static HTML mocks copied from the Stitch export folder for visual parity when implementing VS Code webviews.

| Folder | Panel / feature |
|--------|-----------------|
| `world_class_security_scanner` | Security Scanner |
| `world_class_performance_monitor` | Performance Monitor (Nexus Monitor) |
| `team_collaboration_pulse_map_edition` | Team Collaboration |
| `impact_analysis_topology_edition` | Change Impact Analyzer |
| `mdc_generator_prism_edition` | MDC Generator |
| `ai_explainer_reactive_ux` | AI Explainer (alternate) |
| `cyber_circuit_dark` | DESIGN.md — Kinetic Archive design system |

Implementations live in `src/features/*` using CSP-safe CSS (no Tailwind CDN in shipped webviews).

| Stitch folder | Implemented in code |
|---------------|---------------------|
| `world_class_security_scanner` | `security-scanner-stitch-css.ts`, `security-scanner-webview-html.ts` |
| `world_class_performance_monitor` | `performance-monitor-stitch-css.ts`, `performance-monitor-webview-html.ts` |
| Others | Reference-only here; align when refactoring those panels |
