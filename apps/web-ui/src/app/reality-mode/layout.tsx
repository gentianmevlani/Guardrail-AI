import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reality Mode - Browser Testing That Proves Your App Works",
  description:
    "Reality Mode uses Playwright to actually click your UI, fill forms, and catch buttons that do nothing. Zero-config browser testing with video recording and CI integration.",
  keywords: [
    "reality mode",
    "browser testing",
    "playwright testing",
    "e2e testing",
    "automated testing",
    "ui testing",
    "production testing",
    "fake success detection",
    "mock data detection",
  ],
  openGraph: {
    title: "Reality Mode - Browser Testing That Proves Your App Works",
    description:
      "Uses Playwright to actually click your UI and catch buttons that do nothing.",
    url: "https://guardrailai.dev/reality-mode",
    siteName: "guardrail",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reality Mode - Browser Testing That Proves Your App Works",
    description:
      "Uses Playwright to actually click your UI and catch buttons that do nothing.",
  },
  alternates: {
    canonical: "https://guardrailai.dev/reality-mode",
  },
};

export default function RealityModeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
