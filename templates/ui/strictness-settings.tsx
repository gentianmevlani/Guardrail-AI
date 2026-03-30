/**
 * Strictness Settings UI
 * 
 * Visual toggles for controlling AI agent strictness
 */

import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Settings, Zap, Lock } from 'lucide-react';
import './StrictnessSettings.css';

export interface StrictnessSettingsProps {
  onConfigChange: (config: any) => void;
  initialConfig?: any;
}

export const StrictnessSettings: React.FC<StrictnessSettingsProps> = ({
  onConfigChange,
  initialConfig,
}) => {
  const [level, setLevel] = useState<'relaxed' | 'moderate' | 'strict' | 'maximum' | 'custom'>(
    initialConfig?.level || 'moderate'
  );
  const [rules, setRules] = useState(initialConfig?.rules || {});

  useEffect(() => {
    if (initialConfig) {
      setLevel(initialConfig.level);
      setRules(initialConfig.rules);
    }
  }, [initialConfig]);

  const handleLevelChange = (newLevel: 'relaxed' | 'moderate' | 'strict' | 'maximum') => {
    setLevel(newLevel);
    const presets = {
      relaxed: {
        buildBlocksOnErrors: true,
        buildBlocksOnWarnings: false,
        buildBlocksOnLintErrors: false,
        buildBlocksOnTypeErrors: false,
        requireTests: false,
        requireDocumentation: false,
        requireTypeSafety: false,
        blockAnyTypes: false,
        blockMockData: true,
        requireRealEndpoints: true,
        validateAPICalls: false,
        requireInputValidation: false,
        requireAuthChecks: false,
        blockSecurityIssues: true,
        requireOptimization: false,
        blockSlowCode: false,
        requireCaching: false,
        requireA11y: false,
        blockA11yIssues: false,
        preCommitBlocks: false,
        preCommitRequiresTests: false,
        preCommitRequiresLint: false,
      },
      moderate: {
        buildBlocksOnErrors: true,
        buildBlocksOnWarnings: false,
        buildBlocksOnLintErrors: true,
        buildBlocksOnTypeErrors: true,
        requireTests: false,
        requireDocumentation: false,
        requireTypeSafety: true,
        blockAnyTypes: true,
        blockMockData: true,
        requireRealEndpoints: true,
        validateAPICalls: true,
        requireInputValidation: true,
        requireAuthChecks: false,
        blockSecurityIssues: true,
        requireOptimization: false,
        blockSlowCode: false,
        requireCaching: false,
        requireA11y: true,
        blockA11yIssues: false,
        preCommitBlocks: true,
        preCommitRequiresTests: false,
        preCommitRequiresLint: true,
      },
      strict: {
        buildBlocksOnErrors: true,
        buildBlocksOnWarnings: true,
        buildBlocksOnLintErrors: true,
        buildBlocksOnTypeErrors: true,
        requireTests: true,
        requireDocumentation: true,
        requireTypeSafety: true,
        blockAnyTypes: true,
        blockMockData: true,
        requireRealEndpoints: true,
        validateAPICalls: true,
        requireInputValidation: true,
        requireAuthChecks: true,
        blockSecurityIssues: true,
        requireOptimization: true,
        blockSlowCode: true,
        requireCaching: true,
        requireA11y: true,
        blockA11yIssues: true,
        preCommitBlocks: true,
        preCommitRequiresTests: true,
        preCommitRequiresLint: true,
      },
      maximum: {
        buildBlocksOnErrors: true,
        buildBlocksOnWarnings: true,
        buildBlocksOnLintErrors: true,
        buildBlocksOnTypeErrors: true,
        requireTests: true,
        requireDocumentation: true,
        requireTypeSafety: true,
        blockAnyTypes: true,
        blockMockData: true,
        requireRealEndpoints: true,
        validateAPICalls: true,
        requireInputValidation: true,
        requireAuthChecks: true,
        blockSecurityIssues: true,
        requireOptimization: true,
        blockSlowCode: true,
        requireCaching: true,
        requireA11y: true,
        blockA11yIssues: true,
        preCommitBlocks: true,
        preCommitRequiresTests: true,
        preCommitRequiresLint: true,
      },
    };

    const newRules = presets[newLevel];
    setRules(newRules);
    setLevel(newLevel);
    onConfigChange({ level: newLevel, rules: newRules });
  };

  const handleRuleToggle = (ruleKey: string) => {
    const newRules = {
      ...rules,
      [ruleKey]: !rules[ruleKey],
    };
    setRules(newRules);
    setLevel('custom');
    onConfigChange({ level: 'custom', rules: newRules });
  };

  const ruleCategories = [
    {
      title: 'Build & Compilation',
      icon: Zap,
      rules: [
        { key: 'buildBlocksOnErrors', label: 'Block build on errors', description: 'Build fails if there are any errors' },
        { key: 'buildBlocksOnWarnings', label: 'Block build on warnings', description: 'Build fails if there are warnings' },
        { key: 'buildBlocksOnLintErrors', label: 'Block build on ESLint errors', description: 'Build fails if ESLint finds errors' },
        { key: 'buildBlocksOnTypeErrors', label: 'Block build on TypeScript errors', description: 'Build fails if TypeScript finds errors' },
      ],
    },
    {
      title: 'Code Quality',
      icon: CheckCircle,
      rules: [
        { key: 'requireTests', label: 'Require tests', description: 'Code must have tests before building' },
        { key: 'requireDocumentation', label: 'Require documentation', description: 'Functions must be documented' },
        { key: 'requireTypeSafety', label: 'Require type safety', description: 'All code must be typed' },
        { key: 'blockAnyTypes', label: 'Block "any" types', description: 'Prevent use of "any" type' },
      ],
    },
    {
      title: 'API & Data',
      icon: Settings,
      rules: [
        { key: 'blockMockData', label: 'Block mock data', description: 'Prevent use of fake/mock data' },
        { key: 'requireRealEndpoints', label: 'Require real endpoints', description: 'Only use registered API endpoints' },
        { key: 'validateAPICalls', label: 'Validate API calls', description: 'Validate all API calls' },
      ],
    },
    {
      title: 'Security',
      icon: Lock,
      rules: [
        { key: 'requireInputValidation', label: 'Require input validation', description: 'All inputs must be validated' },
        { key: 'requireAuthChecks', label: 'Require auth checks', description: 'Protected routes must check auth' },
        { key: 'blockSecurityIssues', label: 'Block security issues', description: 'Block known security vulnerabilities' },
      ],
    },
    {
      title: 'Pre-Commit',
      icon: Shield,
      rules: [
        { key: 'preCommitBlocks', label: 'Block on pre-commit', description: 'Prevent commits that fail checks' },
        { key: 'preCommitRequiresTests', label: 'Require tests before commit', description: 'Tests must pass before commit' },
        { key: 'preCommitRequiresLint', label: 'Require lint before commit', description: 'Lint must pass before commit' },
      ],
    },
  ];

  return (
    <div className="strictness-settings">
      <div className="strictness-header">
        <h2>AI Agent Strictness</h2>
        <p>Control how strict your AI agent and build process should be</p>
      </div>

      {/* Preset Levels */}
      <div className="strictness-presets">
        <h3>Quick Presets</h3>
        <div className="preset-buttons">
          <button
            onClick={() => handleLevelChange('relaxed')}
            className={`preset-button ${level === 'relaxed' ? 'active' : ''}`}
          >
            <div className="preset-icon">😌</div>
            <div>
              <div className="preset-name">Relaxed</div>
              <div className="preset-desc">Build passes with warnings</div>
            </div>
          </button>
          <button
            onClick={() => handleLevelChange('moderate')}
            className={`preset-button ${level === 'moderate' ? 'active' : ''}`}
          >
            <div className="preset-icon">⚖️</div>
            <div>
              <div className="preset-name">Moderate</div>
              <div className="preset-desc">Blocks errors, allows warnings</div>
            </div>
          </button>
          <button
            onClick={() => handleLevelChange('strict')}
            className={`preset-button ${level === 'strict' ? 'active' : ''}`}
          >
            <div className="preset-icon">🛡️</div>
            <div>
              <div className="preset-name">Strict</div>
              <div className="preset-desc">Blocks errors and warnings</div>
            </div>
          </button>
          <button
            onClick={() => handleLevelChange('maximum')}
            className={`preset-button ${level === 'maximum' ? 'active' : ''}`}
          >
            <div className="preset-icon">🔒</div>
            <div>
              <div className="preset-name">Maximum</div>
              <div className="preset-desc">Everything must be perfect</div>
            </div>
          </button>
        </div>
      </div>

      {/* Custom Rules */}
      <div className="strictness-rules">
        <h3>Customize Rules</h3>
        <p className="strictness-subtitle">
          Toggle individual rules to customize your strictness level
        </p>

        {ruleCategories.map((category) => {
          const Icon = category.icon;
          return (
            <div key={category.title} className="rule-category">
              <div className="rule-category-header">
                <Icon className="w-5 h-5" />
                <h4>{category.title}</h4>
              </div>
              <div className="rule-list">
                {category.rules.map((rule) => (
                  <div key={rule.key} className="rule-item">
                    <div className="rule-info">
                      <div className="rule-label">{rule.label}</div>
                      <div className="rule-description">{rule.description}</div>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={rules[rule.key] || false}
                        onChange={() => handleRuleToggle(rule.key)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Status */}
      <div className="strictness-status">
        <h3>Current Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <div className="status-label">Build will block on:</div>
            <div className="status-values">
              {rules.buildBlocksOnErrors && <span className="status-badge">Errors</span>}
              {rules.buildBlocksOnWarnings && <span className="status-badge">Warnings</span>}
              {rules.buildBlocksOnLintErrors && <span className="status-badge">Lint Errors</span>}
              {rules.buildBlocksOnTypeErrors && <span className="status-badge">Type Errors</span>}
              {!rules.buildBlocksOnErrors && !rules.buildBlocksOnWarnings && 
               !rules.buildBlocksOnLintErrors && !rules.buildBlocksOnTypeErrors && (
                <span className="status-badge inactive">Nothing</span>
              )}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">Pre-commit will:</div>
            <div className="status-values">
              {rules.preCommitBlocks ? (
                <>
                  {rules.preCommitRequiresTests && <span className="status-badge">Require Tests</span>}
                  {rules.preCommitRequiresLint && <span className="status-badge">Require Lint</span>}
                </>
              ) : (
                <span className="status-badge inactive">Not block</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

