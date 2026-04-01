/**
 * Settings Page
 * 
 * What AI app builders forget: User preferences and settings
 */

import React, { useState } from 'react';
import { Save, Bell, Moon, Globe, Shield, Trash2 } from 'lucide-react';
import { useToast } from './toast-notifications';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: false,
      sms: false,
    },
    theme: 'light',
    language: 'en',
    privacy: {
      profileVisibility: 'public',
      dataSharing: false,
    },
  });

  const handleSave = async () => {
    // Save to backend
    try {
      // await saveSettings(settings);
      showToast('success', 'Settings saved successfully!');
    } catch (error) {
      showToast('error', 'Failed to save settings');
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your preferences and account settings</p>
      </div>

      <div className="settings-content">
        {/* Notifications */}
        <section className="settings-section">
          <div className="settings-section-header">
            <Bell className="w-5 h-5" />
            <h2>Notifications</h2>
          </div>
          <div className="settings-section-content">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.email}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      email: e.target.checked,
                    },
                  })
                }
              />
              <span>Email notifications</span>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.push}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      push: e.target.checked,
                    },
                  })
                }
              />
              <span>Push notifications</span>
            </label>
          </div>
        </section>

        {/* Appearance */}
        <section className="settings-section">
          <div className="settings-section-header">
            <Moon className="w-5 h-5" />
            <h2>Appearance</h2>
          </div>
          <div className="settings-section-content">
            <label>
              Theme
              <select
                value={settings.theme}
                onChange={(e) =>
                  setSettings({ ...settings, theme: e.target.value })
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </label>
          </div>
        </section>

        {/* Language */}
        <section className="settings-section">
          <div className="settings-section-header">
            <Globe className="w-5 h-5" />
            <h2>Language & Region</h2>
          </div>
          <div className="settings-section-content">
            <label>
              Language
              <select
                value={settings.language}
                onChange={(e) =>
                  setSettings({ ...settings, language: e.target.value })
                }
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </label>
          </div>
        </section>

        {/* Privacy */}
        <section className="settings-section">
          <div className="settings-section-header">
            <Shield className="w-5 h-5" />
            <h2>Privacy</h2>
          </div>
          <div className="settings-section-content">
            <label>
              Profile Visibility
              <select
                value={settings.privacy.profileVisibility}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    privacy: {
                      ...settings.privacy,
                      profileVisibility: e.target.value,
                    },
                  })
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="friends">Friends Only</option>
              </select>
            </label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.privacy.dataSharing}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    privacy: {
                      ...settings.privacy,
                      dataSharing: e.target.checked,
                    },
                  })
                }
              />
              <span>Allow data sharing for analytics</span>
            </label>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="settings-section settings-section--danger">
          <div className="settings-section-header">
            <Trash2 className="w-5 h-5" />
            <h2>Danger Zone</h2>
          </div>
          <div className="settings-section-content">
            <button className="settings-button settings-button--danger">
              Delete Account
            </button>
          </div>
        </section>
      </div>

      <div className="settings-footer">
        <button onClick={handleSave} className="settings-button settings-button--primary">
          <Save className="w-5 h-5" />
          Save Changes
        </button>
      </div>
    </div>
  );
};

