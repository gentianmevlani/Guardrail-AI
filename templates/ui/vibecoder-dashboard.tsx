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

