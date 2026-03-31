/**
 * Kinetic Archive — embedded theme (no Tailwind CDN; CSP-safe for VS Code webviews).
 * Color tokens aligned with the provided design reference.
 */
export const KINETIC_ARCHIVE_VERSION = "2.0.0";

export function getKineticArchiveFontLinks(): string {
  return `
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  `;
}

/** Shared :root + layout primitives for sidebar + dashboard webviews */
export function getKineticArchiveCssBlock(): string {
  return `
      :root {
        --background: #111316;
        --surface: #111316;
        --surface-dim: #111316;
        --surface-container: #1e2023;
        --surface-container-low: #1a1c1f;
        --surface-container-high: #282a2d;
        --surface-container-highest: #333538;
        --surface-container-lowest: #0c0e11;
        --surface-bright: #37393d;
        --surface-variant: #333538;
        --on-surface: #e2e2e6;
        --on-surface-variant: #bac9cc;
        --outline: #849396;
        --outline-variant: #3b494c;
        --primary: #c3f5ff;
        --on-primary: #00363d;
        --primary-container: #00e5ff;
        --on-primary-container: #00626e;
        --primary-fixed: #9cf0ff;
        --primary-fixed-dim: #00daf3;
        --inverse-primary: #006875;
        --secondary: #b0c6ff;
        --secondary-container: #0068ed;
        --on-secondary-container: #f2f3ff;
        --tertiary: #ffe7e6;
        --tertiary-container: #ffc1c0;
        --error: #ffb4ab;
        --error-container: #93000a;
        --border-subtle: rgba(255,255,255,0.05);
        --border-light: rgba(255,255,255,0.08);
        --cyan-glow: #00e5ff;
        /* Map legacy shared-style names */
        --bg: var(--background);
        --surface-low: var(--surface-container-low);
        --surface-high: var(--surface-container-high);
        --surface-highest: var(--surface-container-highest);
        --surface-lowest: var(--surface-container-lowest);
        --on-primary-legacy: var(--on-primary);
        --tertiary-legacy: var(--tertiary);
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24;
        font-size: 20px;
      }
      .glass-card {
        background: rgba(30, 32, 35, 0.4);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--outline-variant); border-radius: 10px; }

      body.ka-dashboard-body {
        font-family: 'Inter', sans-serif;
        background: var(--background);
        color: var(--on-surface);
        min-height: 100vh;
        overflow-x: hidden;
        padding-bottom: 88px;
      }
      .ka-ambient {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        height: 600px;
        border-radius: 50%;
        background: rgba(195, 245, 255, 0.05);
        filter: blur(120px);
        pointer-events: none;
        z-index: 0;
      }
      .ka-shell { position: relative; z-index: 1; }
      .ka-topbar {
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
      .ka-topbar .ka-brand {
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
      .ka-topbar .ka-brand .material-symbols-outlined { color: var(--cyan-glow); font-size: 24px; }
      .ka-topbar .ka-brand span:last-child {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 15px;
        letter-spacing: -0.02em;
        color: var(--cyan-glow);
      }
      .ka-scan-btn {
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
      .ka-scan-btn:hover {
        box-shadow: 0 0 28px rgba(0, 229, 255, 0.28);
        filter: brightness(1.05);
      }
      .ka-main-pad { padding: 16px; position: relative; z-index: 1; }

      .bottom-nav, .ka-bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        z-index: 50;
        display: flex;
        justify-content: space-around;
        align-items: center;
        padding: 12px 8px;
        background: rgba(17, 19, 22, 0.95);
        backdrop-filter: blur(16px);
        border-top: 1px solid var(--border-subtle);
        box-shadow: 0 -10px 24px rgba(0, 0, 0, 0.45);
      }
      .nav-item, .ka-bottom-nav .nav-item {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 12px;
        border: none;
        background: none;
        color: rgba(226, 226, 230, 0.45);
        cursor: pointer;
        transition: all 0.2s;
      }
      .nav-item:hover, .ka-bottom-nav .nav-item:hover { color: var(--primary-fixed-dim); }
      .nav-item.active, .ka-bottom-nav .nav-item.active {
        background: linear-gradient(135deg, rgba(0, 229, 255, 0.25), rgba(0, 104, 237, 0.2));
        color: var(--primary);
        box-shadow: 0 0 16px rgba(0, 229, 255, 0.2);
      }

      .page-content { padding: 16px; }
      .page-content > section { margin-bottom: 28px; }
      .section-title {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 10px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--outline);
        margin-bottom: 14px;
      }
      .card {
        background: var(--surface-container-low);
        border-radius: 12px;
        border: 1px solid var(--border-subtle);
        padding: 16px;
        transition: background 0.2s;
      }
      .card:hover { background: var(--surface-container-high); }
      .card-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .card-left { display: flex; align-items: center; gap: 16px; }
      .icon-box {
        padding: 8px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .status-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(0, 229, 255, 0.12);
        border: 1px solid rgba(0, 229, 255, 0.25);
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary-container);
        box-shadow: 0 0 10px rgba(0, 229, 255, 0.8);
        animation: ka-pulse 2s infinite;
      }
      @keyframes ka-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .status-label {
        font-family: 'Inter', sans-serif;
        font-weight: 800;
        font-size: 10px;
        letter-spacing: 0.15em;
        color: var(--primary-fixed-dim);
      }
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .anim { animation: fadeUp 0.4s ease forwards; }
      .anim-d1 { animation-delay: 0.05s; opacity: 0; }
      .anim-d2 { animation-delay: 0.1s; opacity: 0; }
      .anim-d3 { animation-delay: 0.15s; opacity: 0; }

      /* Sidebar-only — bounded height so inner scroll works in WebviewView */
      html.ka-sidebar-root {
        height: 100%;
        margin: 0;
      }
      html.ka-sidebar-root body.ka-sidebar-body {
        height: 100%;
        margin: 0;
      }
      body.ka-sidebar-body {
        font-family: 'Inter', sans-serif;
        background: var(--surface);
        color: var(--on-surface);
        min-height: 0;
        max-height: 100%;
        user-select: none;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .ka-sidebar-tabs {
        display: flex;
        gap: 4px;
        padding: 0 12px 10px;
        flex-shrink: 0;
        border-bottom: 1px solid var(--border-subtle);
        background: #111316;
      }
      .ka-sidebar-tab {
        flex: 1;
        padding: 8px 6px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font: inherit;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--on-surface-variant);
        background: transparent;
      }
      .ka-sidebar-tab:hover {
        color: var(--on-surface);
        background: var(--surface-container);
      }
      .ka-sidebar-tab.ka-tab-active {
        color: var(--cyan-glow);
        background: var(--surface-container-high);
      }
      .ka-tab-panel[hidden] {
        display: none !important;
      }
      .ka-sidebar-inner {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .ka-sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 12px;
        background: #111316;
        border-bottom: 1px solid var(--border-subtle);
        flex-shrink: 0;
      }
      .ka-sidebar-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        border: none;
        background: none;
        padding: 0;
        cursor: pointer;
        color: inherit;
        font: inherit;
        text-align: left;
      }
      .ka-sidebar-brand .material-symbols-outlined { color: var(--cyan-glow); font-size: 22px; }
      .ka-sidebar-brand h1 {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 17px;
        letter-spacing: -0.03em;
        color: var(--cyan-glow);
      }
      .ka-icon-btn {
        border: none;
        background: none;
        padding: 4px;
        cursor: pointer;
        color: #94a3b8;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s;
      }
      .ka-icon-btn:hover { color: var(--cyan-glow); }
      .ka-primary-cta {
        width: 100%;
        padding: 12px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: linear-gradient(to bottom right, var(--primary-container), var(--secondary-container));
        color: #001f24;
        box-shadow: 0 0 20px rgba(0, 229, 255, 0.15);
        transition: all 0.2s;
      }
      .ka-primary-cta:hover {
        box-shadow: 0 0 30px rgba(0, 229, 255, 0.25);
      }
      .ka-primary-cta:active { transform: scale(0.98); }
      .ka-section-label {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--outline);
        margin-bottom: 10px;
      }
      .ka-quick-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .ka-quick-tile {
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        cursor: pointer;
        text-align: left;
        background: rgba(30, 32, 35, 0.35);
        backdrop-filter: blur(12px);
        color: inherit;
        font: inherit;
        transition: background 0.15s;
      }
      .ka-quick-tile:hover { background: var(--surface-container-high); }
      .ka-quick-tile .material-symbols-outlined {
        color: var(--primary-fixed-dim);
        transition: filter 0.15s;
      }
      .ka-quick-tile:hover .material-symbols-outlined {
        filter: drop-shadow(0 0 8px rgba(0, 218, 243, 0.6));
      }
      .ka-quick-tile span:last-child {
        font-size: 11px;
        font-weight: 500;
        color: var(--on-surface-variant);
      }
      .ka-quick-tile:hover span:last-child { color: var(--on-surface); }
      .ka-nav-list { display: flex; flex-direction: column; gap: 2px; }
      .ka-nav-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        border: none;
        width: 100%;
        text-align: left;
        cursor: pointer;
        font: inherit;
        color: var(--on-surface-variant);
        background: transparent;
        transition: all 0.15s;
        position: relative;
      }
      .ka-nav-row:hover {
        background: var(--surface-container);
        color: var(--on-surface);
      }
      .ka-nav-row.ka-nav-active {
        background: var(--surface-container-highest);
        border-left: 2px solid var(--primary-container);
        color: var(--primary-fixed);
        padding-left: 10px;
      }
      .ka-nav-row .material-symbols-outlined { font-size: 20px; }
      .ka-nav-row.ka-nav-active .material-symbols-outlined {
        font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        color: var(--primary-fixed);
      }
      .ka-nav-ping {
        margin-left: auto;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--primary-container);
        box-shadow: 0 0 8px rgba(0, 229, 255, 0.6);
        animation: ka-pulse 2s infinite;
      }
      .ka-status-bento {
        padding: 16px;
        border-radius: 12px;
        background: var(--surface-container-low);
        border: 1px solid rgba(59, 73, 76, 0.45);
        position: relative;
        overflow: hidden;
      }
      .ka-status-bento::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(to top right, rgba(195, 245, 255, 0.06), transparent);
        pointer-events: none;
      }
      .ka-status-inner { position: relative; z-index: 1; }
      .ka-sidebar-footer {
        padding: 10px 12px;
        background: var(--surface-container-lowest);
        border-top: 1px solid var(--border-subtle);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }
      .ka-footer-ver {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 10px;
        color: var(--outline);
        font-weight: 500;
      }
      .ka-footer-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
      }

      /* Feature webview panels (no dashboard bottom nav) */
      body.ka-dashboard-body.ka-panel-page {
        padding-bottom: 0;
      }

      /* ── Cyber-Circuit Sidebar Enhancements ── */
      .ka-cyber-posture {
        position: relative;
        overflow: hidden;
        background: var(--surface-container);
        border-radius: 12px;
        padding: 20px;
      }
      .ka-cyber-posture::before {
        content: '';
        position: absolute;
        right: -40px;
        bottom: -40px;
        width: 140px;
        height: 140px;
        border-radius: 50%;
        background: rgba(0, 229, 255, 0.06);
        filter: blur(40px);
        pointer-events: none;
        transition: background 0.3s;
      }
      .ka-cyber-posture:hover::before {
        background: rgba(0, 229, 255, 0.12);
      }
      .ka-posture-label {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--outline);
        margin-bottom: 12px;
      }
      .ka-posture-score {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }
      .ka-posture-score .ka-score-num {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 52px;
        font-weight: 800;
        line-height: 1;
        color: var(--cyan-glow);
        filter: drop-shadow(0 0 10px rgba(0, 229, 255, 0.45));
      }
      .ka-posture-score .ka-score-max {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 18px;
        color: var(--on-surface-variant);
      }
      .ka-posture-desc {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 12px;
        line-height: 1.5;
      }
      .ka-posture-desc strong {
        color: var(--cyan-glow);
        font-weight: 700;
      }
      .ka-posture-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 16px;
      }
      .ka-posture-meta-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .ka-posture-meta-label {
        font-size: 9px;
        text-transform: uppercase;
        font-weight: 700;
        color: #64748b;
      }
      .ka-posture-meta-val {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .ka-posture-divider {
        width: 1px;
        height: 28px;
        background: rgba(255, 255, 255, 0.06);
      }

      /* Vulnerability bars */
      .ka-vuln-card {
        background: var(--surface-container);
        border-radius: 12px;
        padding: 16px;
        transition: background 0.2s;
      }
      .ka-vuln-card:hover {
        background: var(--surface-container-high);
      }
      .ka-vuln-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .ka-vuln-header .material-symbols-outlined {
        color: var(--cyan-glow);
        background: rgba(0, 229, 255, 0.1);
        padding: 6px;
        border-radius: 6px;
        font-size: 18px;
      }
      .ka-vuln-ref {
        font-size: 9px;
        font-family: monospace;
        color: #475569;
      }
      .ka-vuln-title {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 14px;
        color: var(--on-surface);
        margin-bottom: 12px;
      }
      .ka-vuln-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      .ka-vuln-row:last-child { margin-bottom: 0; }
      .ka-vuln-row-label {
        font-size: 11px;
        color: #94a3b8;
        min-width: 50px;
      }
      .ka-vuln-bar-track {
        flex: 1;
        height: 4px;
        background: var(--surface-container-highest);
        border-radius: 999px;
        overflow: hidden;
      }
      .ka-vuln-bar-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.6s ease;
      }
      .ka-vuln-row-count {
        font-size: 11px;
        font-family: monospace;
        font-weight: 700;
        min-width: 20px;
        text-align: right;
      }

      /* Recent ship checks */
      .ka-checks-card {
        background: var(--surface-container);
        border-radius: 12px;
        padding: 16px;
        transition: background 0.2s;
      }
      .ka-checks-card:hover {
        background: var(--surface-container-high);
      }
      .ka-checks-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .ka-checks-header .material-symbols-outlined {
        color: var(--secondary);
        background: rgba(176, 198, 255, 0.1);
        padding: 6px;
        border-radius: 6px;
        font-size: 18px;
      }
      .ka-checks-badge {
        font-size: 9px;
        font-family: monospace;
        color: #475569;
      }
      .ka-checks-title {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 14px;
        color: var(--on-surface);
        margin-bottom: 12px;
      }
      .ka-check-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        padding: 6px 0;
      }
      .ka-check-item .material-symbols-outlined {
        font-size: 16px;
      }
      .ka-check-name {
        flex: 1;
        color: #94a3b8;
      }
      .ka-check-time {
        font-size: 9px;
        font-family: monospace;
        color: #475569;
      }

      /* Active scans */
      .ka-scans-card {
        background: var(--surface-container);
        border-radius: 12px;
        padding: 16px;
        position: relative;
        overflow: hidden;
        transition: background 0.2s;
      }
      .ka-scans-card:hover {
        background: var(--surface-container-high);
      }
      .ka-scans-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .ka-scans-header .material-symbols-outlined {
        color: var(--primary);
        background: rgba(195, 245, 255, 0.1);
        padding: 6px;
        border-radius: 6px;
        font-size: 18px;
      }
      .ka-scans-running {
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(0, 229, 255, 0.15);
        color: var(--cyan-glow);
        font-size: 9px;
        font-weight: 800;
      }
      .ka-scans-title {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 14px;
        color: var(--on-surface);
        margin-bottom: 12px;
      }
      .ka-scan-progress {
        padding: 10px;
        background: var(--surface-container-lowest);
        border: 1px solid rgba(255, 255, 255, 0.04);
        border-radius: 8px;
        margin-bottom: 6px;
      }
      .ka-scan-progress:last-child { margin-bottom: 0; }
      .ka-scan-progress-head {
        display: flex;
        justify-content: space-between;
        font-size: 9px;
        text-transform: uppercase;
        font-weight: 700;
        color: #64748b;
        margin-bottom: 6px;
      }
      .ka-scan-progress-bar {
        height: 4px;
        width: 100%;
        background: #0f172a;
        border-radius: 999px;
        overflow: hidden;
      }
      .ka-scan-progress-fill {
        height: 100%;
        background: var(--cyan-glow);
        border-radius: 999px;
        transition: width 0.6s ease;
      }

      /* Live status feed */
      .ka-feed-card {
        background: var(--surface-container-lowest);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.04);
        overflow: hidden;
      }
      .ka-feed-header {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--surface-container-low);
      }
      .ka-feed-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ka-feed-header-left .material-symbols-outlined {
        font-size: 14px;
        color: #64748b;
      }
      .ka-feed-title {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 9px;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.15em;
        color: #94a3b8;
      }
      .ka-feed-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 9px;
        font-family: monospace;
        color: #475569;
      }
      .ka-feed-dot-live {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #22c55e;
      }
      .ka-feed-body {
        padding: 10px 14px;
        font-family: monospace;
        font-size: 10px;
        line-height: 1.7;
        max-height: 150px;
        overflow-y: auto;
      }
      .ka-sidebar-inner .ka-feed-body {
        max-height: min(320px, 42vh);
      }
      .ka-feed-line {
        display: flex;
        gap: 8px;
        transition: color 0.15s;
      }
      .ka-feed-line:hover .ka-feed-msg {
        color: var(--on-surface);
      }
      .ka-feed-ts {
        color: #334155;
        white-space: nowrap;
      }
      .ka-feed-level {
        font-weight: 700;
        white-space: nowrap;
      }
      .ka-feed-level-info { color: var(--cyan-glow); }
      .ka-feed-level-warn { color: var(--secondary); }
      .ka-feed-level-fail { color: var(--error); }
      .ka-feed-msg {
        color: #94a3b8;
      }
  `;
}
