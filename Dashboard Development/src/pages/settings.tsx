"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Settings, Bell, Shield, Github, User, Mail, Lock, Key, Palette, Code, Database, Zap, CreditCard } from "lucide-react";
import { motion } from "motion/react";

export function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    critical: true,
    weekly: false,
    slack: true,
  });

  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const settingsSections = [
    {
      title: "Account",
      icon: User,
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      cards: ["Profile", "Security"],
    },
    {
      title: "Integrations",
      icon: Zap,
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
      cards: ["Integrations"],
    },
    {
      title: "Preferences",
      icon: Settings,
      color: "text-green-400",
      bg: "from-green-500/20 to-emerald-500/20",
      cards: ["Notifications", "Appearance"],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-zinc-500/20 to-zinc-600/20 border border-zinc-500/30">
            <Settings className="w-6 h-6 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-zinc-400">Manage your account and preferences</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                <CardTitle className="text-white">Profile</CardTitle>
              </div>
              <CardDescription className="text-zinc-400">
                Your account information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Name</label>
                <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-white">
                  John Doe
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Email</label>
                <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-zinc-500" />
                  john.doe@example.com
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Organization</label>
                <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-white">
                  Acme Corp
                </div>
              </div>
              <Button variant="outline" className="w-full border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
                Update Profile
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                <CardTitle className="text-white">Security</CardTitle>
              </div>
              <CardDescription className="text-zinc-400">
                Manage your security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-white">Two-Factor Authentication</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Enabled
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-white">API Keys</span>
                </div>
                <Badge variant="outline" className="border-zinc-600 text-zinc-400">
                  2 Active
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-white">Session Management</span>
                </div>
                <Badge variant="outline" className="border-zinc-600 text-zinc-400">
                  3 Active
                </Badge>
              </div>
              <Button variant="outline" className="w-full border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
                Change Password
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-400" />
                <CardTitle className="text-white">Notifications</CardTitle>
              </div>
              <CardDescription className="text-zinc-400">
                Configure your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "email", label: "Email Notifications", enabled: notifications.email },
                { key: "critical", label: "Critical Alerts", enabled: notifications.critical },
                { key: "weekly", label: "Weekly Summary", enabled: notifications.weekly },
                { key: "slack", label: "Slack Notifications", enabled: notifications.slack },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <span className="text-sm text-white">{item.label}</span>
                  <button
                    onClick={() => setNotifications({ ...notifications, [item.key]: !item.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      item.enabled ? "bg-blue-600" : "bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        item.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Integrations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-purple-400" />
                <CardTitle className="text-white">Integrations</CardTitle>
              </div>
              <CardDescription className="text-zinc-400">
                Connected services and integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Github className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">GitHub</p>
                    <p className="text-xs text-zinc-500">Last sync: 5 minutes ago</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Connected
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Code className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Slack</p>
                    <p className="text-xs text-zinc-500">Notifications enabled</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Connected
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <Zap className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Jira</p>
                    <p className="text-xs text-zinc-500">Not connected</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="border-zinc-600 text-zinc-400 hover:text-white">
                  Connect
                </Button>
              </div>
              <Button variant="outline" className="w-full border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
                Manage Integrations
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-pink-400" />
                <CardTitle className="text-white">Appearance</CardTitle>
              </div>
              <CardDescription className="text-zinc-400">
                Customize your dashboard appearance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTheme("dark")}
                    className={`p-4 rounded-lg border transition-all ${
                      theme === "dark"
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                    }`}
                  >
                    <div className="w-full h-12 rounded bg-zinc-900 border border-zinc-700 mb-2" />
                    <p className="text-sm text-white font-medium">Dark</p>
                  </button>
                  <button
                    onClick={() => setTheme("light")}
                    className={`p-4 rounded-lg border transition-all ${
                      theme === "light"
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                    }`}
                  >
                    <div className="w-full h-12 rounded bg-white border border-zinc-300 mb-2" />
                    <p className="text-sm text-white font-medium">Light</p>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <span className="text-sm text-white">Compact Mode</span>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-700">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Billing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                <CardTitle className="text-white">Billing & Usage</CardTitle>
              </div>
              <CardDescription className="text-zinc-400">
                Manage your subscription and usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-zinc-400">Current Plan</p>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    Free Tier
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-white">$0 / month</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-zinc-400">Scans Used</p>
                  <p className="text-sm text-white">47 / 100</p>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" style={{ width: "47%" }} />
                </div>
              </div>
              <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white">
                Upgrade to Pro
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}