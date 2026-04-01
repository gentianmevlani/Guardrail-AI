/**
 * Production Integrity Dashboard — CSP-safe panel CSS (Guardrail family).
 */
export const productionIntegrityStitchCss = `
  .pi-strip {
    margin: 0 0 12px;
    padding: 6px 20px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .pi-strip svg { width: 100%; height: 40px; display: block; opacity: 0.65; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body.ka-dashboard-body {
    font-family: 'Inter', sans-serif;
    padding: 0;
    background: var(--background);
    color: var(--on-surface);
  }
  .pi-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 16px 20px;
    margin: 0;
    background: rgba(17, 19, 22, 0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: sticky;
    top: 0;
    z-index: 40;
  }
  .pi-head-left { display: flex; align-items: center; gap: 15px; min-width: 0; }
  .pi-kicker {
    font-size: 10px;
    font-family: 'Space Grotesk', sans-serif;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--primary-fixed-dim);
    margin-bottom: 2px;
  }
  .logo { font-size: 32px; line-height: 1; }
  .title { font-size: 18px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; color: #00e5ff; text-transform: uppercase; letter-spacing: -0.02em; }
  .subtitle { color: var(--on-surface-variant); font-size: 12px; margin-top: 2px; }
  .monitoring-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
  }
  .monitoring-active {
    background: rgba(107, 203, 119, 0.2);
    color: #6bcb77;
    border: 1px solid rgba(107, 203, 119, 0.3);
  }
  .monitoring-inactive {
    background: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
    border: 1px solid rgba(255, 107, 107, 0.3);
  }
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .actions {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .btn {
    background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
    color: #001f24;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn:hover { filter: brightness(1.08); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-danger {
    background: #ff6b6b;
    color: #000;
  }
  .btn-success {
    background: #6bcb77;
    color: #000;
  }
  .btn-secondary {
    background: var(--surface-container-high);
    color: var(--on-surface);
    border: 1px solid var(--border-subtle);
  }
  .health-overview {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px;
    padding: 30px;
    margin-bottom: 20px;
    text-align: center;
    border: 1px solid rgba(0, 229, 255, 0.08);
  }
  .health-score {
    font-size: 64px;
    font-weight: bold;
    margin-bottom: 10px;
  }
  .health-score.healthy { color: #6bcb77; }
  .health-score.degraded { color: #ffd93d; }
  .health-score.critical { color: #ff6b6b; }
  .health-status {
    font-size: 18px;
    margin-bottom: 20px;
  }
  .health-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
  }
  .health-metric {
    background: rgba(255, 255, 255, 0.1);
    padding: 15px;
    border-radius: 8px;
  }
  .metric-value { font-size: 24px; font-weight: bold; }
  .metric-label { font-size: 12px; color: var(--on-surface-variant); }
  .services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
  }
  .service-card {
    background: var(--surface-container-low);
    border-radius: 8px;
    padding: 20px;
    border-left: 4px solid;
  }
  .service-card.healthy { border-left-color: #6bcb77; }
  .service-card.warning { border-left-color: #ffd93d; }
  .service-card.critical { border-left-color: #ff6b6b; }
  .service-card.offline { border-left-color: #999; }
  .service-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  .service-name { font-weight: bold; font-size: 16px; }
  .service-status {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: bold;
  }
  .status-healthy { background: #6bcb77; color: #000; }
  .status-warning { background: #ffd93d; color: #000; }
  .status-critical { background: #ff6b6b; color: #000; }
  .status-offline { background: #999; color: #000; }
  .service-metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 15px;
  }
  .service-metric {
    font-size: 12px;
  }
  .metric-name { color: var(--on-surface-variant); }
  .metric-number { font-weight: bold; }
  .alerts-section {
    margin-top: 15px;
  }
  .alert-item {
    background: var(--surface-container-lowest);
    padding: 8px 12px;
    border-radius: 4px;
    margin-bottom: 5px;
    font-size: 12px;
    border-left: 3px solid;
  }
  .alert-error { border-left-color: #ff6b6b; }
  .alert-warning { border-left-color: #ffd93d; }
  .alert-info { border-left-color: #74c0fc; }
  .incidents-section {
    background: var(--surface-container-low);
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    border: 1px solid rgba(59, 73, 76, 0.25);
  }
  .incident-item {
    background: var(--surface-container-lowest);
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 10px;
    border-left: 3px solid;
  }
  .incident-low { border-left-color: #6bcb77; }
  .incident-medium { border-left-color: #ffd93d; }
  .incident-high { border-left-color: #ffa94d; }
  .incident-critical { border-left-color: #ff6b6b; }
  .incident-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .incident-title { font-weight: bold; }
  .incident-severity {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: bold;
  }
  .severity-low { background: #6bcb77; color: #000; }
  .severity-medium { background: #ffd93d; color: #000; }
  .severity-high { background: #ffa94d; color: #000; }
  .severity-critical { background: #ff6b6b; color: #000; }
  .incident-meta {
    font-size: 12px;
    color: var(--on-surface-variant);
  }
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--on-surface-variant);
  }
  .empty-icon { font-size: 48px; margin-bottom: 15px; }
  .integrity-pad { padding: 0 16px 16px; }
`;
