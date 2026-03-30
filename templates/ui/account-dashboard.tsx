/**
 * Account Dashboard
 * 
 * User account management and settings
 */

import React, { useState } from 'react';
import { User, Settings, CreditCard, Key, BarChart, LogOut, Github, Link as LinkIcon } from 'lucide-react';
import './AccountDashboard.css';

export interface AccountDashboardProps {
  user: {
    id: string;
    email: string;
    name: string;
    subscription: {
      tier: 'free' | 'pro' | 'enterprise';
      expiresAt?: string;
    };
    integrations: {
      github?: { connected: boolean };
      [key: string]: any;
    };
  };
  onUpdatePreferences: (preferences: Record<string, any>) => Promise<void>;
  onConnectGitHub: (token: string) => Promise<void>;
  onUpdateSubscription: (tier: string) => Promise<void>;
  onLogout: () => void;
}

export const AccountDashboard: React.FC<AccountDashboardProps> = ({
  user,
  onUpdatePreferences,
  onConnectGitHub,
  onUpdateSubscription,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'billing' | 'integrations'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'integrations', label: 'Integrations', icon: LinkIcon },
  ];

  return (
    <div className="account-dashboard">
      <div className="account-sidebar">
        <div className="account-user-info">
          <div className="account-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
        </div>

        <nav className="account-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`account-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <button onClick={onLogout} className="account-logout">
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>

      <div className="account-content">
        {activeTab === 'overview' && <OverviewTab user={user} />}
        {activeTab === 'settings' && <SettingsTab user={user} onUpdatePreferences={onUpdatePreferences} />}
        {activeTab === 'billing' && <BillingTab user={user} onUpdateSubscription={onUpdateSubscription} />}
        {activeTab === 'integrations' && <IntegrationsTab user={user} onConnectGitHub={onConnectGitHub} />}
      </div>
    </div>
  );
};

const OverviewTab: React.FC<{ user: any }> = ({ user }) => (
  <div className="account-tab">
    <h1>Account Overview</h1>
    <div className="account-stats">
      <div className="account-stat-card">
        <h3>Subscription</h3>
        <p className="account-stat-value">{user.subscription.tier.toUpperCase()}</p>
        {user.subscription.expiresAt && (
          <p className="account-stat-meta">Expires: {new Date(user.subscription.expiresAt).toLocaleDateString()}</p>
        )}
      </div>
      <div className="account-stat-card">
        <h3>Integrations</h3>
        <p className="account-stat-value">
          {Object.values(user.integrations).filter((i: any) => i?.connected).length}
        </p>
        <p className="account-stat-meta">Connected services</p>
      </div>
    </div>
  </div>
);

const SettingsTab: React.FC<{ user: any; onUpdatePreferences: (p: any) => Promise<void> }> = ({ user, onUpdatePreferences }) => {
  const [preferences, setPreferences] = useState(user.preferences || {});

  const handleSave = async () => {
    await onUpdatePreferences(preferences);
  };

  return (
    <div className="account-tab">
      <h1>Settings</h1>
      <div className="account-settings">
        <div className="account-setting-group">
          <label>Email Notifications</label>
          <input
            type="checkbox"
            checked={preferences.emailNotifications !== false}
            onChange={(e) => setPreferences({ ...preferences, emailNotifications: e.target.checked })}
          />
        </div>
        <button onClick={handleSave} className="account-save-button">
          Save Settings
        </button>
      </div>
    </div>
  );
};

const BillingTab: React.FC<{ user: any; onUpdateSubscription: (tier: string) => Promise<void> }> = ({ user, onUpdateSubscription }) => (
  <div className="account-tab">
    <h1>Billing & Subscription</h1>
    <div className="account-billing">
      <div className="account-plan-card">
        <h3>Current Plan</h3>
        <p className="account-plan-name">{user.subscription.tier.toUpperCase()}</p>
        <button onClick={() => onUpdateSubscription('pro')} className="account-upgrade-button">
          Upgrade to Pro
        </button>
      </div>
    </div>
  </div>
);

const IntegrationsTab: React.FC<{ user: any; onConnectGitHub: (token: string) => Promise<void> }> = ({ user, onConnectGitHub }) => {
  const [githubToken, setGithubToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(!user.integrations.github?.connected);

  const handleConnect = async () => {
    if (githubToken) {
      await onConnectGitHub(githubToken);
      setShowTokenInput(false);
    }
  };

  return (
    <div className="account-tab">
      <h1>Integrations</h1>
      <div className="account-integrations">
        <div className="account-integration-card">
          <div className="account-integration-header">
            <Github className="w-6 h-6" />
            <div>
              <h3>GitHub</h3>
              <p>Connect your GitHub account</p>
            </div>
          </div>
          {user.integrations.github?.connected ? (
            <div className="account-integration-status">
              <span className="account-status-badge connected">Connected</span>
              <button onClick={() => setShowTokenInput(true)} className="account-reconnect-button">
                Reconnect
              </button>
            </div>
          ) : (
            <div className="account-integration-connect">
              {showTokenInput ? (
                <>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="GitHub Personal Access Token"
                    className="account-token-input"
                  />
                  <button onClick={handleConnect} className="account-connect-button">
                    Connect
                  </button>
                </>
              ) : (
                <button onClick={() => setShowTokenInput(true)} className="account-connect-button">
                  Connect GitHub
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

