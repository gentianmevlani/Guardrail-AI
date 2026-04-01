/**
 * Agent verifier report webview — dynamic status accent.
 */
export function getVerificationReportStitchCss(statusColor: string): string {
  return `
    .verify-pad { padding: 16px 20px 32px; max-width: 720px; margin: 0 auto; }
    .header {
      text-align: center;
      padding: 28px 20px;
      background: linear-gradient(135deg, var(--surface-container-low), var(--surface-container-high));
      border: 1px solid rgba(0, 229, 255, 0.1);
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 0 28px rgba(0, 229, 255, 0.05);
    }
    .status { font-size: 40px; margin-bottom: 8px; }
    .status-text {
      font-size: 20px;
      font-weight: 700;
      font-family: 'Space Grotesk', sans-serif;
      color: ${statusColor};
    }
    .section {
      margin: 16px 0;
      padding: 16px;
      background: var(--surface-container-low);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
    }
    .section h3 { margin-top: 0; font-family: 'Space Grotesk', sans-serif; font-size: 14px; }
    .check {
      margin: 10px 0;
      padding: 10px 12px;
      background: var(--surface-container-lowest);
      border-radius: 8px;
    }
    .check-header { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; font-size: 13px; color: var(--on-surface); }
    .fix {
      margin-top: 8px;
      padding: 8px 10px;
      background: rgba(255, 217, 61, 0.1);
      border-radius: 6px;
      font-size: 12px;
      color: var(--on-surface-variant);
    }
    .blockers { border-left: 4px solid #ff6b6b; }
    .warnings { border-left: 4px solid #ffd93d; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 5px 0; font-size: 13px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
  `;
}
