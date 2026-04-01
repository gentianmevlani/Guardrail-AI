/**
 * SECURITY_ARCHIVE / Kinetic Core — CSP-safe styles (from Stitch world_class_security_scanner).
 */
export const securityScannerStitchCss = `
  @keyframes ss-radar-sweep {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .ss-radar-sweep { animation: ss-radar-sweep 4s linear infinite; transform-origin: center; }
  @keyframes ss-pulse-ring {
    0% { transform: scale(0.95); opacity: 0.8; }
    50% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.8; }
  }
  .ss-pulse-ring { animation: ss-pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  @keyframes ss-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .ss-shimmer::after {
    content: '';
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.08), transparent);
    animation: ss-shimmer 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
  .ss-page { padding: 0; min-height: 100vh; }
  .ss-head {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 24px;
    background: rgba(17, 19, 22, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .ss-head-left { display: flex; align-items: center; gap: 12px; }
  .ss-head-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 20px; font-weight: 700; letter-spacing: 0.15em;
    color: #22d3ee; margin: 0;
  }
  .ss-head-actions { display: flex; align-items: center; gap: 16px; }
  .ss-btn-run {
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
  .ss-btn-run:hover { background: rgba(0, 229, 255, 0.2); }
  .ss-btn-run:active { transform: scale(0.95); }
  .ss-btn-run:disabled { opacity: 0.5; cursor: not-allowed; }
  .ss-icon-btn {
    background: none; border: none; color: #22d3ee; cursor: pointer;
    padding: 4px; border-radius: 4px;
    transition: transform 0.3s;
  }
  .ss-icon-btn:hover { transform: rotate(90deg); }
  .ss-main { padding: 24px; max-width: 1600px; margin: 0 auto; }
  .ss-hero-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 32px;
  }
  @media (min-width: 1024px) {
    .ss-hero-grid { grid-template-columns: 2fr 1fr; }
  }
  .ss-score-card {
    background: var(--surface-container);
    padding: 32px;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .ss-score-card::before {
    content: '';
    position: absolute; top: 0; right: 0;
    width: 256px; height: 256px;
    background: rgba(195, 245, 255, 0.05);
    border-radius: 50%;
    filter: blur(80px);
    margin: -64px -64px 0 0;
  }
  .ss-score-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 24px; }
  @media (min-width: 768px) {
    .ss-score-inner { flex-direction: row; align-items: flex-end; }
  }
  .ss-ring-wrap { position: relative; width: 192px; height: 192px; flex-shrink: 0; }
  .ss-ring-wrap svg { display: block; }
  .ss-ring-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .ss-score-num {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 56px; font-weight: 700; letter-spacing: -0.03em;
    color: var(--on-surface);
    line-height: 1;
  }
  .ss-score-denom {
    font-size: 12px; font-family: 'Space Grotesk', sans-serif;
    color: var(--primary-container); letter-spacing: 0.25em;
    margin-top: 4px;
  }
  .ss-score-copy { flex: 1; text-align: center; }
  @media (min-width: 768px) { .ss-score-copy { text-align: left; } }
  .ss-badge-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 4px 12px;
    background: rgba(0, 229, 255, 0.1);
    border: 1px solid rgba(0, 229, 255, 0.2);
    border-radius: 999px;
    font-size: 10px; font-family: 'Space Grotesk', sans-serif; font-weight: 700;
    color: var(--primary-container); letter-spacing: 0.12em;
    margin-bottom: 12px;
  }
  .ss-dot-pulse {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--primary-container);
    animation: ss-pulse-ring 2s ease-in-out infinite;
  }
  .ss-hero-h2 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 20px; font-weight: 700;
    color: var(--on-surface);
    margin: 0 0 8px;
  }
  .ss-hero-p { font-size: 13px; color: var(--on-surface-variant); max-width: 28rem; margin: 0; line-height: 1.5; }
  .ss-files-card {
    background: var(--surface-container-high);
    padding: 32px;
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 200px;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .ss-files-label {
    font-size: 10px; font-family: 'Space Grotesk', sans-serif;
    color: var(--primary-fixed); letter-spacing: 0.15em;
    margin-bottom: 4px;
  }
  .ss-files-val {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 36px; font-weight: 700;
    color: var(--on-surface);
  }
  .ss-summary-3 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 32px;
  }
  @media (min-width: 768px) {
    .ss-summary-3 { grid-template-columns: repeat(3, 1fr); }
  }
  .ss-sum-card {
    background: var(--surface-container);
    padding: 24px;
    display: flex; align-items: center; justify-content: space-between;
    border: 1px solid rgba(255,255,255,0.05);
    transition: background 0.2s, border-color 0.2s;
  }
  .ss-sum-card:hover { background: var(--surface-container-high); }
  .ss-sum-card.crit:hover { border-color: rgba(255, 180, 171, 0.4); }
  .ss-sum-card.warn:hover { border-color: rgba(255, 179, 179, 0.35); }
  .ss-sum-card.ok:hover { border-color: rgba(0, 229, 255, 0.3); }
  .ss-sum-lbl { font-size: 10px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.15em; margin-bottom: 4px; }
  .ss-sum-lbl.crit { color: var(--error); }
  .ss-sum-lbl.warn { color: var(--tertiary-fixed-dim); }
  .ss-sum-lbl.ok { color: var(--primary-container); }
  .ss-sum-num { font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; color: var(--on-surface); }
  .ss-vault {
    margin-bottom: 32px;
    padding: 24px;
    display: flex; flex-direction: column;
    gap: 16px;
    align-items: flex-start;
    background: linear-gradient(to right, var(--surface-container-lowest), var(--surface-container));
    border-left: 4px solid var(--error);
    border-top: 1px solid rgba(255,255,255,0.05);
    border-right: 1px solid rgba(255,255,255,0.05);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  @media (min-width: 768px) {
    .ss-vault { flex-direction: row; align-items: center; justify-content: space-between; }
  }
  .ss-vault-left { display: flex; gap: 16px; align-items: flex-start; }
  .ss-vault-ico {
    width: 48px; height: 48px;
    background: rgba(255, 180, 171, 0.1);
    border-radius: 2px;
    display: flex; align-items: center; justify-content: center;
    color: var(--error);
    flex-shrink: 0;
  }
  .ss-vault-btn {
    background: var(--surface-container-highest);
    color: var(--inverse-on-surface);
    border: none;
    padding: 10px 28px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
    cursor: pointer;
    border-radius: 2px;
    transition: box-shadow 0.2s, transform 0.15s;
  }
  .ss-vault-btn:hover { box-shadow: 0 0 25px rgba(0, 229, 255, 0.35); }
  .ss-section-head { margin-bottom: 16px; }
  .ss-section-head h2 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 20px; font-weight: 700;
    color: var(--on-surface);
    margin: 0 0 4px;
  }
  .ss-section-head p { font-size: 12px; color: var(--on-surface-variant); margin: 0; }
  .ss-filter-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .ss-filter-row .filter-tab {
    background: rgba(12, 14, 17, 0.8);
    border: 1px solid rgba(255,255,255,0.05);
    color: var(--on-surface-variant);
    padding: 8px 16px;
    font-size: 10px; font-family: 'Space Grotesk', sans-serif; font-weight: 700;
    letter-spacing: 0.1em;
    cursor: pointer;
    border-radius: 2px;
    transition: color 0.2s, background 0.2s;
  }
  .ss-filter-row .filter-tab.active {
    background: var(--surface-container-high);
    color: var(--primary-container);
  }
  .ss-filter-row .filter-tab:hover { color: var(--on-surface); }
  .progress-container { display: none; margin: 16px 0; padding: 16px; background: var(--surface-container-low); border-radius: 4px; border: 1px solid var(--border-subtle); }
  .progress-bar { height: 6px; background: var(--surface-container-highest); border-radius: 3px; overflow: hidden; margin-top: 8px; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary-container), var(--secondary-container)); transition: width 0.3s ease; border-radius: 3px; }
  .progress-msg { font-size: 12px; color: var(--on-surface); }
  .dashboard { display: none; }
  .action-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .action-row .btn-secondary { background: var(--surface-container-high); color: var(--on-surface); border: 1px solid var(--border-subtle); }
  .issue-card {
    background: var(--surface-container);
    padding: 24px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: background 0.2s;
    border: 1px solid rgba(255,255,255,0.05);
    border-left: 2px solid transparent;
  }
  .issue-card:hover { background: var(--surface-container-high); border-left-color: var(--error); }
  .issue-card.critical:hover { border-left-color: var(--error); }
  .issue-card.high:hover { border-left-color: #ff8c00; }
  .issue-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
  .issue-title { font-weight: 700; font-size: 14px; font-family: 'Space Grotesk', sans-serif; }
  .issue-badge { padding: 2px 10px; border-radius: 2px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge-critical { background: rgba(255, 180, 171, 0.2); color: var(--error); border: 1px solid rgba(255, 180, 171, 0.35); }
  .badge-high { background: rgba(255,140,0,0.2); color: #ffb786; border: 1px solid rgba(255,140,0,0.3); }
  .badge-medium { background: rgba(255,183,134,0.15); color: #ffb786; }
  .badge-low { background: rgba(0, 229, 255, 0.12); color: var(--primary-fixed-dim); }
  .issue-meta { display: flex; gap: 12px; margin-top: 8px; font-size: 11px; color: var(--on-surface-variant); }
  .issue-description { margin-top: 8px; font-size: 13px; color: var(--on-surface-variant); line-height: 1.5; }
  .issue-code { margin-top: 8px; padding: 10px; background: var(--surface-container-lowest); border-radius: 4px; font-family: monospace; font-size: 11px; overflow-x: auto; color: var(--primary-fixed-dim); }
  .issue-fix { margin-top: 8px; padding: 10px; background: rgba(0, 229, 255, 0.08); border-radius: 4px; font-size: 11px; color: var(--on-surface); }
  .empty-state { text-align: center; padding: 60px 20px; color: var(--on-surface-variant); }
  .empty-state .material-symbols-outlined { font-size: 48px; color: var(--primary-fixed-dim); margin-bottom: 12px; }
  .empty-state h3 { font-family: 'Space Grotesk', sans-serif; margin-bottom: 8px; color: var(--on-surface); }
  .free-tier-banner {
    background: rgba(255, 193, 7, 0.08); border: 1px solid rgba(255, 193, 7, 0.35);
    padding: 12px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 12px; color: #ffe082;
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  }
  .free-tier-lock { min-height: 180px; }
  .free-tier-lock-card {
    text-align: center; padding: 32px 16px; background: var(--surface-container-low); border-radius: 12px;
    border: 1px solid var(--border-subtle);
  }
  .free-tier-lock-card .material-symbols-outlined { font-size: 40px; color: #ffb74d; margin-bottom: 12px; display: block; }
  .free-tier-lock-card .sub { color: var(--on-surface-variant); font-size: 12px; margin: 8px 0 16px; }
  .btn { background: linear-gradient(135deg, var(--primary-container), var(--secondary-container)); color: #001f24; border: none; padding: 8px 16px; border-radius: 12px; cursor: pointer; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .btn-secondary { background: var(--surface-container-high); color: var(--on-surface); border: 1px solid var(--border-subtle); }
`;
