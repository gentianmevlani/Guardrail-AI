/**
 * Team Collaboration — Pulse Map edition (CSP-safe; from Stitch mock).
 */
export const teamCollaborationStitchCss = `
  .tc-page { padding: 0; }
  .tc-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px;
    background: rgba(17, 19, 22, 0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    position: sticky; top: 0; z-index: 40;
  }
  .tc-head-left { display: flex; align-items: center; gap: 12px; }
  .tc-head-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 18px; font-weight: 700; letter-spacing: -0.02em;
    color: #00e5ff; text-transform: uppercase; margin: 0;
  }
  .tc-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .tc-bento {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    margin: 16px 20px;
  }
  @media (min-width: 700px) {
    .tc-bento { grid-template-columns: 1.4fr 1fr; }
  }
  .tc-spotlight {
    background: var(--surface-container);
    padding: 24px;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(59, 73, 76, 0.35);
    min-height: 200px;
  }
  .tc-spotlight::before {
    content: ''; position: absolute; top: 0; right: 0;
    width: 180px; height: 180px;
    background: rgba(195, 245, 255, 0.06);
    border-radius: 50%;
    filter: blur(60px);
    margin: -40px -40px 0 0;
  }
  .tc-spot-inner { position: relative; z-index: 1; }
  .tc-spot-kicker {
    font-size: 11px; font-family: 'Space Grotesk', sans-serif;
    color: var(--primary); letter-spacing: 0.2em; text-transform: uppercase;
    margin-bottom: 8px;
  }
  .tc-spot-h3 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 22px; font-weight: 700;
    color: var(--on-surface);
    margin: 0 0 16px;
    max-width: 24rem; line-height: 1.2;
  }
  .tc-avatar-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
  .tc-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    background: var(--surface-container-highest);
    border: 2px solid var(--surface);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: var(--primary);
    position: relative;
  }
  .tc-avatar::after {
    content: ''; position: absolute; bottom: 0; right: 0;
    width: 8px; height: 8px; background: #00e5ff;
    border-radius: 50%; border: 2px solid #111316;
  }
  .tc-pulse-card {
    background: rgba(30, 32, 35, 0.65);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(59, 73, 76, 0.35);
    padding: 20px;
    min-height: 200px;
    display: flex; flex-direction: column;
  }
  .tc-pulse-svg-wrap { flex: 1; position: relative; min-height: 120px; margin-top: 8px; }
  .tc-pulse-svg-wrap svg { width: 100%; height: 100%; }
  @keyframes tc-dash { to { stroke-dashoffset: 0; } }
  .tc-pulse-line {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: tc-dash 3s linear infinite;
  }
  @keyframes tc-neon {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 1; }
  }
  .tc-node { animation: tc-neon 2.5s ease-in-out infinite; }
  .tc-main-pad { padding: 0 20px 32px; max-width: 1200px; margin: 0 auto; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body.ka-dashboard-body {
    font-family: 'Inter', sans-serif;
    padding: 0;
    background: var(--background);
    color: var(--on-surface);
  }
  .hint {
    padding: 12px 20px;
    margin: 0;
    background: var(--surface-container-low);
    color: var(--on-surface-variant);
    font-size: 13px;
    line-height: 1.5;
    border-bottom: 1px solid var(--border-subtle);
  }
  .tabs { display: flex; gap: 4px; margin: 16px 0; flex-wrap: wrap; }
  .tab {
    background: var(--surface-container-lowest);
    border: 1px solid rgba(255,255,255,0.06);
    color: var(--on-surface-variant);
    cursor: pointer;
    padding: 10px 14px;
    font-size: 11px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 2px;
    transition: color 0.2s, background 0.2s, border-color 0.2s;
  }
  .tab.active {
    color: #00e5ff;
    background: rgba(0, 229, 255, 0.08);
    border-color: rgba(0, 229, 255, 0.25);
  }
  .actions { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .btn {
    background: linear-gradient(135deg, var(--primary-container), var(--secondary-container));
    color: #001f24;
    border: none;
    padding: 8px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .btn.secondary { background: var(--surface-container-high); color: var(--on-surface); border: 1px solid var(--border-subtle); }
  .content-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 800px) {
    .content-grid { grid-template-columns: 1fr 2fr; }
  }
  .team-sidebar {
    background: var(--surface-container-low);
    padding: 16px;
    border-radius: 4px;
    border: 1px solid rgba(59, 73, 76, 0.25);
  }
  .section-title { font-size: 12px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 12px; color: var(--on-surface-variant); }
  .member-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    margin-bottom: 6px;
    background: var(--surface-container-lowest);
    border-radius: 4px;
    border: 1px solid transparent;
    transition: border-color 0.2s;
  }
  .member-item:hover { border-color: rgba(0, 229, 255, 0.2); }
  .member-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--primary-container);
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: bold; color: var(--on-primary-container);
  }
  .main-content {
    background: var(--surface-container-low);
    padding: 16px;
    border-radius: 4px;
    border: 1px solid rgba(59, 73, 76, 0.25);
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .stat-card {
    background: var(--surface-container-lowest);
    padding: 14px;
    border-radius: 4px;
    text-align: center;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .stat-value { font-size: 22px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; color: var(--primary-fixed-dim); }
  .stat-label { font-size: 10px; color: var(--on-surface-variant); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
  .empty { padding: 24px; text-align: center; color: var(--on-surface-variant); font-size: 13px; }
  .panel-block { display: block; }
`;
