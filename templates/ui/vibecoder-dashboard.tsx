/**
 * Vibecoder Dashboard
 * 
 * Main dashboard for vibecoders - super easy to use
 */

import React, { useState } from 'react';
import { Sparkles, Settings, Zap, Shield, BarChart, Play, Pause } from 'lucide-react';
import { StrictnessSettings } from './strictness-settings';
import './VibecoderDashboard.css';

export const VibecoderDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'strictness' | 'status' | 'settings'>('home');
  const [strictnessConfig, setStrictnessConfig] = useState<any>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const handleBuild = async () => {
    setIsBuilding(true);
    // Build logic here
    setTimeout(() => setIsBuilding(false), 2000);
  };

  return (
    <div className="vibecoder-dashboard">
      <div className="vibecoder-sidebar">
        <div className="vibecoder-logo">
          <Sparkles className="w-8 h-8" />
          <span>guardrail AI</span>
        </div>

        <nav className="vibecoder-nav">
          <button
            onClick={() => setActiveTab('home')}
            className={`vibecoder-nav-item ${activeTab === 'home' ? 'active' : ''}`}
          >
            <Zap className="w-5 h-5" />
            <span>Home</span>
          </button>
          <button
            onClick={() => setActiveTab('strictness')}
            className={`vibecoder-nav-item ${activeTab === 'strictness' ? 'active' : ''}`}
          >
            <Shield className="w-5 h-5" />
            <span>Strictness</span>
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`vibecoder-nav-item ${activeTab === 'status' ? 'active' : ''}`}
          >
            <BarChart className="w-5 h-5" />
            <span>Status</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`vibecoder-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      <div className="vibecoder-content">
        {activeTab === 'home' && (
          <HomeTab onBuild={handleBuild} isBuilding={isBuilding} />
        )}
        {activeTab === 'strictness' && (
          <StrictnessTab
            config={strictnessConfig}
            onConfigChange={setStrictnessConfig}
          />
        )}
        {activeTab === 'status' && <StatusTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
};

const HomeTab: React.FC<{ onBuild: () => void; isBuilding: boolean }> = ({ onBuild, isBuilding }) => (
  <div className="vibecoder-tab">
    <div className="vibecoder-hero">
      <h1>Welcome to guardrail AI</h1>
      <p>Your AI coding companion that never drifts</p>
    </div>

    <div className="vibecoder-actions">
      <button
        onClick={onBuild}
        disabled={isBuilding}
        className="vibecoder-build-button"
      >
        {isBuilding ? (
          <>
            <Pause className="w-5 h-5" />
            <span>Building...</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            <span>Build Project</span>
          </>
        )}
      </button>
    </div>

    <div className="vibecoder-quick-actions">
      <h2>Quick Actions</h2>
      <div className="quick-action-grid">
        <button className="quick-action-card">
          <Zap className="w-6 h-6" />
          <span>Analyze Project</span>
        </button>
        <button className="quick-action-card">
          <Shield className="w-6 h-6" />
          <span>Check Status</span>
        </button>
        <button className="quick-action-card">
          <BarChart className="w-6 h-6" />
          <span>View Insights</span>
        </button>
      </div>
    </div>
  </div>
);

const StrictnessTab: React.FC<{ config: any; onConfigChange: (config: any) => void }> = ({
  config,
  onConfigChange,
}) => (
  <div className="vibecoder-tab">
    <StrictnessSettings
      initialConfig={config}
      onConfigChange={onConfigChange}
    />
  </div>
);

<<<<<<< HEAD
const StatusTab: React.FC = () => {
  const rows = [
    { label: 'Ship readiness', value: 'Derived from last Vibe Check', hint: 'Run analysis from CI or locally' },
    { label: 'Critical gaps', value: '0 blocking', hint: 'Auth, env, errors, validation' },
    { label: 'Essential gaps', value: 'Review UX items', hint: 'Loading / empty states, 404' },
    { label: 'Templates on disk', value: 'Ready to apply', hint: 'Use apply-template in CLI or MCP' },
  ];
  return (
    <div className="vibecoder-tab vibecoder-status">
      <header className="vibecoder-status-head">
        <h1>Project status</h1>
        <p className="vibecoder-muted">Operational signals for AI-built apps — no live server required.</p>
      </header>
      <ul className="vibecoder-status-list">
        {rows.map((r) => (
          <li key={r.label} className="vibecoder-status-row">
            <div>
              <span className="vibecoder-status-label">{r.label}</span>
              <span className="vibecoder-status-value">{r.value}</span>
            </div>
            <span className="vibecoder-status-hint">{r.hint}</span>
          </li>
        ))}
      </ul>
      <p className="vibecoder-footnote">
        Wire this tab to your API or local JSON from <code>guardrail vibe-check --json</code>.
      </p>
    </div>
  );
};

const SettingsTab: React.FC = () => {
  const [endpoint, setEndpoint] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('gr_vibe_api') || '' : ''
  );
  const [strict, setStrict] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('gr_vibe_strict') === '1' : false
  );
  const [notify, setNotify] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('gr_vibe_notify') !== '0' : true
  );

  const persist = (patch: Record<string, string | boolean>) => {
    if (typeof window === 'undefined') return;
    if ('endpoint' in patch) localStorage.setItem('gr_vibe_api', String(patch.endpoint));
    if ('strict' in patch) localStorage.setItem('gr_vibe_strict', patch.strict ? '1' : '0');
    if ('notify' in patch) localStorage.setItem('gr_vibe_notify', patch.notify ? '1' : '0');
  };

  return (
    <div className="vibecoder-tab vibecoder-settings">
      <header className="vibecoder-status-head">
        <h1>Settings</h1>
        <p className="vibecoder-muted">Local preferences for this dashboard (stored in the browser).</p>
      </header>
      <div className="vibecoder-field">
        <label htmlFor="gr-endpoint">Optional API base URL</label>
        <input
          id="gr-endpoint"
          type="url"
          placeholder="https://api.example.com"
          value={endpoint}
          onChange={(e) => {
            setEndpoint(e.target.value);
            persist({ endpoint: e.target.value });
          }}
        />
      </div>
      <label className="vibecoder-check">
        <input
          type="checkbox"
          checked={strict}
          onChange={(e) => {
            setStrict(e.target.checked);
            persist({ strict: e.target.checked });
          }}
        />
        <span>Strict mode (fail CI when score is below threshold)</span>
      </label>
      <label className="vibecoder-check">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => {
            setNotify(e.target.checked);
            persist({ notify: e.target.checked });
          }}
        />
        <span>Show in-app notifications for new findings</span>
      </label>
    </div>
  );
};
=======
const StatusTab: React.FC = () => (
  <div className="vibecoder-tab">
    <h1>Project Status</h1>
    <p>Status information will appear here</p>
  </div>
);

const SettingsTab: React.FC = () => (
  <div className="vibecoder-tab">
    <h1>Settings</h1>
    <p>Settings will appear here</p>
  </div>
);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

