/**
 * PROMPT_FIREWALL / Kinetic Core — CSP-safe styles.
 */
export const promptFirewallStitchCss = `
  @keyframes pf-radar-sweep {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .pf-radar-sweep { animation: pf-radar-sweep 4s linear infinite; transform-origin: center; }
  @keyframes pf-pulse-ring {
    0% { transform: scale(0.95); opacity: 0.8; }
    50% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.8; }
  }
  .pf-pulse-ring { animation: pf-pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  @keyframes pf-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .pf-page { padding: 0; min-height: 100vh; }
  .pf-head {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 24px;
    background: rgba(17, 19, 22, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .pf-head-left { display: flex; align-items: center; gap: 12px; }
  .pf-head-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 20px; font-weight: 700; letter-spacing: 0.15em;
    color: #22d3ee; margin: 0;
  }
  .pf-head-actions { display: flex; align-items: center; gap: 16px; }
  .pf-btn-analyze {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(0, 229, 255, 0.1);
    border: 1px solid rgba(0, 229, 255, 0.2);
    color: var(--primary-container);
    padding: 6px 16px;
    border-radius: 2px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
  }
  .pf-btn-analyze:hover { background: rgba(0, 229, 255, 0.2); }
  .pf-btn-analyze:active { transform: scale(0.95); }
  .pf-btn-analyze:disabled { opacity: 0.5; cursor: not-allowed; }
  .pf-icon-btn {
    background: none; border: none; color: #22d3ee; cursor: pointer;
    padding: 4px; border-radius: 4px;
  }
  .pf-icon-btn:hover { background: rgba(0, 229, 255, 0.1); }
  .pf-main { padding: 24px; max-width: 1080px; margin: 0 auto; }

  /* Input area */
  .pf-input-section { margin-bottom: 24px; }
  .pf-input-section label {
    display: block; font-family: 'Space Grotesk', sans-serif;
    font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
    color: var(--on-surface-variant); margin-bottom: 8px; text-transform: uppercase;
  }
  .pf-textarea {
    width: 100%; box-sizing: border-box;
    min-height: 120px; resize: vertical;
    background: var(--surface-container-high, #1e2024);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px; padding: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px; line-height: 1.6;
    color: var(--on-surface, #e0e0e0);
    transition: border-color 0.2s;
  }
  .pf-textarea:focus {
    outline: none;
    border-color: rgba(0, 229, 255, 0.5);
    box-shadow: 0 0 0 2px rgba(0, 229, 255, 0.1);
  }
  .pf-options-row {
    display: flex; gap: 16px; flex-wrap: wrap;
    margin-top: 10px;
    font-family: 'Space Grotesk', sans-serif; font-size: 12px;
    color: var(--on-surface-variant);
  }
  .pf-options-row label {
    display: inline-flex; align-items: center; gap: 4px;
    cursor: pointer; font-size: 12px; text-transform: none; letter-spacing: 0;
  }
  .pf-options-row input[type="checkbox"] { accent-color: #22d3ee; }

  /* Progress */
  .pf-progress { margin: 24px 0; display: none; }
  .pf-progress.active { display: block; }
  .pf-progress-msg {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px; color: var(--on-surface-variant);
    letter-spacing: 0.05em; margin-bottom: 8px;
  }
  .pf-progress-bar {
    width: 100%; height: 3px;
    background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;
  }
  .pf-progress-fill {
    height: 100%; width: 0%;
    background: linear-gradient(90deg, #22d3ee, #06b6d4);
    transition: width 0.4s ease;
  }

  /* Dashboard */
  .pf-dashboard { display: none; }
  .pf-dashboard.active { display: block; }

  /* Hero grid */
  .pf-hero-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    margin-bottom: 24px;
  }
  @media (max-width: 640px) {
    .pf-hero-grid { grid-template-columns: 1fr; }
  }
  .pf-score-card, .pf-injection-card {
    background: var(--surface-container, #16181c);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px; padding: 24px;
    display: flex; flex-direction: column; align-items: center;
  }
  .pf-ring-wrap { position: relative; width: 160px; height: 160px; }
  .pf-ring-center {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }
  .pf-score-num {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 36px; font-weight: 700; color: #22d3ee;
  }
  .pf-score-denom {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px; color: var(--on-surface-variant);
  }
  .pf-score-label {
    margin-top: 12px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
    color: var(--on-surface-variant); text-transform: uppercase;
  }

  /* Injection status card */
  .pf-injection-status {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; margin-top: 12px;
  }
  .pf-injection-status.clean { color: #4ade80; }
  .pf-injection-status.detected { color: #f87171; }
  .pf-injection-icon { font-size: 48px; margin-bottom: 8px; }
  .pf-injection-icon.clean { color: #4ade80; }
  .pf-injection-icon.detected { color: #f87171; }

  /* Summary 3-col */
  .pf-summary-3 {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
    margin-bottom: 24px;
  }
  @media (max-width: 640px) {
    .pf-summary-3 { grid-template-columns: 1fr; }
  }
  .pf-summary-card {
    background: var(--surface-container, #16181c);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 8px; padding: 16px; text-align: center;
  }
  .pf-summary-val {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 28px; font-weight: 700; color: #22d3ee;
  }
  .pf-summary-label {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
    color: var(--on-surface-variant); text-transform: uppercase;
    margin-top: 4px;
  }

  /* Section headers */
  .pf-section { margin-bottom: 24px; }
  .pf-section-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px; font-weight: 700; letter-spacing: 0.12em;
    color: #22d3ee; text-transform: uppercase;
    margin-bottom: 12px; padding-bottom: 8px;
    border-bottom: 1px solid rgba(0, 229, 255, 0.1);
  }

  /* Check items */
  .pf-check {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px; margin-bottom: 8px;
    background: var(--surface-container, #16181c);
    border-radius: 6px;
    border-left: 3px solid transparent;
  }
  .pf-check.pass { border-left-color: #4ade80; }
  .pf-check.fail { border-left-color: #f87171; }
  .pf-check.warning { border-left-color: #fbbf24; }
  .pf-check-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
  .pf-check-icon.pass { color: #4ade80; }
  .pf-check-icon.fail { color: #f87171; }
  .pf-check-icon.warning { color: #fbbf24; }
  .pf-check-body { flex: 1; }
  .pf-check-name {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px; font-weight: 600; color: var(--on-surface);
  }
  .pf-check-msg {
    font-size: 12px; color: var(--on-surface-variant);
    margin-top: 2px; line-height: 1.4;
  }
  .pf-check-evidence {
    font-size: 11px; color: var(--on-surface-variant);
    opacity: 0.7; margin-top: 4px; font-style: italic;
  }

  /* Task cards */
  .pf-task {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px; margin-bottom: 8px;
    background: var(--surface-container, #16181c);
    border-radius: 6px;
  }
  .pf-task-priority {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
    padding: 2px 8px; border-radius: 2px; text-transform: uppercase;
    flex-shrink: 0;
  }
  .pf-task-priority.critical { background: rgba(248,113,113,0.15); color: #f87171; }
  .pf-task-priority.high { background: rgba(251,191,36,0.15); color: #fbbf24; }
  .pf-task-priority.medium { background: rgba(34,211,238,0.15); color: #22d3ee; }
  .pf-task-priority.low { background: rgba(255,255,255,0.05); color: var(--on-surface-variant); }
  .pf-task-body { flex: 1; }
  .pf-task-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px; font-weight: 600; color: var(--on-surface);
  }
  .pf-task-desc {
    font-size: 12px; color: var(--on-surface-variant);
    margin-top: 2px; line-height: 1.4;
  }
  .pf-task-meta {
    font-size: 11px; color: var(--on-surface-variant);
    opacity: 0.6; margin-top: 4px;
  }

  /* Fix cards */
  .pf-fix {
    padding: 16px; margin-bottom: 12px;
    background: var(--surface-container, #16181c);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 6px;
  }
  .pf-fix-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 8px;
  }
  .pf-fix-type {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
    padding: 2px 8px; border-radius: 2px; text-transform: uppercase;
    background: rgba(0, 229, 255, 0.1); color: #22d3ee;
  }
  .pf-fix-apply {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
    background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.2);
    color: #4ade80; padding: 4px 12px; border-radius: 2px; cursor: pointer;
    transition: background 0.2s;
  }
  .pf-fix-apply:hover { background: rgba(74, 222, 128, 0.2); }
  .pf-fix-apply:disabled { opacity: 0.4; cursor: not-allowed; }
  .pf-fix-apply.applied { background: rgba(74, 222, 128, 0.05); color: #4ade80; opacity: 0.6; }
  .pf-fix-desc {
    font-size: 13px; color: var(--on-surface);
    margin-bottom: 8px;
  }
  .pf-fix-file {
    font-size: 11px; color: var(--on-surface-variant);
    font-family: 'JetBrains Mono', monospace;
    margin-bottom: 8px;
  }
  .pf-fix-diff {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
  }
  .pf-fix-before, .pf-fix-after {
    padding: 8px; border-radius: 4px; white-space: pre-wrap;
    overflow-x: auto;
  }
  .pf-fix-before {
    background: rgba(248,113,113,0.06); border: 1px solid rgba(248,113,113,0.15);
    color: #fca5a5;
  }
  .pf-fix-after {
    background: rgba(74,222,128,0.06); border: 1px solid rgba(74,222,128,0.15);
    color: #86efac;
  }

  /* Recommendations */
  .pf-rec {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 12px; margin-bottom: 6px;
    background: var(--surface-container, #16181c);
    border-radius: 6px;
    font-size: 13px; color: var(--on-surface);
  }
  .pf-rec-icon { color: #22d3ee; font-size: 16px; flex-shrink: 0; }

  /* Empty state */
  .pf-empty {
    text-align: center; padding: 64px 24px;
    color: var(--on-surface-variant);
  }
  .pf-empty .material-symbols-outlined { font-size: 64px; color: rgba(0, 229, 255, 0.2); }
  .pf-empty h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 18px; font-weight: 700; color: var(--on-surface);
    margin: 16px 0 8px;
  }
  .pf-empty p { font-size: 13px; line-height: 1.5; }

  /* Error */
  .pf-error {
    padding: 16px; margin: 16px 0;
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.2);
    border-radius: 6px;
    color: #fca5a5; font-size: 13px;
    display: none;
  }
  .pf-error.active { display: block; }
`;
