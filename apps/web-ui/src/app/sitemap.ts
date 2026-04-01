import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://guardrailai.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Public marketing pages (high priority)
  const publicPages = [
    { url: "", priority: 1.0, changeFrequency: "weekly" as const },
    {
      url: "/ai-guardrails",
      priority: 0.9,
      changeFrequency: "weekly" as const,
    },
    { url: "/blog", priority: 0.8, changeFrequency: "daily" as const },
    { url: "/checkout", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/analytics", priority: 0.7, changeFrequency: "monthly" as const },
  ];

  // Comparison pages (SEO landing pages)
  const comparisonPages = [
    "/compare/ci-tools-miss-mock-data",
    "/compare/eslint-ci-passed-prod-failed",
    "/compare/github-actions-prod-readiness-gate",
    "/compare/jest-tests-mock-data-production",
    "/compare/owasp-dependency-check-runtime-truth",
    "/compare/snyk-vs-reality-gates",
    "/compare/sonarqube-mock-data-production",
  ];

  // Glossary pages (educational content)
  const glossaryPages = [
    "/glossary/ai-code-hallucination",
    "/glossary/mock-data-production",
  ];

  // Guide pages
  const guidePages = ["/guides/ai-hallucinated-code-detection"];

  // Build sitemap entries
  const entries: MetadataRoute.Sitemap = [];

  // Add public pages
  for (const page of publicPages) {
    entries.push({
      url: `${BASE_URL}${page.url}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }

  // Add comparison pages (medium-high priority for SEO)
  for (const path of comparisonPages) {
    entries.push({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  // Add glossary pages
  for (const path of glossaryPages) {
    entries.push({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // Add guide pages
  for (const path of guidePages) {
    entries.push({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return entries;
}
