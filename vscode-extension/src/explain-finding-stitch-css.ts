/**
 * Quick-fix "Explain finding" webview — CSP-safe CSS.
 */
export const explainFindingStitchCss = `
  .explain-head {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: rgba(17, 19, 22, 0.92);
    backdrop-filter: blur(12px);
  }
  .explain-head h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #00e5ff;
    margin: 0 0 4px;
  }
  .explain-pad { padding: 16px 20px 24px; max-width: 640px; }
  pre {
    white-space: pre-wrap;
    font-size: 12px;
    line-height: 1.55;
    color: var(--on-surface);
    background: var(--surface-container-lowest);
    padding: 12px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
  }
  .meta { color: var(--on-surface-variant); font-size: 11px; margin-bottom: 12px; }
`;
