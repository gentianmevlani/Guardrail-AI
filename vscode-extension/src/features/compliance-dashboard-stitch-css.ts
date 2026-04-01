/**
 * Compliance Dashboard — CSP-safe panel CSS (Guardrail family).
 */
export const complianceDashboardStitchCss = `
  .comp-strip {
    margin: 0;
    padding: 8px 20px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: linear-gradient(180deg, rgba(0, 229, 255, 0.04) 0%, transparent 100%);
  }
  .comp-strip svg { width: 100%; height: 44px; display: block; opacity: 0.75; }
  .section-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--on-surface-variant); margin-bottom: 12px; }
  .fw-selector { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .fw-btn {
    background: var(--surface-container-high); color: var(--on-surface); border: 1px solid var(--border-subtle);
    padding: 6px 14px; border-radius: 8px; cursor: pointer;
    font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
    font-family: 'Space Grotesk', sans-serif; transition: all 0.2s;
  }
  .fw-btn.selected { background: rgba(0, 229, 255, 0.12); color: var(--primary-fixed-dim); border-color: rgba(0, 229, 255, 0.35); }
  .progress-container { display: none; margin: 16px 0; padding: 16px; background: var(--surface-container-low); border-radius: 12px; border: 1px solid var(--border-subtle); }
  .progress-bar { height: 6px; background: var(--surface-container-highest); border-radius: 3px; overflow: hidden; margin-top: 8px; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary-container), var(--secondary-container)); transition: width 0.3s ease; border-radius: 3px; }
  .progress-msg { font-size: 12px; color: var(--on-surface); }
  .score-section { display: none; }
  .overall-score {
    background: linear-gradient(135deg, var(--surface-container-low), var(--surface-container-high)); border-radius: 16px;
    padding: 28px; text-align: center; margin-bottom: 16px;
    border: 1px solid rgba(0, 229, 255, 0.1);
    box-shadow: 0 0 32px rgba(0, 229, 255, 0.06);
  }
  .score-value { font-family: 'Space Grotesk', sans-serif; font-size: 56px; font-weight: 700; }
  .score-label { font-size: 11px; color: var(--outline); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
  .fw-scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .fw-score-card {
    background: var(--surface-container-low); padding: 16px; border-radius: 12px; text-align: center;
    border: 1px solid var(--border-subtle);
  }
  .fw-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 13px; margin-bottom: 8px; }
  .fw-score { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; }
  .fw-details { font-size: 10px; color: var(--outline); margin-top: 4px; }
  .filter-tabs { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
  .filter-tab {
    background: none; border: 1px solid var(--border-subtle); color: var(--on-surface-variant);
    cursor: pointer; padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; transition: all 0.2s;
  }
  .filter-tab.active { background: rgba(0, 229, 255, 0.12); color: var(--primary-fixed-dim); border-color: rgba(0, 229, 255, 0.3); }
  .check-card {
    background: var(--surface-container-low); padding: 14px 16px; border-radius: 12px; margin-bottom: 8px;
    cursor: pointer; transition: all 0.2s;
    border: 1px solid var(--border-subtle); border-left: 3px solid var(--outline-variant);
  }
  .check-card:hover { background: var(--surface-container-high); transform: translateX(4px); }
  .check-card.passed { border-left-color: var(--primary-fixed-dim); }
  .check-card.failed { border-left-color: #cf2c2c; }
  .check-card.warning { border-left-color: #ff8c00; }
  .check-card.not-applicable { border-left-color: var(--outline-variant); }
  .check-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .check-title { font-weight: 700; font-size: 13px; }
  .check-badge { padding: 2px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge-passed { background: rgba(0, 229, 255, 0.12); color: var(--primary-fixed-dim); }
  .badge-failed { background: rgba(207,44,44,0.2); color: var(--error); }
  .badge-warning { background: rgba(255,140,0,0.2); color: #ffb786; }
  .badge-not-applicable { background: rgba(66,71,84,0.3); color: var(--on-surface-variant); }
  .check-meta { display: flex; gap: 16px; margin-top: 6px; font-size: 11px; color: var(--on-surface-variant); flex-wrap: wrap; }
  .check-description { margin-top: 8px; font-size: 12px; color: var(--on-surface); }
  .check-remediation { margin-top: 8px; padding: 10px; background: rgba(207,44,44,0.08); border-radius: 8px; font-size: 11px; color: var(--on-surface); }
  .empty-state { text-align: center; padding: 60px 20px; color: var(--on-surface-variant); }
  .empty-state .material-symbols-outlined { font-size: 48px; color: var(--primary-fixed-dim); margin-bottom: 12px; }
  .empty-state h3 { font-family: 'Space Grotesk', sans-serif; margin-bottom: 8px; color: var(--on-surface); }
  .export-dropdown { position: relative; display: inline-block; }
  .export-menu { display: none; position: absolute; right: 0; top: 100%; background: var(--surface-container-high); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 4px 0; z-index: 10; min-width: 140px; }
  .export-menu.show { display: block; }
  .export-option { display: block; width: 100%; padding: 8px 16px; border: none; background: none; color: var(--on-surface); cursor: pointer; text-align: left; font-size: 12px; }
  .export-option:hover { background: rgba(0, 229, 255, 0.08); }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .anim { animation: fadeUp 0.4s ease forwards; }
`;
