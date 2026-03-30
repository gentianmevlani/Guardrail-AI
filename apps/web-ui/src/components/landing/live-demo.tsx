'use client';

import React, { useState, useEffect, useCallback } from 'react';

type DemoMode = 'vibe' | 'predeploy' | 'fix';

interface AnalysisStep {
  icon: string;
  text: string;
  status: 'pending' | 'running' | 'done';
  result?: string;
}

interface DemoResult {
  score: number;
  grade: string;
  canDeploy: boolean;
  issues: Array<{ type: 'blocker' | 'warning' | 'success'; text: string }>;
}

const VIBE_STEPS: AnalysisStep[] = [
  { icon: '🕵️', text: 'Scanning for missing vibe features', status: 'pending' },
  { icon: '✨', text: 'Checking project polish', status: 'pending' },
  { icon: '🏗️', text: 'Analyzing architecture', status: 'pending' },
  { icon: '🧠', text: 'Analyzing implementation quality', status: 'pending' },
  { icon: '🎨', text: 'Checking design system', status: 'pending' },
];

const PREDEPLOY_STEPS: AnalysisStep[] = [
  { icon: '📊', text: 'Checking vibe score', status: 'pending', result: '79% ✓' },
  { icon: '🔒', text: 'Scanning for secrets', status: 'pending', result: 'Clean ✓' },
  { icon: '🧪', text: 'Running tests', status: 'pending', result: '47/47 passed ✓' },
  { icon: '📦', text: 'Checking TypeScript', status: 'pending', result: 'No errors ✓' },
  { icon: '🛡️', text: 'Auditing packages', status: 'pending', result: '0 vulnerabilities ✓' },
  { icon: '🏗️', text: 'Verifying build', status: 'pending', result: 'Success ✓' },
];

const FIX_STEPS: AnalysisStep[] = [
  { icon: '🔍', text: 'Scanning for missing features', status: 'pending' },
  { icon: '📦', text: 'Applying ErrorBoundary template', status: 'pending', result: 'Created ✓' },
  { icon: '📦', text: 'Applying LoadingState template', status: 'pending', result: 'Created ✓' },
  { icon: '📦', text: 'Applying 404 Page template', status: 'pending', result: 'Created ✓' },
  { icon: '⚙️', text: 'Generating .env.example', status: 'pending', result: 'Created ✓' },
];

const DEMO_RESULTS: Record<DemoMode, DemoResult> = {
  vibe: {
    score: 79,
    grade: 'B',
    canDeploy: true,
    issues: [
      { type: 'success', text: 'Error Boundary: excellent (92/100)' },
      { type: 'success', text: 'Rate Limiting: good (85/100)' },
      { type: 'warning', text: 'Loading States: adequate (66/100)' },
      { type: 'warning', text: 'Empty States: missing' },
    ],
  },
  predeploy: {
    score: 92,
    grade: 'A',
    canDeploy: true,
    issues: [
      { type: 'success', text: 'All critical checks passed' },
      { type: 'success', text: 'No hardcoded secrets detected' },
      { type: 'success', text: 'Tests: 47/47 passing' },
      { type: 'success', text: 'TypeScript compiles successfully' },
    ],
  },
  fix: {
    score: 5,
    grade: 'A',
    canDeploy: true,
    issues: [
      { type: 'success', text: 'Created 4 component templates' },
      { type: 'success', text: 'Generated environment config' },
      { type: 'warning', text: 'Run: npm install lucide-react' },
      { type: 'success', text: 'Vibe score improved: 64% → 79%' },
    ],
  },
};

export function LiveDemo() {
  const [mode, setMode] = useState<DemoMode>('vibe');
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [showResult, setShowResult] = useState(false);

  const getSteps = useCallback((m: DemoMode) => {
    switch (m) {
      case 'vibe': return [...VIBE_STEPS];
      case 'predeploy': return [...PREDEPLOY_STEPS];
      case 'fix': return [...FIX_STEPS];
    }
  }, []);

  const runDemo = useCallback(() => {
    setIsRunning(true);
    setShowResult(false);
    setCurrentStep(-1);
    const newSteps = getSteps(mode);
    setSteps(newSteps);

    let step = 0;
    const interval = setInterval(() => {
      if (step < newSteps.length) {
        setSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i < step ? 'done' : i === step ? 'running' : 'pending'
        })));
        setCurrentStep(step);
        step++;
      } else {
        setSteps(prev => prev.map(s => ({ ...s, status: 'done' })));
        setShowResult(true);
        setIsRunning(false);
        clearInterval(interval);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [mode, getSteps]);

  useEffect(() => {
    setSteps(getSteps(mode));
    setShowResult(false);
    setCurrentStep(-1);
  }, [mode, getSteps]);

  const result = DEMO_RESULTS[mode];
  const scoreColor = result.score >= 80 ? '#4ade80' : result.score >= 60 ? '#fbbf24' : '#f87171';

  return (
    <div className="live-demo">
      <style suppressHydrationWarning>{`
        .live-demo {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 16px;
          padding: 24px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          color: #e2e8f0;
          max-width: 720px;
          margin: 0 auto;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid #334155;
        }

        .demo-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #334155;
        }

        .demo-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .demo-dot.red { background: #ef4444; }
        .demo-dot.yellow { background: #eab308; }
        .demo-dot.green { background: #22c55e; }

        .demo-title {
          flex: 1;
          text-align: center;
          font-size: 13px;
          color: #94a3b8;
        }

        .demo-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .demo-tab {
          padding: 8px 16px;
          background: transparent;
          border: 1px solid #475569;
          border-radius: 8px;
          color: #94a3b8;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .demo-tab:hover {
          border-color: #60a5fa;
          color: #60a5fa;
        }

        .demo-tab.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .demo-terminal {
          background: #0c0c0c;
          border-radius: 8px;
          padding: 16px;
          min-height: 280px;
        }

        .demo-prompt {
          color: #22c55e;
          margin-bottom: 12px;
        }

        .demo-prompt span {
          color: #94a3b8;
        }

        .demo-step {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          opacity: 0.4;
          transition: opacity 0.3s;
        }

        .demo-step.done { opacity: 1; }
        .demo-step.running { opacity: 1; }

        .demo-step-icon {
          font-size: 16px;
          width: 24px;
        }

        .demo-step-text {
          flex: 1;
          font-size: 13px;
        }

        .demo-step-status {
          font-size: 12px;
          color: #22c55e;
        }

        .demo-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #334155;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .demo-result {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px dashed #334155;
          animation: fadeIn 0.5s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .demo-score {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .demo-score-badge {
          font-size: 32px;
          font-weight: bold;
          padding: 8px 16px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
        }

        .demo-score-label {
          font-size: 13px;
          color: #94a3b8;
        }

        .demo-score-grade {
          font-size: 24px;
          font-weight: bold;
        }

        .demo-issues {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .demo-issue {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .demo-issue.success { color: #4ade80; }
        .demo-issue.warning { color: #fbbf24; }
        .demo-issue.blocker { color: #f87171; }

        .demo-cta {
          margin-top: 20px;
          display: flex;
          gap: 12px;
        }

        .demo-button {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .demo-button.primary {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: white;
        }

        .demo-button.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
        }

        .demo-button.primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .demo-deploy-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 8px;
          font-weight: 600;
          margin-top: 16px;
        }

        .demo-deploy-status.approved {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .demo-deploy-status.blocked {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .demo-fix-summary {
          font-size: 14px;
          color: #94a3b8;
          margin-top: 12px;
        }

        .demo-fix-summary strong {
          color: #4ade80;
        }
      `}</style>

      <div className="demo-header">
        <div className="demo-dot red" />
        <div className="demo-dot yellow" />
        <div className="demo-dot green" />
        <div className="demo-title">guardrail — Terminal</div>
      </div>

      <div className="demo-tabs">
        <button 
          className={`demo-tab ${mode === 'vibe' ? 'active' : ''}`}
          onClick={() => setMode('vibe')}
        >
          🔮 Vibe Check
        </button>
        <button 
          className={`demo-tab ${mode === 'predeploy' ? 'active' : ''}`}
          onClick={() => setMode('predeploy')}
        >
          🚦 Pre-Deploy
        </button>
        <button 
          className={`demo-tab ${mode === 'fix' ? 'active' : ''}`}
          onClick={() => setMode('fix')}
        >
          🔧 Auto-Fix
        </button>
      </div>

      <div className="demo-terminal">
        <div className="demo-prompt">
          $ <span>guardrail {mode === 'vibe' ? 'vibe' : mode === 'predeploy' ? 'predeploy' : 'fix'}</span>
        </div>

        {steps.map((step, i) => (
          <div 
            key={i} 
            className={`demo-step ${step.status}`}
          >
            <span className="demo-step-icon">{step.icon}</span>
            <span className="demo-step-text">{step.text}...</span>
            {step.status === 'running' && <div className="demo-spinner" />}
            {step.status === 'done' && step.result && (
              <span className="demo-step-status">{step.result}</span>
            )}
            {step.status === 'done' && !step.result && (
              <span className="demo-step-status">✓</span>
            )}
          </div>
        ))}

        {showResult && (
          <div className="demo-result">
            {mode === 'vibe' && (
              <>
                <div className="demo-score">
                  <div className="demo-score-badge" style={{ color: scoreColor }}>
                    {result.score}%
                  </div>
                  <div>
                    <div className="demo-score-label">PROJECT VIBE SCORE</div>
                    <div className="demo-score-grade" style={{ color: scoreColor }}>
                      Grade: {result.grade}
                    </div>
                  </div>
                </div>
                <div className="demo-issues">
                  {result.issues.map((issue, i) => (
                    <div key={i} className={`demo-issue ${issue.type}`}>
                      {issue.type === 'success' ? '✅' : issue.type === 'warning' ? '⚠️' : '❌'}
                      {issue.text}
                    </div>
                  ))}
                </div>
              </>
            )}

            {mode === 'predeploy' && (
              <>
                <div 
                  className={`demo-deploy-status ${result.canDeploy ? 'approved' : 'blocked'}`}
                >
                  {result.canDeploy ? '✅ DEPLOYMENT APPROVED' : '🛑 DEPLOYMENT BLOCKED'}
                  <span style={{ fontWeight: 400, marginLeft: 8 }}>
                    — {result.canDeploy ? 'All critical checks passed!' : 'Fix issues before deploying'}
                  </span>
                </div>
                <div className="demo-issues" style={{ marginTop: 16 }}>
                  {result.issues.map((issue, i) => (
                    <div key={i} className={`demo-issue ${issue.type}`}>
                      {issue.type === 'success' ? '✅' : issue.type === 'warning' ? '⚠️' : '❌'}
                      {issue.text}
                    </div>
                  ))}
                </div>
              </>
            )}

            {mode === 'fix' && (
              <>
                <div className="demo-fix-summary">
                  <strong>✨ {result.score} templates applied successfully!</strong>
                </div>
                <div className="demo-issues" style={{ marginTop: 12 }}>
                  {result.issues.map((issue, i) => (
                    <div key={i} className={`demo-issue ${issue.type}`}>
                      {issue.type === 'success' ? '✅' : issue.type === 'warning' ? '⚠️' : '❌'}
                      {issue.text}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="demo-cta">
        <button 
          className="demo-button primary" 
          onClick={runDemo}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : `▶ Run ${mode === 'vibe' ? 'Vibe Check' : mode === 'predeploy' ? 'Pre-Deploy' : 'Auto-Fix'}`}
        </button>
      </div>
    </div>
  );
}

export default LiveDemo;
