/**
 * Cyber-Circuit AI Explainer — panel-specific styles (CSP-safe).
 */
export const cyberCircuitPanelCss = `
  :root {
    --secondary-fixed: #d9e2ff;
    --ce-rail-bg: #1c1f24;
    --ce-rail-hover: #23272e;
  }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
  }
  body.ka-dashboard-body.ka-ce-page {
    min-height: max(884px, 100dvh);
    min-height: 100vh;
    padding: 0 0 72px;
    background: var(--background);
    overflow-x: hidden;
  }
  @media (min-width: 768px) {
    body.ka-dashboard-body.ka-ce-page { padding-bottom: 24px; }
  }
  .ka-ce-page .material-symbols-outlined {
    font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
  }
  .ka-ce-rail-icon-fill,
  .ka-ce-topbar-ico { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
  .neon-glow { box-shadow: 0 0 15px rgba(0, 229, 255, 0.2); }
  .glass-panel {
    background: rgba(30, 32, 35, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #111316; }
  ::-webkit-scrollbar-thumb { background: #3b494c; border-radius: 10px; }

  .ka-ce-glow {
    position: fixed; pointer-events: none; z-index: 0; border-radius: 50%;
    filter: blur(100px);
  }
  .ka-ce-glow-br {
    bottom: 0; right: 0; width: 500px; height: 500px;
    background: rgba(195, 245, 255, 0.05);
  }
  .ka-ce-glow-tl {
    top: 25%; left: -80px; width: 300px; height: 300px;
    background: rgba(0, 104, 237, 0.05);
    filter: blur(100px);
  }

  .ka-ce-rail {
    position: fixed; left: 0; top: 0; bottom: 0; z-index: 50;
    width: 48px; height: 100%;
    background: var(--ce-rail-bg);
    display: flex; flex-direction: column;
    transition: width 0.3s ease;
    overflow: hidden;
    border-right: 1px solid rgba(255,255,255,0.04);
  }
  .ka-ce-rail:hover { width: 256px; }
  .ka-ce-rail-brand {
    display: flex; align-items: center; gap: 12px;
    padding: 16px; overflow: hidden; white-space: nowrap;
  }
  .ka-ce-rail-brand .material-symbols-outlined { color: var(--primary-container); font-size: 24px; flex-shrink: 0; }
  .ka-ce-rail-logo {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 900; font-style: italic; letter-spacing: -0.03em;
    color: var(--primary-container);
    font-size: 14px;
    opacity: 0; transition: opacity 0.25s;
  }
  .ka-ce-rail:hover .ka-ce-rail-logo { opacity: 1; }
  .ka-ce-rail-nav { display: flex; flex-direction: column; flex: 1; margin-top: 16px; }
  .ka-ce-rail-spacer { flex: 1; min-height: 8px; }
  .ka-ce-rail-btn {
    display: flex; align-items: center; gap: 16px;
    padding: 12px 12px;
    border: none; background: none; cursor: pointer;
    color: #64748b; opacity: 0.85;
    text-align: left; width: 100%;
    font: inherit; transition: color 0.2s, background 0.2s;
  }
  .ka-ce-rail-btn:hover { color: #c3f5ff; background: var(--ce-rail-hover); }
  .ka-ce-rail-btn .material-symbols-outlined { flex-shrink: 0; font-size: 22px; }
  .ka-ce-rail-label {
    font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.15em;
    opacity: 0; transition: opacity 0.25s;
  }
  .ka-ce-rail:hover .ka-ce-rail-label { opacity: 1; }
  .ka-ce-rail-active {
    border-left: 2px solid #00e5ff;
    background: #2a2d35;
    color: #00e5ff !important;
    opacity: 1 !important;
  }

  .ka-ce-topbar {
    position: sticky; top: 0; z-index: 40;
    background: var(--ce-rail-bg);
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 24px 12px 72px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .ka-ce-topbar-left { display: flex; align-items: center; gap: 12px; }
  .ka-ce-topbar-ico { color: #00e5ff; font-size: 26px; }
  .ka-ce-topbar-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 20px; font-weight: 700; letter-spacing: -0.02em;
    color: #00e5ff; text-transform: uppercase; margin: 0;
  }
  .ka-ce-topbar-right { display: flex; align-items: center; gap: 16px; }
  .ka-ce-topbar-links { display: none; gap: 24px; margin-right: 8px; }
  @media (min-width: 768px) {
    .ka-ce-topbar-links { display: flex; }
  }
  .ka-ce-link-quiet {
    background: none; border: none; cursor: pointer;
    font-size: 14px; color: #94a3b8;
    font-family: Inter, sans-serif;
    transition: color 0.2s;
  }
  .ka-ce-link-quiet:hover { color: #00e5ff; }
  .ka-ce-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--surface-container-highest);
    border: 1px solid var(--outline-variant);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: var(--primary-fixed-dim);
  }

  .ka-ce-main {
    position: relative; z-index: 1;
    padding: 16px;
    max-width: 1280px;
    margin-left: auto;
    margin-right: auto;
    display: flex; flex-direction: column; gap: 32px;
  }
  @media (min-width: 768px) {
    .ka-ce-main { margin-left: 48px; margin-right: auto; padding: 24px 32px; }
  }

  .ka-ce-hero-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
  }
  @media (min-width: 1024px) {
    .ka-ce-hero-grid {
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    }
  }

  .ka-ce-code-shell {
    background: var(--surface-container-low);
    padding: 4px;
    border-radius: 8px;
  }
  .ka-ce-code-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 16px;
    background: var(--surface-container-high);
    border-radius: 8px 8px 0 0;
  }
  .ka-ce-dots { display: flex; gap: 8px; }
  .ka-ce-dot {
    width: 12px; height: 12px; border-radius: 50%;
    border: 1px solid var(--outline-variant);
  }
  .ka-ce-dot-r { background: rgba(255, 180, 171, 0.2); border-color: rgba(255, 180, 171, 0.4); }
  .ka-ce-dot-y { background: rgba(255, 231, 230, 0.2); border-color: rgba(255, 231, 230, 0.4); }
  .ka-ce-dot-g { background: rgba(195, 245, 255, 0.2); border-color: rgba(195, 245, 255, 0.4); }
  .ka-ce-code-title {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--on-surface-variant);
  }
  .ka-ce-textarea {
    width: 100%; min-height: 256px;
    background: var(--surface-container-lowest);
    border: none;
    padding: 16px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 13px; line-height: 1.5;
    color: var(--on-surface);
    resize: vertical;
    border-radius: 0 0 4px 4px;
  }
  .ka-ce-textarea:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--primary-container);
  }

  .ka-ce-actions-row {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
    gap: 16px; margin-top: 16px;
  }
  .ka-ce-actions-left { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .ka-ce-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    background: linear-gradient(to bottom right, var(--primary), var(--primary-container));
    color: var(--on-primary-container);
    border: none;
    border-radius: 2px;
    padding: 12px 32px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700; font-size: 12px; letter-spacing: 0.06em;
    cursor: pointer;
    box-shadow: 0 0 20px rgba(0, 229, 255, 0.2);
    transition: transform 0.15s, box-shadow 0.2s;
  }
  .ka-ce-btn-primary:hover:not(:disabled) {
    box-shadow: 0 0 30px rgba(0, 229, 255, 0.3);
  }
  .ka-ce-btn-primary:active:not(:disabled) { transform: scale(0.97); }
  .ka-ce-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .ka-ce-btn-primary .material-symbols-outlined { font-size: 22px; }
  .ka-ce-btn-secondary {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--surface-container-high);
    color: var(--on-surface);
    border: none; border-radius: 4px;
    padding: 8px 16px;
    font-family: Inter, sans-serif;
    font-weight: 500; font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .ka-ce-btn-secondary:hover { background: #2a2d35; }
  .ka-ce-ready {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: var(--on-surface-variant);
    font-family: Inter, sans-serif;
  }
  .ka-ce-ready-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--primary);
    animation: ka-ce-pulse 2s ease-in-out infinite;
  }
  @keyframes ka-ce-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
  .ka-ce-subactions {
    display: flex; align-items: center; gap: 8px; margin-top: 8px;
    font-size: 12px;
  }
  .ka-ce-link {
    background: none; border: none; cursor: pointer;
    color: var(--primary-fixed-dim);
    text-decoration: underline;
    font-size: 12px;
  }
  .ka-ce-link:hover { color: var(--primary); }
  .ka-ce-subdot { color: var(--outline); }

  .ka-ce-progress {
    margin-top: 16px; padding: 12px 16px;
    background: var(--surface-container-low);
    border-radius: 4px;
    border: 1px solid var(--border-subtle);
  }
  .ka-ce-progress-msg { font-size: 12px; font-weight: 500; margin-bottom: 8px; }
  .ka-ce-progress-bar {
    height: 6px; background: var(--surface-container-highest);
    border-radius: 4px; overflow: hidden;
  }
  .ka-ce-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary-container), var(--secondary-container));
    transition: width 0.3s ease;
  }

  .ka-ce-config-card {
    background: var(--surface-container-low);
    padding: 24px;
    border-radius: 2px;
    border-left: 1px solid rgba(0, 229, 255, 0.3);
  }
  .ka-ce-config-head {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px; font-weight: 700;
    color: var(--primary-container);
    letter-spacing: 0.08em; text-transform: uppercase;
    display: flex; align-items: center; gap: 8px;
    margin: 0 0 24px;
  }
  .ka-ce-config-body { display: flex; flex-direction: column; gap: 24px; }
  .ka-ce-field-lbl {
    display: block;
    font-size: 11px; font-weight: 500;
    color: var(--on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }
  .ka-ce-finding-lbl { margin-top: 8px; }
  .ka-ce-seg {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 4px;
    background: var(--surface-container-lowest);
    padding: 4px;
    border-radius: 2px;
  }
  .ka-ce-seg-btn {
    font-size: 10px;
    padding: 8px 4px;
    border: none; border-radius: 2px;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    font-family: Inter, sans-serif;
    font-weight: 600;
    transition: color 0.2s, background 0.2s;
  }
  .ka-ce-seg-btn:hover { color: var(--on-surface); }
  .ka-ce-seg-btn.is-active {
    background: var(--surface-container-highest);
    color: var(--primary);
    font-weight: 700;
  }
  .ka-ce-toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--surface-container-lowest);
    padding: 12px;
    border-radius: 2px;
  }
  .ka-ce-toggle-title { font-size: 12px; font-weight: 500; color: var(--on-surface); }
  .ka-ce-toggle-sub { font-size: 10px; color: var(--on-surface-variant); margin-top: 2px; }
  .ka-ce-switch {
    width: 40px; height: 20px;
    border-radius: 999px;
    background: var(--outline-variant);
    border: none;
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
    transition: background 0.2s;
  }
  .ka-ce-switch::after {
    content: '';
    position: absolute;
    top: 4px; left: 4px;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: var(--on-surface);
    transition: transform 0.2s;
  }
  .ka-ce-switch.is-on {
    background: var(--primary-container);
  }
  .ka-ce-switch.is-on::after {
    transform: translateX(20px);
    background: var(--on-primary-container);
  }
  .ka-ce-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 4px;
    border: 1px solid var(--border-subtle);
    background: var(--surface-container-highest);
    color: var(--on-surface);
    font-size: 12px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  .ka-ce-quota {
    padding-top: 16px;
    border-top: 1px solid rgba(59, 73, 76, 0.3);
  }
  .ka-ce-quota-txt {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px;
    color: rgba(180, 0, 43, 0.55);
    margin-bottom: 8px;
  }
  .ka-ce-quota-track {
    height: 4px; background: var(--surface-container-highest);
    border-radius: 4px; overflow: hidden;
  }
  .ka-ce-quota-fill { width: 33.333%; height: 100%; background: var(--primary-container); }

  .ka-ce-model-card {
    position: relative;
    height: 128px;
    border-radius: 2px;
    overflow: hidden;
    cursor: default;
  }
  .ka-ce-model-bg {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse at 30% 50%, rgba(0, 229, 255, 0.18) 0%, transparent 55%),
      radial-gradient(ellipse at 70% 30%, rgba(0, 104, 237, 0.14) 0%, transparent 50%),
      linear-gradient(180deg, #1a1c1f 0%, #0c0e11 100%);
    opacity: 0.95;
    transition: filter 0.7s, transform 0.7s;
  }
  .ka-ce-model-card:hover .ka-ce-model-bg {
    filter: brightness(1.12);
    transform: scale(1.03);
  }
  .ka-ce-model-fade {
    position: absolute; inset: 0;
    background: linear-gradient(to top, var(--background), transparent);
  }
  .ka-ce-model-copy {
    position: absolute; bottom: 12px; left: 16px; z-index: 1;
  }
  .ka-ce-model-k {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px; font-weight: 700;
    color: var(--primary);
    letter-spacing: 0.2em;
    margin: 0;
  }
  .ka-ce-model-sub {
    font-size: 8px; color: var(--on-surface-variant); margin: 2px 0 0;
      font-family: Inter, sans-serif;
  }

  .ka-ce-results { margin-top: 8px; }
  .ka-ce-results-head {
    display: flex; align-items: center; gap: 16px;
    margin-bottom: 8px;
  }
  .ka-ce-results-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 24px; font-weight: 700;
    color: var(--on-surface);
    margin: 0;
  }
  .ka-ce-results-line {
    flex: 1; height: 1px;
    background: linear-gradient(to right, var(--outline-variant), transparent);
  }
  .ka-ce-results-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }
  @media (min-width: 768px) {
    .ka-ce-results-grid {
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    }
  }

  .ka-ce-summary-card {
    background: var(--surface-container-low);
    border-radius: 2px;
    padding: 24px;
    position: relative;
    overflow: hidden;
    display: flex; flex-direction: column; gap: 24px;
  }
  .ka-ce-summary-glow {
    position: absolute; top: 0; right: 0;
    width: 128px; height: 128px;
    background: rgba(195, 245, 255, 0.05);
    border-radius: 50%;
    filter: blur(40px);
    margin: -32px -32px 0 0;
  }
  .ka-ce-summary-top {
    display: flex; align-items: flex-start; justify-content: space-between;
    position: relative; z-index: 1;
  }
  .ka-ce-summary-left { display: flex; gap: 16px; align-items: flex-start; }
  .ka-ce-icon-box {
    padding: 12px;
    background: var(--surface-container-highest);
    border-radius: 2px;
    border: 1px solid rgba(59, 73, 76, 0.3);
  }
  .ka-ce-ico-lg { font-size: 32px; color: var(--primary-container); }
  .ka-ce-algo-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 18px; font-weight: 700;
    color: var(--on-surface);
    margin: 0;
  }
  .ka-ce-meta-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
    margin-top: 4px;
  }
  .ka-ce-chip {
    padding: 2px 8px;
    background: rgba(0, 104, 237, 0.2);
    color: var(--secondary-fixed);
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    border-radius: 2px;
  }
  .ka-ce-read {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; color: var(--on-surface-variant);
  }
  .ka-ce-ico-xs { font-size: 14px !important; }
  .ka-ce-icon-btn {
    background: none; border: none; cursor: pointer;
    color: var(--on-surface-variant);
    padding: 4px;
    border-radius: 4px;
    transition: color 0.2s;
  }
  .ka-ce-icon-btn:hover { color: var(--primary); }
  .ka-ce-summary-body {
    font-size: 14px; line-height: 1.65;
    color: var(--on-surface-variant);
    position: relative; z-index: 1;
  }
  .ka-ce-purpose {
    background: var(--surface-container-lowest);
    padding: 16px;
    border-radius: 2px;
    border-left: 2px solid var(--primary);
  }
  .ka-ce-purpose-lbl {
    font-size: 10px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    color: var(--primary);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin: 0 0 8px;
  }
  .ka-ce-purpose-quote {
    font-size: 14px; line-height: 1.5;
    color: var(--on-surface);
    font-style: italic;
    margin: 0;
  }
  .ka-ce-two-col {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    position: relative; z-index: 1;
  }
  @media (min-width: 640px) {
    .ka-ce-two-col { grid-template-columns: 1fr 1fr; }
  }
  .ka-ce-mini-h {
    font-size: 10px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    color: var(--on-surface-variant);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 12px;
  }
  .ka-ce-kc-list { list-style: none; padding: 0; margin: 0; }
  .ka-ce-kc-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12px;
    padding: 8px;
    background: var(--surface-container-high);
    border-radius: 2px;
    margin-bottom: 8px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  .ka-ce-kc-meta { color: var(--primary-container); font-size: 11px; }
  .ka-ce-kc-empty { font-size: 12px; color: var(--on-surface-variant); padding: 8px; }
  .ka-ce-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .ka-ce-chip-outline {
    padding: 4px 8px;
    border-radius: 2px;
    font-size: 10px;
    background: var(--surface-container-highest);
    border: 1px solid rgba(59, 73, 76, 0.3);
    color: var(--on-surface);
  }
  .ka-ce-chip-muted { font-size: 12px; color: var(--on-surface-variant); }

  .ka-ce-side-col { display: flex; flex-direction: column; gap: 24px; }
  .ka-ce-opt-card {
    background: var(--surface-container-low);
    padding: 20px;
    border-radius: 2px;
    border: 1px solid rgba(59, 73, 76, 0.2);
  }
  .ka-ce-opt-head {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px; font-weight: 700;
    color: var(--tertiary);
    display: flex; align-items: center; gap: 8px;
    margin: 0 0 16px;
  }
  .ka-ce-opt-list { display: flex; flex-direction: column; gap: 16px; }
  .ka-ce-opt-item { cursor: default; }
  .ka-ce-opt-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 4px;
  }
  .ka-ce-opt-title { font-size: 11px; font-weight: 700; color: var(--on-surface); }
  .ka-ce-pri-hi { font-size: 9px; text-transform: uppercase; color: var(--tertiary); }
  .ka-ce-pri-lo { font-size: 9px; text-transform: uppercase; color: var(--on-surface-variant); }
  .ka-ce-pri-md { font-size: 9px; text-transform: uppercase; color: var(--outline); }
  .ka-ce-opt-desc {
    font-size: 11px; line-height: 1.45;
    color: var(--on-surface-variant);
    margin: 0;
    transition: color 0.2s;
  }
  .ka-ce-opt-item:hover .ka-ce-opt-desc { color: var(--on-surface); }
  .ka-ce-opt-empty { font-size: 12px; color: var(--on-surface-variant); margin: 0; }

  .ka-ce-side-btns { display: flex; flex-direction: column; gap: 12px; }
  .ka-ce-outline-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%;
    padding: 12px;
    border: 1px solid rgba(59, 73, 76, 0.3);
    border-radius: 2px;
    background: transparent;
    color: var(--on-surface);
    font-size: 11px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
  }
  .ka-ce-outline-btn:hover { background: var(--surface-container-high); }
  .ka-ce-outline-btn .material-symbols-outlined { font-size: 20px; }
  .ka-ce-feedback-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%;
    padding: 12px;
    background: var(--surface-container-highest);
    border: none;
    border-radius: 2px;
    color: #94a3b8;
    font-size: 10px;
    font-family: Inter, sans-serif;
    cursor: pointer;
    transition: color 0.2s;
  }
  .ka-ce-feedback-btn:hover { color: var(--on-surface); }

  .ka-ce-mobile-nav {
    display: flex;
    justify-content: space-around;
    position: fixed;
    bottom: 0; left: 0; right: 0; z-index: 50;
    padding: 8px 0;
    background: rgba(17, 19, 22, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 -4px 20px rgba(0, 229, 255, 0.1);
  }
  @media (min-width: 768px) {
    .ka-ce-mobile-nav { display: none; }
  }
  .ka-ce-mnav-btn {
    background: none; border: none; cursor: pointer;
    color: #475569;
    padding: 8px;
    border-radius: 999px;
    transition: color 0.2s, box-shadow 0.2s;
  }
  .ka-ce-mnav-btn:hover { color: #00e5ff; }
  .ka-ce-mnav-active {
    color: #00e5ff !important;
    box-shadow: 0 0 15px rgba(0, 229, 255, 0.3);
  }
`;
