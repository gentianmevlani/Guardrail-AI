import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Guardrails for Code Safety - Stop AI Hallucinations",
  description:
    "guardrail catches AI-generated code issues: hallucinated imports, mock data in production, fake success patterns, and missing auth checks. Validate AI code before it ships.",
  keywords: [
    "ai guardrails",
    "ai code safety",
    "ai hallucinations",
    "copilot guardrails",
    "cursor ai safety",
    "chatgpt code validation",
    "ai generated code",
    "production readiness",
    "mock data detection",
  ],
  openGraph: {
    title: "AI Guardrails for Code Safety",
    description:
      "Stop AI-generated code from lying to you. Catch hallucinated imports, mock data, and fake success patterns.",
    url: "https://guardrailai.dev/ai-guardrails",
    siteName: "guardrail",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Guardrails for Code Safety",
    description: "Stop AI-generated code from lying to you.",
  },
  alternates: {
    canonical: "https://guardrailai.dev/ai-guardrails",
  },
};

export default function AIGuardrailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
