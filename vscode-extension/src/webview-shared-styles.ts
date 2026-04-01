/**
 * Shared HTML/CSS for Guardrail webviews (dashboard + sidebar).
 * Kinetic Archive theme — see kinetic-archive-styles.ts.
 */
import {
  getKineticArchiveCssBlock,
  getKineticArchiveFontLinks,
} from "./kinetic-archive-styles";

export function getGuardrailSharedStyles(): string {
  return `
    ${getKineticArchiveFontLinks()}
    <style>
    ${getKineticArchiveCssBlock()}
    /* Legacy dashboard class names (alias) */
    .top-bar {
      background: #111316;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      position: sticky;
      top: 0;
      z-index: 50;
      border-bottom: 1px solid var(--border-subtle);
    }
    .top-bar .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
      padding: 0;
    }
    .top-bar .brand .material-symbols-outlined { color: var(--cyan-glow); font-size: 24px; }
    .top-bar .brand span:last-child {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: -0.02em;
      color: var(--cyan-glow);
    }
    .scan-btn {
      background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
      color: #001f24;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      cursor: pointer;
      box-shadow: 0 0 20px rgba(0, 229, 255, 0.15);
      transition: all 0.2s;
    }
    .scan-btn:hover {
      box-shadow: 0 0 28px rgba(0, 229, 255, 0.28);
      filter: brightness(1.05);
    }
    </style>`;
}

/**
 * Shared layout + buttons for enterprise feature webviews (Security, Compliance, etc.)
 * Use with body class `ka-dashboard-body ka-panel-page` and `.ka-shell` wrapper.
 */
export function getEnterprisePanelShellStyles(): string {
  return `
    .ka-panel-page .ka-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 1;
    }
    .ka-panel-page .content {
      flex: 1;
      padding: 16px;
    }
    .ka-panel-page .top-bar {
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .ka-panel-page .top-bar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ka-panel-page .top-bar h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--on-surface);
    }
    .ka-panel-page .top-bar-sub {
      font-size: 10px;
      color: var(--outline);
      letter-spacing: 0.05em;
    }
    .ka-panel-page .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      padding: 12px 16px;
      background: #111316;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 0;
    }
    .ka-panel-page .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ka-panel-page .header .title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--on-surface);
    }
    .ka-panel-page .header .subtitle {
      font-size: 11px;
      color: var(--outline);
      margin-top: 2px;
    }
    .ka-panel-page .header .logo {
      font-size: 22px;
      line-height: 1;
      color: var(--cyan-glow);
    }
    .ka-panel-page .btn {
      background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
      color: #001f24;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: filter 0.2s, transform 0.15s;
      box-shadow: 0 4px 12px rgba(0, 229, 255, 0.12);
    }
    .ka-panel-page .btn:hover { filter: brightness(1.08); }
    .ka-panel-page .btn:active { transform: scale(0.98); }
    .ka-panel-page .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      filter: none;
    }
    .ka-panel-page .btn-secondary {
      background: var(--surface-container-high);
      color: var(--on-surface);
      box-shadow: none;
      border: 1px solid var(--border-subtle);
    }
    .ka-panel-page .btn-danger {
      background: rgba(255, 180, 171, 0.2);
      color: var(--error);
      border: 1px solid rgba(255, 180, 171, 0.35);
    }
    .ka-panel-page .btn-success {
      background: rgba(16, 185, 129, 0.2);
      color: #6ee7b7;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }
    .ka-panel-page .metric-card,
    .ka-panel-page .controls,
    .ka-panel-page .insights-section,
    .ka-panel-page .chart-container,
    .ka-panel-page .team-sidebar,
    .ka-panel-page .main-content,
    .ka-panel-page .stat-card,
    .ka-panel-page .incidents-section,
    .ka-panel-page .recommendations {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      color: var(--on-surface);
    }
    .ka-panel-page .insight-item {
      background: var(--surface-container-lowest);
    }
    .ka-panel-page select,
    .ka-panel-page textarea,
    .ka-panel-page input:not([type='checkbox']) {
      background: var(--surface-container-high);
      border: 1px solid var(--border-subtle);
      color: var(--on-surface);
      border-radius: 8px;
    }
    .ka-panel-page .tabs {
      border-bottom-color: var(--border-subtle);
    }
    .ka-panel-page .tab.active {
      color: var(--primary-fixed-dim);
      border-bottom-color: var(--primary-container);
    }
    .ka-panel-page .tab {
      color: var(--on-surface-variant);
    }
  `;
}

/** Shared Kinetic Archive head + enterprise shell + optional panel-specific CSS. */
export function getGuardrailPanelHead(panelSpecificCss: string): string {
  return `
    ${getGuardrailSharedStyles()}
    <style>
    ${getEnterprisePanelShellStyles()}
    </style>
    <style>
    ${panelSpecificCss}
    </style>`;
}
