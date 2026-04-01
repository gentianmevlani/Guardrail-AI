/**
 * Inline webviews from extension.ts — dynamic colors passed from TypeScript.
 */

export function getFindingDetailStitchCss(typeColor: string): string {
  return `
    .finding-pad { padding: 16px 20px 24px; max-width: 720px; margin: 0 auto; }
    .fd-head {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding-bottom: 16px;
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .badge { background: ${typeColor}; color: #001f24; padding: 4px 12px; border-radius: 8px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; font-size: 11px; }
    .section { margin: 16px 0; padding: 15px; background: var(--surface-container-low); border: 1px solid var(--border-subtle); border-radius: 12px; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--outline); margin-bottom: 8px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; }
    .code { background: var(--surface-container-lowest); padding: 10px; border-radius: 8px; font-family: monospace; overflow-x: auto; border: 1px solid var(--border-subtle); }
    .intent { color: #6ee7b7; }
    .reality { color: #ff6b6b; }
    .confidence { margin-top: 20px; }
    .confidence-bar { height: 8px; background: var(--surface-container-highest); border-radius: 4px; overflow: hidden; }
    .confidence-fill { height: 100%; background: ${typeColor}; }
  `;
}

export function getReadinessDashboardStitchCss(scoreColor: string): string {
  return `
    .db-pad { padding: 24px 16px 32px; max-width: 720px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 28px; }
    .logo { font-size: 40px; margin-bottom: 8px; }
    .title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: var(--on-surface); margin-bottom: 4px; }
    .subtitle { color: var(--on-surface-variant); font-size: 13px; }
    .score-card {
      background: linear-gradient(135deg, var(--surface-container-low), var(--surface-container-high));
      border: 1px solid rgba(0, 229, 255, 0.1);
      border-radius: 20px;
      padding: 40px 24px;
      text-align: center;
      margin-bottom: 24px;
      box-shadow: 0 0 40px rgba(0, 229, 255, 0.06);
    }
    .score-value {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 88px;
      font-weight: 700;
      color: ${scoreColor};
      line-height: 1;
    }
    .score-label {
      font-size: 14px;
      color: var(--outline);
      margin-top: 8px;
    }
    .verdict {
      display: inline-block;
      margin-top: 16px;
      padding: 10px 24px;
      background: ${scoreColor};
      color: #001f24;
      border-radius: 999px;
      font-weight: 700;
      font-size: 14px;
      font-family: 'Space Grotesk', sans-serif;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 20px;
    }
    .action-btn {
      background: var(--surface-container-high);
      color: var(--on-surface);
      border: 1px solid var(--border-subtle);
      padding: 12px 16px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 12px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: filter 0.15s;
    }
    .action-btn:hover { filter: brightness(1.08); }
    .features {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 32px;
    }
    .feature {
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }
    .feature-icon { font-size: 28px; margin-bottom: 8px; }
    .feature-title { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
    .feature-desc { font-size: 11px; color: var(--on-surface-variant); line-height: 1.45; }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
      color: var(--outline);
      font-size: 11px;
    }
  `;
}

export function getProductionAuditStitchCss(shipColor: string): string {
  return `
    .audit-pad { padding: 16px 20px 24px; max-width: 800px; margin: 0 auto; }
    .score-box {
      text-align: center;
      padding: 32px 20px;
      background: linear-gradient(135deg, var(--surface-container-low), var(--surface-container-high));
      border: 1px solid rgba(0, 229, 255, 0.12);
      border-radius: 16px;
      margin-bottom: 24px;
      box-shadow: 0 0 32px rgba(0, 229, 255, 0.05);
    }
    .score { font-size: 64px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; color: ${shipColor}; }
    .grade { font-size: 24px; margin-top: 8px; color: var(--on-surface); }
    .verdict { font-size: 15px; margin-top: 16px; padding: 10px 24px; border-radius: 10px; display: inline-block; background: ${shipColor}; color: #001f24; font-weight: 700; font-family: 'Space Grotesk', sans-serif; }
    .section { margin: 16px 0; padding: 18px; background: var(--surface-container-low); border: 1px solid var(--border-subtle); border-radius: 12px; }
    .section h3 { margin-top: 0; display: flex; align-items: center; gap: 10px; font-family: 'Space Grotesk', sans-serif; font-size: 14px; }
    .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); font-size: 13px; gap: 12px; }
    .metric:last-child { border-bottom: none; }
    .metric-value { font-weight: 700; }
    .critical { color: #ff6b6b; }
    .warning { color: #ffd93d; }
    .ok { color: #6ee7b7; }
    .audit-foot { text-align: center; color: var(--outline); margin-top: 24px; font-size: 12px; }
  `;
}

export const aiVerificationStitchCss = `
  .ai-pad { padding: 16px 20px 32px; max-width: 720px; margin: 0 auto; }
  .ai-hero {
    text-align: center;
    padding: 20px 16px 24px;
    margin: 0 0 24px;
    background: rgba(17, 19, 22, 0.92);
    backdrop-filter: blur(12px);
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .ai-hero h1 { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #00e5ff; text-transform: uppercase; letter-spacing: -0.02em; margin-bottom: 8px; }
  .ai-hero p { color: var(--on-surface-variant); font-size: 13px; }
  .section { margin: 16px 0; padding: 16px; background: var(--surface-container-low); border: 1px solid var(--border-subtle); border-radius: 12px; }
  .section-title { font-size: 12px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; color: var(--on-surface); }
  .gap { background: rgba(255,107,107,0.12); border-left: 4px solid #ff6b6b; padding: 10px 12px; margin: 10px 0; border-radius: 0 8px 8px 0; }
  .suggestion { background: rgba(110,231,183,0.12); border-left: 4px solid #6ee7b7; padding: 10px 12px; margin: 10px 0; border-radius: 0 8px 8px 0; }
  .ai-foot { text-align: center; color: var(--outline); margin-top: 24px; font-size: 12px; }
`;
