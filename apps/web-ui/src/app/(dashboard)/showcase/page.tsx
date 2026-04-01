"use client";

import {
  AchievementGrid,
  ACHIEVEMENTS,
  type Achievement,
} from "@/components/ui/achievement-badge";
import { AIExplainabilityCard } from "@/components/ui/ai-explainability-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LiveValidationStream } from "@/components/ui/live-validation-stream";
import { NaturalLanguageRules } from "@/components/ui/natural-language-rules";
import { SecurityScoreRing } from "@/components/ui/security-score-ring";
import {
  getAchievements,
  getRules,
  getUserStats,
  validateCode,
  type GuardrailRule,
  type UserStats,
  type ValidationFinding,
} from "@/lib/guardrails-api";
import { logger } from "@/lib/logger";
import { motion } from "framer-motion";
import {
  Brain,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Trophy,
  Wand2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function ShowcasePage() {
  const [isValidating, setIsValidating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [rules, setRules] = useState<GuardrailRule[]>([]);
  const [validationFindings, setValidationFindings] = useState<
    ValidationFinding[]
  >([]);
  const [testCode] = useState(`// Sample code for validation demo
const apiKey = "sk-1234567890abcdef";
const query = \`SELECT * FROM users WHERE id = \${userId}\`;
// Removed console.log in production code
`);

  // Load real data from API
  useEffect(() => {
    async function loadData() {
      try {
        const [userStats, apiAchievements, apiRules] = await Promise.all([
          getUserStats(),
          getAchievements(),
          getRules(),
        ]);

        if (userStats) {
          setStats(userStats);
          setPreviousScore(userStats.securityScore);
        }

        // Map API achievements to component format
        if (apiAchievements.length > 0) {
          const mappedAchievements: Achievement[] = apiAchievements.map((a) => {
            const def =
              ACHIEVEMENTS.find((d) => d.id === a.id) || ACHIEVEMENTS[0];
            return {
              ...def,
              id: a.id,
              name: a.name,
              description: a.description,
              unlockedAt:
                a.unlocked && a.unlockedAt ? new Date(a.unlockedAt) : undefined,
              progress: a.progress,
              maxProgress: a.maxProgress,
            };
          });
          setAchievements(mappedAchievements);
        } else {
          // Use default achievements if none from API
          setAchievements(ACHIEVEMENTS.map((a) => ({ ...a, progress: 0 })));
        }

        if (apiRules.length > 0) {
          setRules(apiRules);
        }
      } catch (error) {
        logger.logUnknownError("Failed to load showcase data", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const runValidation = async () => {
    setIsValidating(true);
    setValidationFindings([]);

    try {
      const result = await validateCode(testCode, "typescript");

      // Update stats with new score
      if (stats) {
        setPreviousScore(stats.securityScore);
      }

      // Refresh stats after validation
      const newStats = await getUserStats();
      if (newStats) {
        setStats(newStats);
      }

      // Set findings for display
      if (result.findings) {
        setValidationFindings(result.findings);
      }

      // Check for new achievements
      if (result.newAchievements && result.newAchievements.length > 0) {
        const refreshedAchievements = await getAchievements();
        if (refreshedAchievements.length > 0) {
          const mappedAchievements: Achievement[] = refreshedAchievements.map(
            (a) => {
              const def =
                ACHIEVEMENTS.find((d) => d.id === a.id) || ACHIEVEMENTS[0];
              return {
                ...def,
                id: a.id,
                name: a.name,
                description: a.description,
                unlockedAt:
                  a.unlocked && a.unlockedAt
                    ? new Date(a.unlockedAt)
                    : undefined,
                progress: a.progress,
                maxProgress: a.maxProgress,
              };
            },
          );
          setAchievements(mappedAchievements);
        }
      }
    } catch (error) {
      logger.logUnknownError("Validation failed", error);
    } finally {
      setIsValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-white/10 p-8"
      >
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                guardrail AI Showcase
              </h1>
              <p className="text-muted-foreground">
                World-class AI code guardrails, visualized
              </p>
            </div>
          </div>
          <p className="text-foreground/80 max-w-2xl">
            Experience the next generation of AI-powered code security.
            Real-time validation, intelligent explanations, gamification, and
            natural language rule configuration.
          </p>
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Security Score Ring */}
        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-white">Security Score</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Animated real-time security health indicator
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-6">
            {stats ? (
              <SecurityScoreRing
                score={stats.securityScore}
                previousScore={previousScore || undefined}
                size="xl"
                streak={stats.streak || 0}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[220px]">
                <div className="w-[220px] h-[220px] rounded-full border-[12px] border-muted flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-3xl font-bold text-muted-foreground">
                      N/A
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      No data yet
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Button
              onClick={runValidation}
              disabled={isValidating}
              variant="outline"
              className="mt-6 border text-foreground/80"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isValidating ? "animate-spin" : ""}`}
              />
              {isValidating ? "Validating..." : "Run Validation"}
            </Button>
          </CardContent>
        </Card>

        {/* Live Validation Stream */}
        <Card className="lg:col-span-2 bg-card/40 border backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                <CardTitle className="text-white">
                  Live Validation Stream
                </CardTitle>
              </div>
              <Button
                onClick={runValidation}
                disabled={isValidating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Run Validation
              </Button>
            </div>
            <CardDescription className="text-muted-foreground">
              Watch AI validate code through our 6-stage pipeline in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveValidationStream
              isValidating={isValidating}
              onComplete={() => {
                // Validation complete
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* AI Explainability */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-white">AI Explainability</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Understand exactly WHY something was flagged with detailed AI
            explanations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AIExplainabilityCard
            findings={validationFindings.map((f) => ({
              id: f.id,
              type: f.type as "error" | "warning" | "info" | "success",
              title: f.title,
              description: f.description,
              codeSnippet: f.code
                ? {
                    before: f.code,
                    after: f.suggestedFix,
                    language: "typescript",
                  }
                : undefined,
              explanation: f.description,
              confidence: f.confidence,
            }))}
            overallScore={stats?.securityScore ?? 0}
          />
        </CardContent>
      </Card>

      {/* Natural Language Rules */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-pink-400" />
            <CardTitle className="text-white">
              Natural Language Guardrails
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Configure security rules in plain English - no regex required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NaturalLanguageRules rules={rules.length > 0 ? rules : undefined} />
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <CardTitle className="text-white">
              Achievements & Gamification
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Make security fun with badges, streaks, and achievements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AchievementGrid achievements={achievements} columns={5} />
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Shield,
            title: "6-Stage Pipeline",
            desc: "Comprehensive validation",
            color: "text-blue-400",
          },
          {
            icon: Brain,
            title: "AI Explainability",
            desc: "Understand every flag",
            color: "text-purple-400",
          },
          {
            icon: Wand2,
            title: "NL Configuration",
            desc: "Plain English rules",
            color: "text-pink-400",
          },
          {
            icon: Trophy,
            title: "Gamification",
            desc: "Make security fun",
            color: "text-amber-400",
          },
        ].map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl bg-card/50 border hover:border-primary/30 transition-colors"
          >
            <feature.icon className={`h-8 w-8 ${feature.color} mb-3`} />
            <h3 className="font-semibold text-white">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
