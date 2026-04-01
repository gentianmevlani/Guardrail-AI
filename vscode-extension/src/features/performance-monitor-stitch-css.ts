/** Nexus Monitor — from Stitch world_class_performance_monitor (CSP-safe). */
export const performanceMonitorStitchCss = `
  .pm-page { padding: 0; min-height: 100vh; }
  .pm-nexus-head {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px; height: 64px;
    background: rgba(26, 28, 31, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(0, 229, 255, 0.1);
  }
  .pm-nexus-brand { display: flex; align-items: center; gap: 12px; }
  .pm-nexus-brand .material-symbols-outlined { color: #00e5ff; font-size: 26px; }
  .pm-nexus-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 20px; font-weight: 700; letter-spacing: -0.02em;
    color: #00e5ff; text-transform: uppercase; margin: 0;
  }
  .pm-nexus-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .pm-btn-ghost {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px;
    border: 1px solid var(--outline-variant);
    border-radius: 8px;
    background: rgba(26, 28, 31, 0.4);
    color: var(--on-surface);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .pm-btn-ghost:hover { background: var(--surface-container-high); }
  .pm-btn-primary-nx {
    padding: 8px 22px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(to bottom right, #c3f5ff, #00e5ff);
    color: var(--on-primary);
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    box-shadow: 0 0 25px rgba(0, 229, 255, 0.25);
    transition: transform 0.15s;
  }
  .pm-btn-primary-nx:hover { transform: scale(0.98); }
  .pm-main { padding: 88px 24px 32px; max-width: 1280px; margin: 0 auto; }
  .pm-grid-top {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
  @media (min-width: 1024px) {
    .pm-grid-top { grid-template-columns: 1fr 2fr; }
  }
  .pm-glass {
    background: rgba(26, 28, 31, 0.55);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(0, 229, 255, 0.12);
    border-radius: 12px;
    padding: 28px;
    position: relative;
    overflow: hidden;
  }
  .pm-scanner-beam {
    position: absolute; left: 0; right: 0; top: 0;
    height: 48px;
    background: linear-gradient(to bottom, transparent, rgba(0, 229, 255, 0.12), transparent);
    pointer-events: none;
    animation: pm-scan 6s linear infinite;
  }
  @keyframes pm-scan {
    0% { transform: translateY(-100%); opacity: 0; }
    40% { opacity: 0.4; }
    100% { transform: translateY(400%); opacity: 0; }
  }
  .pm-ring-wrap { position: relative; width: 200px; height: 200px; margin: 0 auto; }
  .pm-ring-wrap svg { display: block; }
  .pm-ring-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .pm-score-big {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 48px; font-weight: 700;
    color: var(--primary);
    text-shadow: 0 0 15px rgba(0, 229, 255, 0.35);
  }
  .pm-metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }
  .pm-metric-tile {
    border-left: 4px solid rgba(0, 229, 255, 0.5);
    padding: 20px;
    border-radius: 12px;
    background: rgba(26, 28, 31, 0.5);
    border: 1px solid rgba(0, 229, 255, 0.08);
    border-left-width: 4px;
    transition: background 0.2s, box-shadow 0.2s;
  }
  .pm-metric-tile:hover {
    background: var(--surface-container-high);
    box-shadow: 0 0 20px rgba(0, 229, 255, 0.12);
  }
  .pm-metric-tile .metric-value { font-size: 28px; }
  .pm-chart {
    min-height: 200px;
    display: flex; align-items: center; justify-content: center;
    color: var(--on-surface-variant);
    font-size: 13px;
    margin-bottom: 24px;
  }
  .pm-insights h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 12px;
    display: flex; align-items: center; gap: 8px;
  }
  .insight-item {
    padding: 14px 16px;
    border-left: 4px solid;
    margin-bottom: 10px;
    background: var(--surface-container-lowest);
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
  }
  .insight-high { border-left-color: #ff6b6b; }
  .insight-medium { border-left-color: #ffd93d; }
  .insight-low { border-left-color: #6ee7b7; }
  .insight-title { font-weight: 700; margin-bottom: 6px; font-size: 13px; }
  .insight-description { font-size: 12px; color: var(--on-surface-variant); line-height: 1.5; }
  .metric-value { font-size: 32px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; }
  .metric-label { color: var(--on-surface-variant); margin-top: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  .metric-good { color: #6ee7b7; }
  .metric-warning { color: #ffd93d; }
  .metric-critical { color: #ff6b6b; }
`;
