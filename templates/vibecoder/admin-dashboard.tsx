/**
 * Admin Dashboard
 * 
 * What AI app builders forget: Admin tools for managing the app
 */

import React, { useState } from 'react';
import { Users, Settings, BarChart, Shield, FileText, AlertTriangle } from 'lucide-react';
import './AdminDashboard.css';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-sidebar">
        <h2 className="admin-logo">Admin</h2>
        <nav className="admin-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="admin-content">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'content' && <ContentTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
};

const OverviewTab: React.FC = () => (
  <div className="admin-tab">
    <h1>Dashboard Overview</h1>
    <div className="admin-stats">
      <div className="admin-stat-card">
        <h3>Total Users</h3>
        <p className="admin-stat-value">1,234</p>
        <p className="admin-stat-change">+12% this month</p>
      </div>
      <div className="admin-stat-card">
        <h3>Active Users</h3>
        <p className="admin-stat-value">892</p>
        <p className="admin-stat-change">+8% this month</p>
      </div>
      <div className="admin-stat-card">
        <h3>Revenue</h3>
        <p className="admin-stat-value">$12,345</p>
        <p className="admin-stat-change">+23% this month</p>
      </div>
      <div className="admin-stat-card">
        <h3>Errors</h3>
        <p className="admin-stat-value">3</p>
        <p className="admin-stat-change admin-stat-change--error">-2 from yesterday</p>
      </div>
    </div>
  </div>
);

const UsersTab: React.FC = () => (
  <div className="admin-tab">
    <h1>User Management</h1>
    <div className="admin-table-container">
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>user@example.com</td>
            <td><span className="admin-badge admin-badge--active">Active</span></td>
            <td>2024-01-15</td>
            <td>
              <button className="admin-button admin-button--small">Edit</button>
              <button className="admin-button admin-button--small admin-button--danger">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

const ContentTab: React.FC = () => (
  <div className="admin-tab">
    <h1>Content Management</h1>
    <p>Manage app content, posts, pages, etc.</p>
  </div>
);

const SecurityTab: React.FC = () => (
  <div className="admin-tab">
    <h1>Security</h1>
    <div className="admin-alerts">
      <div className="admin-alert admin-alert--warning">
        <AlertTriangle className="w-5 h-5" />
        <div>
          <h4>Security Alert</h4>
          <p>3 failed login attempts detected</p>
        </div>
      </div>
    </div>
  </div>
);

const SettingsTab: React.FC = () => (
  <div className="admin-tab">
    <h1>Admin Settings</h1>
    <p>Configure admin panel settings</p>
  </div>
);

