/**
 * MDC Generator — Prism / cyber-grid shell (CSP-safe; from Stitch mock).
 */
export const mdcGeneratorStitchCss = `
  .mdc-page { position: relative; }
  .mdc-cyber-grid {
    pointer-events: none;
    position: fixed;
    inset: 0;
    opacity: 0.07;
    background-image:
      linear-gradient(rgba(0, 229, 255, 0.35) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 229, 255, 0.35) 1px, transparent 1px);
    background-size: 32px 32px;
    z-index: 0;
  }
  .mdc-shell { position: relative; z-index: 1; padding: 16px 20px 32px; max-width: 1100px; margin: 0 auto; }
  .mdc-head {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
    padding: 10px 0 20px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .mdc-head-icon {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    border: 1px solid rgba(0, 229, 255, 0.25);
    background: rgba(0, 229, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }
  .mdc-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #00e5ff;
    text-transform: uppercase;
    margin: 0 0 6px;
  }
  .mdc-sub { color: var(--on-surface-variant); font-size: 13px; line-height: 1.45; max-width: 42rem; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body.ka-dashboard-body {
    font-family: 'Inter', sans-serif;
    padding: 0;
    background: var(--background);
    color: var(--on-surface);
  }
  .controls {
    background: rgba(30, 32, 35, 0.65);
    backdrop-filter: blur(12px);
    padding: 20px;
    border-radius: 4px;
    margin-bottom: 20px;
    border: 1px solid rgba(59, 73, 76, 0.35);
  }
  .control-row {
    display: flex;
    gap: 15px;
    margin-bottom: 15px;
    flex-wrap: wrap;
  }
  .control-group { flex: 1; min-width: 200px; }
  .control-group label {
    display: block;
    margin-bottom: 5px;
    font-size: 11px;
    font-family: 'Space Grotesk', sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--on-surface-variant);
  }
  select, input[type="checkbox"] {
    background: var(--surface-container-low);
    border: 1px solid var(--border-subtle);
    color: var(--on-surface);
    padding: 8px;
    border-radius: 4px;
    width: 100%;
  }
  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--surface-container-high);
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .checkbox-item input { width: auto; }
  .btn {
    background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
    color: #001f24;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn:hover { filter: brightness(1.08); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary {
    background: var(--surface-container-high);
    color: var(--on-surface);
    border: 1px solid var(--border-subtle);
  }
  .button-row {
    display: flex;
    gap: 10px;
    margin-top: 15px;
    flex-wrap: wrap;
  }
  .progress-container {
    display: none;
    margin: 20px 0;
    padding: 20px;
    background: var(--surface-container-low);
    border-radius: 4px;
    border: 1px solid rgba(59, 73, 76, 0.35);
  }
  .progress-bar {
    height: 8px;
    background: var(--surface-container-highest);
    border-radius: 4px;
    overflow: hidden;
    margin-top: 10px;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary-container), var(--secondary-container));
    transition: width 0.3s ease;
  }
  .results {
    display: none;
  }
  .result-card {
    background: var(--surface-container-low);
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: transform 0.1s;
    border: 1px solid rgba(59, 73, 76, 0.25);
  }
  .result-card:hover { transform: translateX(5px); border-color: rgba(0, 229, 255, 0.2); }
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .result-title { font-weight: bold; font-size: 16px; }
  .result-badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: bold;
  }
  .badge-low { background: #6bcb77; color: #000; }
  .badge-medium { background: #ffd93d; color: #000; }
  .badge-high { background: #ff6b6b; color: #000; }
  .result-meta {
    display: flex;
    gap: 20px;
    font-size: 12px;
    color: var(--on-surface-variant);
    flex-wrap: wrap;
  }
  .patterns-list {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  .pattern-tag {
    background: var(--surface-container-high);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
  }
  .summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
  }
  .summary-card {
    background: linear-gradient(135deg, rgba(107, 203, 119, 0.1) 0%, rgba(107, 203, 119, 0.05) 100%);
    border: 1px solid rgba(107, 203, 119, 0.3);
    padding: 15px;
    border-radius: 4px;
    text-align: center;
  }
  .summary-value { font-size: 28px; font-weight: bold; color: #6bcb77; }
  .summary-label { font-size: 12px; color: var(--on-surface-variant); }
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--on-surface-variant);
  }
  .empty-icon { font-size: 48px; margin-bottom: 15px; }
`;
