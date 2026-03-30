"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import Link from "next/link";
import React from "react";

interface TableOfContentsItem {
  id: string;
  title: string;
}

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  version: string;
  children: React.ReactNode;
  tableOfContents: TableOfContentsItem[];
}

export function LegalPageLayout({
  title,
  lastUpdated,
  version,
  children,
  tableOfContents,
}: LegalPageLayoutProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to Home</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              className="text-muted-foreground hover:text-foreground print:hidden"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-12 print:py-4">
        <div className="mx-auto max-w-4xl">
          {/* Title Section */}
          <div className="mb-12 print:mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight print:text-2xl">
                {title}
              </h1>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>
                <strong>Last Updated:</strong> {lastUpdated}
              </span>
              <span>
                <strong>Version:</strong> {version}
              </span>
            </div>
          </div>

          {/* Table of Contents */}
          <nav className="mb-12 p-6 rounded-lg border border-border bg-card print:border-gray-300 print:mb-6">
            <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
            <ol className="grid gap-2 sm:grid-cols-2">
              {tableOfContents.map((item, index) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-start gap-2"
                  >
                    <span className="text-primary font-medium">
                      {(index + 1).toString().padStart(2, "0")}.
                    </span>
                    <span>{item.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Content */}
          <div className="prose prose-invert prose-sm max-w-none print:prose-gray">
            {children}
          </div>

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-border print:mt-8 print:pt-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4 text-sm text-muted-foreground">
              <div>
                <p>
                  © {new Date().getFullYear()} guardrail, Inc. All rights
                  reserved.
                </p>
              </div>
              <div className="flex gap-4">
                <Link
                  href="/legal/privacy"
                  className="hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/legal/terms"
                  className="hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
                <Link
                  href="mailto:legal@guardrail.dev"
                  className="hover:text-primary transition-colors"
                >
                  Contact Legal
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </main>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          header {
            position: relative !important;
            background: white !important;
            border-color: #e5e5e5 !important;
          }
          a {
            color: inherit !important;
            text-decoration: underline !important;
          }
        }
      `}</style>
    </div>
  );
}

interface LegalSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
        <span className="w-1 h-6 bg-primary rounded-full" />
        {title}
      </h2>
      <div className="text-muted-foreground leading-relaxed space-y-4">
        {children}
      </div>
    </section>
  );
}

interface LegalListProps {
  items: string[];
}

export function LegalList({ items }: LegalListProps) {
  return (
    <ul className="space-y-2 ml-4">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <span className="text-primary mt-1.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

interface LegalHighlightProps {
  children: React.ReactNode;
  variant?: "info" | "warning" | "important";
}

export function LegalHighlight({
  children,
  variant = "info",
}: LegalHighlightProps) {
  const variants = {
    info: "border-primary/30 bg-primary/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    important: "border-red-500/30 bg-red-500/5",
  };

  return (
    <div className={cn("p-4 rounded-lg border", variants[variant])}>
      {children}
    </div>
  );
}
