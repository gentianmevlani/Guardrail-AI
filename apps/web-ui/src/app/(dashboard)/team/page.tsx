"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  Mail, 
  Shield, 
  Crown, 
  Code, 
  Eye, 
  ClipboardCheck,
  Plus,
  Trash2,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";

type Role = "owner" | "admin" | "dev" | "viewer" | "compliance-auditor";

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  joinedAt: string;
  lastActive?: string;
}

interface SeatInfo {
  current: number;
  max: number;
  tier: string;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

const ROLE_CONFIG: Record<Role, { label: string; icon: React.ElementType; color: string; description: string }> = {
  owner: {
    label: "Owner",
    icon: Crown,
    color: "text-purple-500",
    description: "Full access including billing",
  },
  admin: {
    label: "Admin",
    icon: Shield,
    color: "text-blue-500",
    description: "Manage team and settings",
  },
  dev: {
    label: "Developer",
    icon: Code,
    color: "text-green-500",
    description: "Run scans and fixes",
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    color: "text-gray-500",
    description: "View-only access",
  },
  "compliance-auditor": {
    label: "Compliance Auditor",
    icon: ClipboardCheck,
    color: "text-amber-500",
    description: "View and export audit logs",
  },
};

const ASSIGNABLE_ROLES: Role[] = ["admin", "dev", "viewer", "compliance-auditor"];

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("dev");
  const [inviting, setInviting] = useState(false);
  
  // Role dropdown state
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  // Mock organization ID - in real app, get from context/auth
  const organizationId = "org_demo_123";

  useEffect(() => {
    fetchTeamData();
  }, []);

  async function fetchTeamData() {
    setLoading(true);
    try {
      const response = await fetch(`/api/team/${organizationId}/members`);
      if (!response.ok) throw new Error("Failed to fetch team data");
      
      const data = await response.json();
      setMembers(data.members);
      setSeatInfo(data.seatInfo);
      
      const inviteResponse = await fetch(`/api/team/${organizationId}/invitations`);
      if (inviteResponse.ok) {
        const inviteData = await inviteResponse.json();
        setInvitations(inviteData.invitations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    
    try {
      const response = await fetch(`/api/team/${organizationId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to send invitation");
      }
      
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("dev");
      fetchTeamData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: Role) {
    setUpdatingRole(memberId);
    try {
      const response = await fetch(`/api/team/${organizationId}/members/${memberId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update role");
      }
      
      setMembers(members.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdatingRole(null);
      setOpenRoleDropdown(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Are you sure you want to remove this member?")) return;
    
    try {
      const response = await fetch(`/api/team/${organizationId}/members/${memberId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to remove member");
      }
      
      setMembers(members.filter(m => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    try {
      const response = await fetch(`/api/team/${organizationId}/invitations/${invitationId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Failed to revoke invitation");
      
      setInvitations(invitations.filter(i => i.id !== invitationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invitation");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            Team Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage team members and their roles
          </p>
        </div>
        
        {seatInfo && (
          <div className="text-right">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Seats: {seatInfo.current} / {seatInfo.max}
            </div>
            <div className="text-xs text-gray-500 capitalize">{seatInfo.tier} tier</div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Invite Button */}
      <button
        onClick={() => setShowInviteModal(true)}
        disabled={seatInfo ? seatInfo.current >= seatInfo.max : false}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Plus className="w-4 h-4" />
        Invite Member
      </button>

      {/* Members Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {members.map((member) => {
            const roleConfig = ROLE_CONFIG[member.role];
            const RoleIcon = roleConfig.icon;
            
            return (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                      {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {member.name || "Unnamed"}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{member.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Role Badge / Dropdown */}
                  <div className="relative">
                    {member.role === "owner" ? (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 ${roleConfig.color}`}>
                        <RoleIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">{roleConfig.label}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setOpenRoleDropdown(openRoleDropdown === member.id ? null : member.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${roleConfig.color}`}
                        disabled={updatingRole === member.id}
                      >
                        {updatingRole === member.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RoleIcon className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">{roleConfig.label}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                    
                    {/* Role Dropdown */}
                    {openRoleDropdown === member.id && member.role !== "owner" && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                        {ASSIGNABLE_ROLES.map((role) => {
                          const config = ROLE_CONFIG[role];
                          const Icon = config.icon;
                          return (
                            <button
                              key={role}
                              onClick={() => handleRoleChange(member.id, role)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                            >
                              <Icon className={`w-4 h-4 ${config.color}`} />
                              <div className="text-left">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {config.label}
                                </div>
                                <div className="text-xs text-gray-500">{config.description}</div>
                              </div>
                              {member.role === role && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Remove Button */}
                  {member.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Invitations</h2>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {invitations.map((invitation) => {
              const roleConfig = ROLE_CONFIG[invitation.role];
              const RoleIcon = roleConfig.icon;
              
              return (
                <div key={invitation.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{invitation.email}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 ${roleConfig.color}`}>
                      <RoleIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{roleConfig.label}</span>
                    </div>
                    
                    <button
                      onClick={() => handleRevokeInvitation(invitation.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Revoke invitation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Invite Team Member
            </h3>
            
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <div className="space-y-2">
                  {ASSIGNABLE_ROLES.map((role) => {
                    const config = ROLE_CONFIG[role];
                    const Icon = config.icon;
                    return (
                      <label
                        key={role}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          inviteRole === role
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role}
                          checked={inviteRole === role}
                          onChange={() => setInviteRole(role)}
                          className="sr-only"
                        />
                        <Icon className={`w-5 h-5 ${config.color}`} />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {config.label}
                          </div>
                          <div className="text-xs text-gray-500">{config.description}</div>
                        </div>
                        {inviteRole === role && <Check className="w-4 h-4 text-blue-500 ml-auto" />}
                      </label>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
