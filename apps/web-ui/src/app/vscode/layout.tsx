import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "guardrail for VS Code - Production Readiness Extension",
  description:
    "Stop AI-generated code from lying to you. Inline diagnostics, score badge, and CI integration inside VS Code. Catches mock data, hardcoded secrets, and hallucinated imports.",
  keywords: [
    "guardrail vscode",
    "vscode extension",
    "ai code safety",
    "production readiness",
    "mock detection",
    "secrets detection",
    "code analysis",
    "ai guardrails",
  ],
  openGraph: {
    title: "guardrail for VS Code",
    description:
      "Stop AI-generated code from lying to you. Inline diagnostics and score badge inside VS Code.",
    url: "https://guardrail.dev/vscode",
    siteName: "guardrail",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "guardrail for VS Code",
    description: "Stop AI-generated code from lying to you.",
  },
  alternates: {
    canonical: "https://guardrail.dev/vscode",
  },
};

export default function VSCodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
