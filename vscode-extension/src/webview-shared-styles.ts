/**
 * Shared HTML/CSS for Guardrail webviews (dashboard + sidebar).
 * Keeps the multi-page dashboard and sidebar visually aligned.
 */
export function getGuardrailSharedStyles(): string {
  return `
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    <style>
      :root {
        --bg: #0b1326;
        --surface-low: #0d162d;
        --surface: #111a30;
        --surface-high: #1a243d;
        --surface-highest: #242e47;
        --surface-lowest: #050a18;
        --primary: #adc6ff;
        --primary-container: #005ac2;
        --on-primary: #001a42;
        --tertiary: #ffb786;
        --tertiary-container: #ff8c00;
        --on-surface: #ffffff;
        --on-surface-variant: #e2e7f0;
        --outline: #8c909f;
        --outline-variant: #424754;
        --border-subtle: rgba(255,255,255,0.05);
        --border-light: rgba(255,255,255,0.1);
        --error: #ffb4ab;
        --error-container: #cf2c2c;
      }
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        font-family: 'Inter', sans-serif;
        background: var(--bg);
        color: var(--on-surface);
        min-height: 100vh;
        overflow-x: hidden;
        padding-bottom: 80px;
      }
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: var(--bg); }
      ::-webkit-scrollbar-thumb { background: var(--outline-variant); border-radius: 10px; }

      /* Header */
      .top-bar {
        background: rgba(11,19,38,0.95);
        backdrop-filter: blur(12px);
        display: flex; justify-content: space-between; align-items: center;
        padding: 12px 16px;
        position: sticky; top: 0; z-index: 50;
        border-bottom: 1px solid var(--border-subtle);
      }
      .top-bar .brand { display: flex; align-items: center; gap: 8px; }
      .top-bar .brand .material-symbols-outlined { color: var(--primary); font-size: 24px; }
      .top-bar .brand span:last-child {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700; font-size: 14px; letter-spacing: 0.15em; color: #fff;
      }
      .scan-btn {
        background: var(--primary); color: var(--on-primary);
        border: none; padding: 6px 16px; border-radius: 8px;
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700; font-size: 11px; text-transform: uppercase;
        letter-spacing: 0.08em; cursor: pointer;
        box-shadow: 0 4px 12px rgba(173,198,255,0.2);
        transition: all 0.2s;
      }
      .scan-btn:hover { filter: brightness(1.1); }
      .scan-btn:active { transform: scale(0.95); }

      /* Bottom Nav */
      .bottom-nav {
        position: fixed; bottom: 0; left: 0; width: 100%; z-index: 50;
        display: flex; justify-content: space-around; align-items: center;
        padding: 12px 8px;
        background: rgba(11,19,38,0.95);
        backdrop-filter: blur(16px);
        border-top: 1px solid var(--border-subtle);
        box-shadow: 0 -10px 20px rgba(0,0,0,0.5);
      }
      .nav-item {
        display: flex; align-items: center; justify-content: center;
        width: 48px; height: 48px;
        border-radius: 12px; border: none; background: none;
        color: rgba(255,255,255,0.5); cursor: pointer;
        transition: all 0.2s;
      }
      .nav-item:hover { color: var(--primary); }
      .nav-item.active {
        background: var(--primary); color: var(--on-primary);
        box-shadow: 0 4px 12px rgba(173,198,255,0.3);
      }

      /* Content area */
      .page-content { padding: 16px; }
      .page-content > section { margin-bottom: 32px; }

      /* Section headers */
      .section-title {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700; font-size: 11px;
        letter-spacing: 0.1em; text-transform: uppercase;
        color: rgba(255,255,255,0.7);
        margin-bottom: 16px;
      }

      /* Cards */
      .card {
        background: var(--surface-low);
        border-radius: 12px;
        border: 1px solid var(--border-subtle);
        padding: 16px;
        transition: background 0.2s;
      }
      .card:hover { background: var(--surface-high); }
      .card-row {
        display: flex; align-items: center; justify-content: space-between;
      }
      .card-left { display: flex; align-items: center; gap: 16px; }
      .icon-box {
        padding: 8px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
      }

      /* Status pill */
      .status-pill {
        display: flex; align-items: center; gap: 8px;
        padding: 4px 12px; border-radius: 999px;
        background: rgba(173,198,255,0.2);
        border: 1px solid rgba(173,198,255,0.4);
      }
      .status-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--primary);
        box-shadow: 0 0 10px rgba(173,198,255,1);
        animation: pulse 2s infinite;
      }
      @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      .status-label {
        font-family: 'Inter', sans-serif;
        font-weight: 900; font-size: 10px;
        letter-spacing: 0.15em; color: var(--primary);
      }

      /* Animations */
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .anim { animation: fadeUp 0.4s ease forwards; }
      .anim-d1 { animation-delay: 0.05s; opacity: 0; }
      .anim-d2 { animation-delay: 0.1s; opacity: 0; }
      .anim-d3 { animation-delay: 0.15s; opacity: 0; }
      .anim-d4 { animation-delay: 0.2s; opacity: 0; }
      .anim-d5 { animation-delay: 0.25s; opacity: 0; }
    </style>`;
}
