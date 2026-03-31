import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { SkipLinks } from "@/components/accessibility/SkipLinks";
import { ErrorHandlerProvider } from "@/components/providers/ErrorHandlerProvider";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Let Next.js decide static vs dynamic per-page.
// force-dynamic on the root layout made every route SSR through Netlify Functions,
// causing cold-start timeouts and blank pages in production.

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "guardrail - CI Truth for AI-Generated Code",
  description:
    "Prove your app is real before you ship. Catch fake features, broken auth, exposed secrets, and mock data in AI-generated code.",
  keywords: [
    "AI code verification",
    "CI/CD",
    "code quality",
    "security scanning",
    "mock detection",
    "vibe coding",
    "AI guardrails",
  ],
  authors: [{ name: "guardrail Team", url: "https://guardrail.dev" }],
  creator: "guardrail",
  publisher: "guardrail",
  icons: {
    icon: [
      { url: "/guardrail-logo.png", sizes: "32x32", type: "image/png" },
      { url: "/guardrail-logo.svg", type: "image/svg+xml" },
    ],
    apple: "/guardrail-logo.png",
  },
  metadataBase: new URL("https://guardrail.dev"),
  openGraph: {
    title: "guardrail - CI Truth for AI-Generated Code",
    description:
      "Prove your app is real before you ship. Catch fake features, broken auth, exposed secrets, and mock data in AI-generated code.",
    url: "https://guardrail.dev",
    siteName: "guardrail",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "guardrail - CI Truth for AI-Generated Code",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "guardrail - CI Truth for AI-Generated Code",
    description:
      "Prove your app is real before you ship. Catch fake features, broken auth, exposed secrets, and mock data.",
    site: "@getguardrail",
    creator: "@getguardrail",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://guardrail.dev",
  },
  other: {
    "github:repo": "https://github.com/guardrail-Official/guardrail",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className={cn(
          inter.variable,
          spaceGrotesk.variable,
          "min-h-screen bg-background font-sans antialiased",
        )}
        style={{
          minHeight: "100vh",
          backgroundColor: "hsl(220, 13%, 5%)",
          color: "hsl(180, 5%, 96%)",
        }}
      >
        {/* Analytics: must live in body in App Router — manual <head> can break Next head merging */}
        <GoogleAnalytics />
        <MetaPixel />
        <SkipLinks />
        <ErrorHandlerProvider>{children}</ErrorHandlerProvider>
      </body>
    </html>
  );
}
