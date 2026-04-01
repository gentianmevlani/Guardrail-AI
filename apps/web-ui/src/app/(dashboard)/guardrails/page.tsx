"use client";

import { AIExplainabilityCard } from "@/components/ui/ai-explainability-card";
import { Badge } from "@/components/ui/badge";
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
  getPresets,
  getUserStats,
  togglePreset as togglePresetAPI,
  type PresetGuardrail,
  type UserStats,
  type ValidationFinding,
} from "@/lib/guardrails-api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Code,
  Loader2,
  Lock,
  Play,
  Settings2,
  Shield,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function GuardrailsPage() {
  const [presets, setPresets] = useState<PresetGuardrail[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [validationFindings, setValidationFindings] = useState<
    ValidationFinding[]
  >([]);
  const [lastValidationScore, setLastValidationScore] = useState<number | null>(
    null,
  );

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        setPresetsLoading(true);
        setPresetsError(null);

        const [presetsData, statsData] = await Promise.all([
          getPresets(),
          getUserStats(),
        ]);

        if (presetsData) setPresets(presetsData);
        if (statsData) setStats(statsData);
      } catch (error) {
        logger.error("Failed to load guardrails data:", { error: error instanceof Error ? error.message : String(error) });
        setPresetsError("Failed to load guardrails data");
      } finally {
        setPresetsLoading(false);
      }
    }
    loadData();
  }, []);

  const togglePreset = async (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    const newEnabledState = !preset.enabled;
    setPresets((prev) =>
      prev.map((p) =>
        p.id === presetId ? { ...p, enabled: newEnabledState } : p,
      ),
    );

    try {
      await togglePresetAPI(presetId, newEnabledState);
    } catch (error) {
      logger.error("Failed to toggle preset:", { error: error instanceof Error ? error.message : String(error) });
      // Revert on error
      setPresets((prev) =>
        prev.map((p) =>
          p.id === presetId ? { ...p, enabled: !newEnabledState } : p,
        ),
      );
    }
  };

  const handleValidationComplete = (result: {
    passed: boolean;
    score: number;
    findings?: Array<{
      id?: string;
      rule?: string;
      severity?: string;
      message?: string;
      type?: string;
      title?: string;
      description?: string;
      code?: string;
      suggestedFix?: string;
      confidence?: number;
      ruleId?: string;
    }>;
  }) => {
    setLastValidationScore(result.score);
    if (result.findings) {
      setValidationFindings(
        result.findings.map((f, idx) => ({
          id: f.id || `finding-${idx}`,
          type: (f.type as "error" | "warning" | "info") || "warning",
          title: f.title || f.message || "Finding",
          description: f.description || f.message || "",
          codeSnippet: f.code
            ? {
                before: f.code,
                language: "typescript",
              }
            : undefined,
          explanation: f.description || f.message,
          confidence: f.confidence || 0.8,
          ruleId: f.ruleId || f.rule || "unknown",
        })),
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Guardrails</h1>
          <p className="text-muted-foreground">
            AI-powered code quality and security enforcement
          </p>
        </div>
        {stats && (
          <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">
            {Object.keys(stats).length} Rules Active
          </Badge>
        )}
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardContent className="pt-6">
              <SecurityScoreRing
                score={Math.round((Object.keys(stats).length / 10) * 100)}
                size="lg"
              />
              <div className="text-center mt-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {Object.keys(stats).length}/10
                </h3>
                <p className="text-sm text-muted-foreground">
                  Rules Passing
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-center">
                <Shield className="w-12 h-12 mx-auto text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">
                  85%
                </h3>
                <p className="text-sm text-muted-foreground">
                  Security Score
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-center">
                <Brain className="w-12 h-12 mx-auto text-purple-400 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">
                  92%
                </h3>
                <p className="text-sm text-muted-foreground">
                  Quality Score
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preset Guardrails */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-400" />
            <CardTitle className="text-white">Preset Guardrails</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Pre-configured rule sets for common security and quality standards
          </CardDescription>
        </CardHeader>
        <CardContent>
          {presetsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted/20 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : presetsError ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 mx-auto text-red-400 mb-4" />
              <p className="text-red-400">Failed to load presets</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {presets.map((preset) => (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-lg",
                    preset.enabled
                      ? "bg-emerald-950/20 border-emerald-500/20"
                      : "bg-card/50 border border-border opacity-60"
                  )}
                  onClick={() => togglePreset(preset.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">
                        {preset.name}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {preset.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge
                          variant="outline"
                          className={
                            preset.category === "security"
                              ? "border-red-500/50 text-red-400"
                              : preset.category === "quality"
                              ? "border-blue-500/50 text-blue-400"
                              : "border-purple-500/50 text-purple-400"
                          }
                        >
                          {preset.category}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-blue-600/50 text-blue-500"
                        >
                          enabled
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          preset.enabled
                            ? "bg-emerald-500"
                            : "bg-gray-600"
                        }`}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Findings */}
      {validationFindings.length > 0 && (
        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-white">Validation Results</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              AI-powered analysis of your code with detailed explanations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AIExplainabilityCard
              findings={validationFindings.map((f) => ({
                id: f.id,
                type: f.type as "error" | "warning" | "info" | "success",
                title: f.title,
                description: f.description,
                codeSnippet: f.codeSnippet,
                explanation: f.explanation || "No explanation available",
                confidence: f.confidence,
                ruleId: f.ruleId,
              }))}
              overallScore={lastValidationScore || 0}
            />
          </CardContent>
        </Card>
      )}

      {/* Custom Rules */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-pink-400" />
            <CardTitle className="text-white">Custom Guardrails</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Create your own rules using natural language - no regex required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NaturalLanguageRules />
        </CardContent>
      </Card>
    </div>
  );
}