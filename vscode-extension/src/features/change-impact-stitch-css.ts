/**
 * Change Impact Analyzer — topology / kinetic shell (CSP-safe; from Stitch mock).
 */
export const changeImpactStitchCss = `
  .cia-topology-strip {
    margin: 0;
    padding: 10px 20px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: linear-gradient(180deg, rgba(0, 229, 255, 0.04) 0%, transparent 100%);
  }
  .cia-topology-strip svg { width: 100%; height: 56px; display: block; opacity: 0.85; }
  .cia-kicker {
    font-size: 10px;
    font-family: 'Space Grotesk', sans-serif;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--primary-fixed-dim);
    margin-bottom: 4px;
  }
  .cia-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 16px 20px;
    background: rgba(17, 19, 22, 0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: sticky;
    top: 0;
    z-index: 40;
  }
  .cia-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .cia-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #00e5ff;
    text-transform: uppercase;
    margin: 0;
  }
  .cia-sub {
    font-size: 12px;
    color: var(--on-surface-variant);
    margin-top: 2px;
  }
  .cim-wrap { padding: 16px 20px 32px; flex: 1; max-width: 1200px; margin: 0 auto; }
  .summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
  }
  .summary-card {
    background: var(--surface-container-low);
    border: 1px solid var(--border-subtle);
    padding: 20px;
    border-radius: 12px;
    text-align: center;
  }
  .summary-value { font-size: 28px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
  .summary-label { font-size: 12px; color: var(--on-surface-variant); margin-top: 5px; }
  .risk-score {
    background: linear-gradient(135deg, var(--surface-container-low), var(--surface-container-high));
    border-radius: 16px;
    padding: 30px;
    text-align: center;
    margin-bottom: 20px;
    border: 1px solid rgba(0, 229, 255, 0.12);
    box-shadow: 0 0 40px rgba(0, 229, 255, 0.06);
  }
  .risk-value { font-size: 64px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
  .risk-label { color: var(--outline); margin-top: 5px; }
  .risk-low { color: #6ee7b7; }
  .risk-medium { color: #ffd93d; }
  .risk-high { color: #ff6b6b; }
  .changes-section { margin-top: 20px; }
  .changes-section h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--outline);
    margin-bottom: 12px;
  }
  .change-card {
    background: var(--surface-container-low);
    border: 1px solid var(--border-subtle);
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 10px;
    border-left: 4px solid var(--outline-variant);
    cursor: pointer;
    transition: transform 0.2s;
  }
  .change-card:hover { transform: translateX(5px); background: var(--surface-container-high); }
  .change-high { border-left-color: #ff6b6b; }
  .change-medium { border-left-color: #ffd93d; }
  .change-low { border-left-color: #6ee7b7; }
  .change-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .change-title { font-weight: 700; font-size: 13px; }
  .change-badge {
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
  }
  .badge-high { background: rgba(255,107,107,0.25); color: #ffb4ab; }
  .badge-medium { background: rgba(255,217,61,0.2); color: #ffe082; }
  .badge-low { background: rgba(110,231,183,0.2); color: #6ee7b7; }
  .change-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--on-surface-variant);
    margin-bottom: 10px;
  }
  .recommendations {
    background: var(--surface-container-low);
    border: 1px solid var(--border-subtle);
    padding: 20px;
    border-radius: 12px;
    margin-top: 20px;
  }
  .recommendations h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--outline);
    margin-bottom: 12px;
  }
  .recommendation-item {
    padding: 10px 12px;
    background: var(--surface-container-lowest);
    border-radius: 8px;
    margin-bottom: 10px;
    border-left: 3px solid var(--primary-fixed-dim);
    font-size: 12px;
    color: var(--on-surface);
  }
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--on-surface-variant);
  }
  .empty-icon { margin-bottom: 15px; color: var(--cyan-glow); }
  .analyzing {
    text-align: center;
    padding: 60px 20px;
    color: var(--on-surface-variant);
  }
  .spinner {
    border: 3px solid var(--border-subtle);
    border-top: 3px solid var(--primary-container);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
