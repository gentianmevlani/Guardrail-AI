/**
 * Documentation Settings
 * 
 * UI for configuring documentation auto-updates
 */

import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import './DocumentationSettings.css';

export interface DocumentationSettingsProps {
  onConfigChange: (config: any) => void;
  initialConfig?: any;
}

export const DocumentationSettings: React.FC<DocumentationSettingsProps> = ({
  onConfigChange,
  initialConfig,
}) => {
  const [config, setConfig] = useState({
    updateFrequency: 'weekly',
    updateReadme: true,
    updateQuickStart: true,
    updateScripts: true,
    updateApiDocs: true,
    ...initialConfig,
  });

  const [lastUpdate, setLastUpdate] = useState(initialConfig?.lastUpdated || null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      setLastUpdate(initialConfig.lastUpdated);
    }
  }, [initialConfig]);

  const handleFrequencyChange = (frequency: string) => {
    const newConfig = { ...config, updateFrequency: frequency };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleToggle = (key: string) => {
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    // Simulate update
    setTimeout(() => {
      setLastUpdate(new Date().toISOString());
      setIsUpdating(false);
    }, 2000);
  };

  const frequencyOptions = [
    { value: 'never', label: 'Never', icon: '🚫', desc: 'Manual updates only' },
    { value: 'daily', label: 'Daily', icon: '📅', desc: 'Update every day' },
    { value: 'weekly', label: 'Weekly', icon: '📆', desc: 'Update once a week' },
    { value: 'on-change', label: 'On Change', icon: '🔄', desc: 'Update when code changes' },
    { value: 'manual', label: 'Manual', icon: '👆', desc: 'Update when you click' },
  ];

  return (
    <div className="documentation-settings">
      <div className="docs-header">
        <FileText className="w-6 h-6" />
        <div>
          <h2>Documentation Auto-Update</h2>
          <p>Keep your documentation in sync with your codebase</p>
        </div>
      </div>

      {/* Update Frequency */}
      <div className="docs-section">
        <h3>Update Frequency</h3>
        <p className="docs-subtitle">
          How often should guardrail update your documentation?
        </p>
        <div className="frequency-options">
          {frequencyOptions.map(option => (
            <button
              key={option.value}
              onClick={() => handleFrequencyChange(option.value)}
              className={`frequency-option ${config.updateFrequency === option.value ? 'active' : ''}`}
            >
              <div className="frequency-icon">{option.icon}</div>
              <div>
                <div className="frequency-label">{option.label}</div>
                <div className="frequency-desc">{option.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* What to Update */}
      <div className="docs-section">
        <h3>What to Update</h3>
        <p className="docs-subtitle">
          Select which documentation files to auto-update
        </p>
        <div className="update-options">
          <label className="update-option">
            <input
              type="checkbox"
              checked={config.updateReadme}
              onChange={() => handleToggle('updateReadme')}
            />
            <div>
              <div className="update-label">README.md</div>
              <div className="update-desc">Main project documentation</div>
            </div>
          </label>
          <label className="update-option">
            <input
              type="checkbox"
              checked={config.updateQuickStart}
              onChange={() => handleToggle('updateQuickStart')}
            />
            <div>
              <div className="update-label">QUICK-START.md</div>
              <div className="update-desc">Quick start guide</div>
            </div>
          </label>
          <label className="update-option">
            <input
              type="checkbox"
              checked={config.updateScripts}
              onChange={() => handleToggle('updateScripts')}
            />
            <div>
              <div className="update-label">SCRIPTS.md</div>
              <div className="update-desc">Available scripts documentation</div>
            </div>
          </label>
          <label className="update-option">
            <input
              type="checkbox"
              checked={config.updateApiDocs}
              onChange={() => handleToggle('updateApiDocs')}
            />
            <div>
              <div className="update-label">API-DOCS.md</div>
              <div className="update-desc">API endpoint documentation</div>
            </div>
          </label>
        </div>
      </div>

      {/* Status */}
      <div className="docs-section">
        <h3>Status</h3>
        <div className="docs-status">
          {lastUpdate ? (
            <div className="status-item">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <div className="status-label">Last Updated</div>
                <div className="status-value">
                  {new Date(lastUpdate).toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="status-item">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <div>
                <div className="status-label">Never Updated</div>
                <div className="status-value">Click "Update Now" to start</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="docs-actions">
        <button
          onClick={handleUpdateNow}
          disabled={isUpdating}
          className="update-now-button"
        >
          <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
          <span>{isUpdating ? 'Updating...' : 'Update Now'}</span>
        </button>
      </div>
    </div>
  );
};

