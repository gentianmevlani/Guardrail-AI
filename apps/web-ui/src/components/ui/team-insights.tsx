"use client";

import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Shield,
  Award,
  Clock,
  GitPullRequest,
  AlertTriangle,
  CheckCircle,
  Crown,
  Flame,
  Loader2,
} from "lucide-react";
import { SecurityScoreRing } from "./security-score-ring";
import {
  getTeamStats,
  type TeamStats as APITeamStats,
} from "@/lib/guardrails-api";

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  role: "admin" | "developer" | "reviewer";
  securityScore: number;
  scoreChange: number;
  validationsToday: number;
  issuesFixed: number;
  streak: number;
}

interface TeamStats {
  totalMembers: number;
  avgScore: number;
  totalValidations: number;
  issuesBlocked: number;
  topContributor: TeamMember;
}

const DEMO_TEAM: TeamMember[] = [
  {
    id: "1",
    name: "Sarah Chen",
    role: "admin",
    securityScore: 96,
    scoreChange: 3,
    validationsToday: 24,
    issuesFixed: 8,
    streak: 12,
  },
  {
    id: "2",
    name: "Alex Rivera",
    role: "developer",
    securityScore: 92,
    scoreChange: -2,
    validationsToday: 18,
    issuesFixed: 5,
    streak: 7,
  },
  {
    id: "3",
    name: "Jordan Kim",
    role: "developer",
    securityScore: 88,
    scoreChange: 5,
    validationsToday: 31,
    issuesFixed: 12,
    streak: 3,
  },
  {
    id: "4",
    name: "Casey Morgan",
    role: "reviewer",
    securityScore: 94,
    scoreChange: 1,
    validationsToday: 15,
    issuesFixed: 6,
    streak: 9,
  },
  {
    id: "5",
    name: "Taylor Swift",
    role: "developer",
    securityScore: 85,
    scoreChange: 8,
    validationsToday: 22,
    issuesFixed: 4,
    streak: 2,
  },
];

interface TeamInsightsProps {
  members?: TeamMember[];
  showLeaderboard?: boolean;
  useRealData?: boolean;
}

export function TeamInsights({
  members: initialMembers = DEMO_TEAM,
  showLeaderboard = true,
  useRealData = true,
}: TeamInsightsProps) {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(useRealData);
  const [apiStats, setApiStats] = useState<APITeamStats | null>(null);
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);

  // Fetch real team stats from API
  useEffect(() => {
    if (!useRealData) return;

    async function loadTeamStats() {
      try {
        const stats = await getTeamStats();
        if (stats) {
          setApiStats(stats);
          // Map API leaderboard to TeamMember format
          if (stats.leaderboard && stats.leaderboard.length > 0) {
            const mappedMembers: TeamMember[] = stats.leaderboard.map(
              (s, i) => ({
                id: s.userId,
                name: `User ${s.userId.slice(0, 8)}`,
                role: i === 0 ? ("admin" as const) : ("developer" as const),
                securityScore: s.securityScore,
                scoreChange: 0,
                validationsToday: s.totalValidations,
                issuesFixed: s.issuesFixed,
                streak: s.streak,
              }),
            );
            setMembers(mappedMembers.length > 0 ? mappedMembers : DEMO_TEAM);
          }
        }
      } catch (error) {
        logger.debug('Failed to load team stats, using demo data');
      } finally {
        setLoading(false);
      }
    }

    loadTeamStats();
  }, [useRealData]);

  // Sort by security score for leaderboard
  const leaderboard = [...members].sort(
    (a, b) => b.securityScore - a.securityScore,
  );
  const topPerformer = leaderboard[0];

  // Use API stats if available, otherwise calculate from members
  const stats: TeamStats = apiStats
    ? {
        totalMembers: apiStats.totalMembers,
        avgScore: apiStats.avgScore,
        totalValidations: apiStats.totalValidations,
        issuesBlocked: apiStats.issuesBlocked,
        topContributor: topPerformer,
      }
    : {
        totalMembers: members.length,
        avgScore: Math.round(
          members.reduce((a, m) => a + m.securityScore, 0) / members.length,
        ),
        totalValidations: members.reduce((a, m) => a + m.validationsToday, 0),
        issuesBlocked: members.reduce((a, m) => a + m.issuesFixed, 0),
        topContributor: topPerformer,
      };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const getRoleColor = (role: TeamMember["role"]) => {
    switch (role) {
      case "admin":
        return "text-purple-400 bg-purple-500/20";
      case "reviewer":
        return "text-blue-400 bg-blue-500/20";
      default:
        return "text-zinc-400 bg-zinc-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Team Members", value: stats.totalMembers, icon: Users },
          { label: "Avg Score", value: `${stats.avgScore}%`, icon: Shield },
          {
            label: "Validations Today",
            value: stats.totalValidations,
            icon: CheckCircle,
          },
          {
            label: "Issues Blocked",
            value: stats.issuesBlocked,
            icon: AlertTriangle,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800"
          >
            <div className="flex items-center gap-2 text-zinc-500 mb-1">
              <stat.icon className="h-4 w-4" />
              <span className="text-xs">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Leaderboard */}
      {showLeaderboard && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            <h3 className="font-medium text-white">Security Leaderboard</h3>
          </div>

          <div className="space-y-2">
            {leaderboard.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() =>
                  setSelectedMember(
                    selectedMember?.id === member.id ? null : member,
                  )
                }
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedMember?.id === member.id
                    ? "bg-zinc-800 border-blue-500/50"
                    : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0
                        ? "bg-amber-500/20 text-amber-400"
                        : index === 1
                          ? "bg-zinc-400/20 text-zinc-300"
                          : index === 2
                            ? "bg-orange-600/20 text-orange-400"
                            : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {index === 0 ? <Crown className="h-4 w-4" /> : index + 1}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">
                        {member.name}
                      </span>
                      {member.streak >= 7 && (
                        <div className="flex items-center gap-1 text-orange-400">
                          <Flame className="h-3 w-3" />
                          <span className="text-xs">{member.streak}d</span>
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(member.role)}`}
                    >
                      {member.role}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">
                        {member.securityScore}
                      </span>
                      <div
                        className={`flex items-center text-xs ${
                          member.scoreChange > 0
                            ? "text-emerald-400"
                            : member.scoreChange < 0
                              ? "text-red-400"
                              : "text-zinc-500"
                        }`}
                      >
                        {member.scoreChange > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : member.scoreChange < 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : null}
                        {member.scoreChange !== 0 &&
                          Math.abs(member.scoreChange)}
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {member.validationsToday} validations
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {selectedMember?.id === member.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 mt-4 border-t border-zinc-800 grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-white">
                            {member.issuesFixed}
                          </p>
                          <p className="text-xs text-zinc-500">Issues Fixed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-white">
                            {member.streak}
                          </p>
                          <p className="text-xs text-zinc-500">Day Streak</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-white">
                            {member.validationsToday}
                          </p>
                          <p className="text-xs text-zinc-500">Today</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Shared Rules component
interface SharedRule {
  id: string;
  name: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  category: string;
}

const SHARED_RULES: SharedRule[] = [
  {
    id: "1",
    name: "AWS Security Best Practices",
    description: "Comprehensive AWS security guardrails",
    author: "AWS Community",
    downloads: 12400,
    rating: 4.9,
    category: "cloud",
  },
  {
    id: "2",
    name: "React Security Bundle",
    description: "Protect React apps from XSS and injection",
    author: "React Security Team",
    downloads: 8900,
    rating: 4.8,
    category: "frontend",
  },
  {
    id: "3",
    name: "API Security Standards",
    description: "REST API security validation rules",
    author: "OWASP",
    downloads: 15200,
    rating: 4.7,
    category: "api",
  },
  {
    id: "4",
    name: "Database Safety Net",
    description: "SQL injection and data exposure prevention",
    author: "DataGuard",
    downloads: 6700,
    rating: 4.6,
    category: "database",
  },
];

export function SharedRulesMarketplace() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white">Community Rules</h3>
        <span className="text-xs text-zinc-500">
          {SHARED_RULES.length} available
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {SHARED_RULES.map((rule, i) => (
          <motion.div
            key={rule.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-white truncate">{rule.name}</h4>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                  {rule.description}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-zinc-600">
                    by {rule.author}
                  </span>
                  <span className="text-xs text-zinc-600">•</span>
                  <span className="text-xs text-zinc-600">
                    {rule.downloads.toLocaleString()} installs
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-amber-400 text-sm">
                <span>★</span>
                <span>{rule.rating}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
