"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Users, UserPlus, Mail, Shield, Crown, Activity, BarChart3, Clock } from "lucide-react";
import { motion } from "motion/react";

export function TeamPage() {
  const [selectedRole, setSelectedRole] = useState<"all" | "admin" | "developer" | "viewer">("all");

  const teamMembers = [
    {
      name: "Sarah Chen",
      email: "sarah.chen@example.com",
      role: "admin",
      avatar: "SC",
      status: "active",
      lastActive: "5 minutes ago",
      permissions: ["Full Access", "User Management", "Settings"],
      activityScore: 98,
      reposAccess: 15,
    },
    {
      name: "Michael Rodriguez",
      email: "michael.r@example.com",
      role: "developer",
      avatar: "MR",
      status: "active",
      lastActive: "1 hour ago",
      permissions: ["Read", "Write", "Scan"],
      activityScore: 87,
      reposAccess: 12,
    },
    {
      name: "Emily Watson",
      email: "emily.w@example.com",
      role: "developer",
      avatar: "EW",
      status: "active",
      lastActive: "2 hours ago",
      permissions: ["Read", "Write", "Scan"],
      activityScore: 92,
      reposAccess: 10,
    },
    {
      name: "David Kim",
      email: "david.kim@example.com",
      role: "admin",
      avatar: "DK",
      status: "active",
      lastActive: "30 minutes ago",
      permissions: ["Full Access", "User Management", "Settings"],
      activityScore: 95,
      reposAccess: 15,
    },
    {
      name: "Jessica Taylor",
      email: "jessica.t@example.com",
      role: "developer",
      avatar: "JT",
      status: "away",
      lastActive: "1 day ago",
      permissions: ["Read", "Write", "Scan"],
      activityScore: 76,
      reposAccess: 8,
    },
    {
      name: "Alex Johnson",
      email: "alex.j@example.com",
      role: "viewer",
      avatar: "AJ",
      status: "active",
      lastActive: "3 hours ago",
      permissions: ["Read"],
      activityScore: 45,
      reposAccess: 5,
    },
    {
      name: "Rachel Green",
      email: "rachel.g@example.com",
      role: "viewer",
      avatar: "RG",
      status: "active",
      lastActive: "4 hours ago",
      permissions: ["Read"],
      activityScore: 52,
      reposAccess: 3,
    },
    {
      name: "Tom Anderson",
      email: "tom.a@example.com",
      role: "developer",
      avatar: "TA",
      status: "inactive",
      lastActive: "5 days ago",
      permissions: ["Read", "Write", "Scan"],
      activityScore: 23,
      reposAccess: 6,
    },
  ];

  const filteredMembers = selectedRole === "all"
    ? teamMembers
    : teamMembers.filter(m => m.role === selectedRole);

  const getRoleColor = (role: string) => {
    const colors: Record<string, { text: string; bg: string; border: string; icon: any }> = {
      admin: { text: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30", icon: Crown },
      developer: { text: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30", icon: Shield },
      viewer: { text: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30", icon: Users },
    };
    return colors[role] || { text: "text-zinc-400", bg: "bg-zinc-500/20", border: "border-zinc-500/30", icon: Users };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return { text: "text-emerald-400", bg: "bg-emerald-500" };
      case "away":
        return { text: "text-yellow-400", bg: "bg-yellow-500" };
      case "inactive":
        return { text: "text-zinc-500", bg: "bg-zinc-500" };
      default:
        return { text: "text-zinc-400", bg: "bg-zinc-500" };
    }
  };

  const stats = [
    { 
      label: "Total Members", 
      value: teamMembers.length.toString(), 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: Users
    },
    { 
      label: "Admins", 
      value: teamMembers.filter(m => m.role === "admin").length.toString(), 
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
      icon: Crown
    },
    { 
      label: "Active Now", 
      value: teamMembers.filter(m => m.status === "active").length.toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: Activity
    },
    { 
      label: "Avg. Activity", 
      value: Math.round(teamMembers.reduce((sum, m) => sum + m.activityScore, 0) / teamMembers.length).toString() + "%", 
      color: "text-cyan-400",
      bg: "from-cyan-500/20 to-blue-500/20",
      icon: BarChart3
    },
  ];

  const getAvatarGradient = (name: string) => {
    const gradients = [
      "from-blue-500 to-cyan-500",
      "from-purple-500 to-pink-500",
      "from-green-500 to-emerald-500",
      "from-orange-500 to-red-500",
      "from-indigo-500 to-purple-500",
      "from-yellow-500 to-orange-500",
    ];
    const index = name.charCodeAt(0) % gradients.length;
    return gradients[index];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Team
              </h1>
              <p className="text-zinc-400">Manage team members and permissions</p>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Role Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-2"
      >
        <Shield className="w-4 h-4 text-zinc-500" />
        <div className="flex gap-2">
          {(["all", "admin", "developer", "viewer"] as const).map((role) => (
            <Button
              key={role}
              variant={selectedRole === role ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRole(role)}
              className={selectedRole === role 
                ? "bg-blue-600 text-white" 
                : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
              }
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Team Members Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredMembers.map((member, index) => {
          const roleColor = getRoleColor(member.role);
          const statusColor = getStatusColor(member.status);
          const RoleIcon = roleColor.icon;
          
          return (
            <motion.div
              key={member.email}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
            >
              <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarGradient(member.name)} flex items-center justify-center`}>
                          <span className="text-white font-semibold">{member.avatar}</span>
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${statusColor.bg} border-2 border-zinc-900`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                          {member.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </div>
                      </div>
                    </div>
                    <Badge className={`${roleColor.bg} ${roleColor.text} ${roleColor.border} flex items-center gap-1`}>
                      <RoleIcon className="w-3 h-3" />
                      {member.role}
                    </Badge>
                  </div>

                  {/* Permissions */}
                  <div className="mb-4">
                    <p className="text-xs text-zinc-500 mb-2">Permissions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {member.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 rounded bg-zinc-800/50">
                      <p className="text-xs text-zinc-500">Activity</p>
                      <p className={`text-sm font-semibold ${
                        member.activityScore >= 80 ? "text-emerald-400" :
                        member.activityScore >= 50 ? "text-yellow-400" :
                        "text-red-400"
                      }`}>
                        {member.activityScore}%
                      </p>
                    </div>
                    <div className="text-center p-2 rounded bg-zinc-800/50">
                      <p className="text-xs text-zinc-500">Repos</p>
                      <p className="text-sm font-semibold text-blue-400">{member.reposAccess}</p>
                    </div>
                    <div className="text-center p-2 rounded bg-zinc-800/50">
                      <p className="text-xs text-zinc-500">Status</p>
                      <p className={`text-sm font-semibold capitalize ${statusColor.text}`}>
                        {member.status}
                      </p>
                    </div>
                  </div>

                  {/* Last Active */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      Last active: {member.lastActive}
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 h-7">
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Pending Invitations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-400" />
              Pending Invitations
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Team members who haven't accepted their invitation yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { email: "john.smith@example.com", role: "developer", sentDate: "2 days ago" },
                { email: "lisa.wong@example.com", role: "viewer", sentDate: "5 days ago" },
              ].map((invite, index) => {
                const roleColor = getRoleColor(invite.role);
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-zinc-500" />
                      </div>
                      <div>
                        <p className="text-sm text-white">{invite.email}</p>
                        <p className="text-xs text-zinc-500">Invited {invite.sentDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${roleColor.bg} ${roleColor.text} ${roleColor.border}`}>
                        {invite.role}
                      </Badge>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                        Revoke
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
