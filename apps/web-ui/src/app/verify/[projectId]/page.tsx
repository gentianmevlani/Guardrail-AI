"use client";

import { useParams } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  Shield,
  Calendar,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function VerifyPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) || "unknown";
  const [copied, setCopied] = useState<string | null>(null);

  // In production, this would fetch from API
  // For demo, generate mock data based on projectId
  const certification = generateMockCertification(projectId);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Guardrail Certification
            </h1>
            <p className="text-slate-400">
              Verification for project:{" "}
              <code className="text-cyan-400">{projectId}</code>
            </p>
          </div>

          {/* Certification Card */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden mb-8">
            {/* Status Banner */}
            <div
              className={`px-6 py-4 ${
                certification.certified
                  ? "bg-green-500/20 border-b border-green-500/30"
                  : "bg-yellow-500/20 border-b border-yellow-500/30"
              }`}
            >
              <div className="flex items-center gap-3">
                {certification.certified ? (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-yellow-400" />
                )}
                <span
                  className={`text-lg font-semibold ${
                    certification.certified
                      ? "text-green-400"
                      : "text-yellow-400"
                  }`}
                >
                  {certification.certified ? "CERTIFIED" : "NOT CERTIFIED"}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Score</span>
                <span className="text-2xl font-bold text-white">
                  {certification.score}/100
                  <span className="text-sm text-slate-400 ml-2">
                    ({certification.grade})
                  </span>
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Certified Date</span>
                <span className="text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  {new Date(certification.timestamp).toLocaleDateString()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Expires</span>
                <span className="text-white">
                  {new Date(certification.expiresAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Project ID</span>
                <code className="text-cyan-400 text-sm">
                  {certification.projectId}
                </code>
              </div>
            </div>
          </div>

          {/* Badge Embed Codes */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Embed Badge
            </h2>

            <div className="space-y-4">
              {/* Markdown */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  Markdown (README.md)
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-900 rounded px-3 py-2 text-sm text-green-400 overflow-x-auto">
                    {certification.badges.markdown}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(certification.badges.markdown, "md")
                    }
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                  >
                    {copied === "md" ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* HTML */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  HTML
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-900 rounded px-3 py-2 text-sm text-green-400 overflow-x-auto">
                    {certification.badges.html}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(certification.badges.html, "html")
                    }
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                  >
                    {copied === "html" ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-slate-400 mb-4">Want to certify your project?</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/vscode"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
              >
                <Shield className="w-5 h-5" />
                Get Guardrail
              </Link>
              <a
                href="https://github.com/guardrail-ai/guardrail-vscode"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-800">
        <div className="container mx-auto px-4 text-center text-slate-400 text-sm">
          © 2026 Guardrail. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

// Generate mock certification data for demo
function generateMockCertification(projectId: string) {
  // Generate deterministic score from projectId
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash << 5) - hash + projectId.charCodeAt(i);
    hash = hash & hash;
  }
  const score = 70 + (Math.abs(hash) % 30); // Score between 70-99

  const grade =
    score >= 95
      ? "A+"
      : score >= 90
        ? "A"
        : score >= 85
          ? "A-"
          : score >= 80
            ? "B+"
            : score >= 75
              ? "B"
              : "B-";

  const verifyUrl = `https://getguardrail.io/verify/${projectId}`;

  return {
    certified: score >= 70,
    score,
    grade,
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    expiresAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(), // 23 days from now
    projectId,
    verifyUrl,
    badges: {
      markdown: `[![Guardrail Certified](${verifyUrl}/badge.svg)](${verifyUrl})`,
      html: `<a href="${verifyUrl}"><img src="${verifyUrl}/badge.svg" alt="Guardrail Certified: ${score}/100" /></a>`,
    },
  };
}
