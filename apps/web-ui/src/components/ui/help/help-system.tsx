"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Book,
  ChevronRight,
  Code,
  FileText,
  HelpCircle,
  Keyboard,
  Lightbulb,
  MessageCircle,
  Search,
  Video,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

// Help System Types
interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  relatedArticles?: string[];
  videoUrl?: string;
  codeExample?: string;
}

interface HelpCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  articles: string[];
}

// Help Context
interface HelpContextType {
  isOpen: boolean;
  openHelp: (articleId?: string) => void;
  closeHelp: () => void;
  currentArticle: HelpArticle | null;
  searchArticles: (query: string) => HelpArticle[];
  getRelatedArticles: (articleId: string) => HelpArticle[];
}

const HelpContext = React.createContext<HelpContextType | null>(null);

// Sample help data
const helpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    name: "Getting Started",
    icon: <Zap className="w-4 h-4" />,
    description: "Learn the basics of guardrail",
    articles: ["first-scan", "connecting-github", "understanding-results"],
  },
  {
    id: "features",
    name: "Features",
    icon: <Lightbulb className="w-4 h-4" />,
    description: "Explore guardrail features",
    articles: ["reality-mode", "ai-analysis", "compliance-checks"],
  },
  {
    id: "troubleshooting",
    name: "Troubleshooting",
    icon: <HelpCircle className="w-4 h-4" />,
    description: "Common issues and solutions",
    articles: ["scan-failures", "connection-issues", "permission-errors"],
  },
  {
    id: "api",
    name: "API & CLI",
    icon: <Code className="w-4 h-4" />,
    description: "Developer documentation",
    articles: ["api-reference", "cli-commands", "webhooks"],
  },
];

const helpArticles: HelpArticle[] = [
  {
    id: "first-scan",
    title: "Running Your First Scan",
    content: `
# Running Your First Scan

Getting started with guardrail is easy. Follow these steps to run your first security scan:

## 1. Connect Your Repository
- Navigate to the Dashboard
- Click "Connect GitHub"
- Authorize guardrail to access your repositories

## 2. Select a Repository
- Choose the repository you want to scan
- Make sure it's a public or private repository you have access to

## 3. Run the Scan
- Click "Ship Check" for a comprehensive scan
- Or choose "Security" for security-focused analysis
- Wait for the scan to complete

## 4. Review Results
- Check your health score (🟢 80+ = Ready to ship)
- Review any issues found
- Use the "Fix Issues" button to get suggestions

## Tips
- Start with a small repository for your first scan
- Review the "What This Means" section for context
- Use the Reality Mode for real-world testing
    `,
    category: "getting-started",
    tags: ["scan", "github", "beginner"],
    relatedArticles: ["connecting-github", "understanding-results"],
  },
  {
    id: "reality-mode",
    title: "Understanding Reality Mode",
    content: `
# Understanding Reality Mode

Reality Mode is guardrail's advanced testing feature that actually tests your application like a real user would.

## What It Tests
- **Route Discovery**: Automatically finds all pages from links
- **Interactive Elements**: Clicks buttons, forms, and navigation
- **Form Testing**: Fills and submits forms with smart test data
- **Error Capture**: Records console errors and network failures
- **Visual Testing**: Takes screenshots and videos for debugging

## Scoring System (0-100)
- **Coverage (40 pts)**: Routes visited, elements tested, forms filled
- **Functionality (35 pts)**: Actions that worked correctly
- **Stability (15 pts)**: Error penalties (3 pts per error)
- **UX (10 pts)**: Elements that responded to interaction

## How to Use
\`\`\`bash
guardrail reality --url https://your-app.com
guardrail reality --url https://your-app.com --auth user:pass
guardrail reality --url https://your-app.com --flows auth
\`\`\`

## Flow Packs
- \`auth\`: Login, signup, logout flows
- \`ui\`: Modals, navigation, dark mode
- \`forms\`: Form validation testing
- \`ecommerce\`: Checkout process testing

## Best Practices
1. Test your staging environment first
2. Use authentication for protected routes
3. Review the video recordings for failures
4. Check the HTML report for detailed findings
    `,
    category: "features",
    tags: ["testing", "automation", "advanced"],
    relatedArticles: ["api-reference", "troubleshooting"],
    videoUrl: "https://example.com/reality-mode-demo",
  },
  {
    id: "api-reference",
    title: "API Reference",
    content: `
# API Reference

guardrail provides a comprehensive REST API for integrating security scanning into your workflows.

## Authentication
All API requests require a Bearer token:

\`\`\`http
Authorization: Bearer your-api-token
\`\`\`

## Endpoints

### Scans
\`\`\`http
POST /api/v1/scans
Content-Type: application/json

{
  "repository": "owner/repo",
  "branch": "main",
  "scanType": "full"
}
\`\`\`

### Scan Results
\`\`\`http
GET /api/v1/scans/{scanId}
\`\`\`

### Webhooks
Configure webhooks to receive scan results:

\`\`\`http
POST /api/v1/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["scan.completed", "scan.failed"]
}
\`\`\`

## Rate Limits
- Free tier: 10 requests/minute
- Pro tier: 100 requests/minute
- Enterprise: 1000 requests/minute

## SDKs
- Node.js: \`npm install @guardrail/sdk\`
- Python: \`pip install guardrail-sdk\`
- Go: \`go get github.com/guardiavault/guardrail-go\`
    `,
    category: "api",
    tags: ["api", "integration", "developer"],
    relatedArticles: ["cli-commands", "webhooks"],
    codeExample: `
// Node.js SDK example
import { guardrail } from '@guardrail/sdk';
// In Next.js apps: import { logger } from '@/lib/logger';

const client = new guardrail({ token: 'your-token' });

const scan = await client.scans.create({
  repository: 'owner/repo',
  branch: 'main',
  scanType: 'full'
});

logger.info('Scan created', { scanId: scan.id });
`,
  },
];

// Help Provider
export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<HelpArticle | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const openHelp = (articleId?: string) => {
    if (articleId) {
      const article = helpArticles.find((a) => a.id === articleId);
      setCurrentArticle(article || null);
    }
    setIsOpen(true);
    setSearchQuery("");

    // Focus search input after opening
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const closeHelp = () => {
    setIsOpen(false);
    setCurrentArticle(null);
    setSearchQuery("");
  };

  const searchArticles = (query: string): HelpArticle[] => {
    if (!query.trim()) return helpArticles;

    const lowercaseQuery = query.toLowerCase();
    return helpArticles.filter(
      (article) =>
        article.title.toLowerCase().includes(lowercaseQuery) ||
        article.content.toLowerCase().includes(lowercaseQuery) ||
        article.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)),
    );
  };

  const getRelatedArticles = (articleId: string): HelpArticle[] => {
    const article = helpArticles.find((a) => a.id === articleId);
    if (!article?.relatedArticles) return [];

    return article.relatedArticles
      .map((id) => helpArticles.find((a) => a.id === id))
      .filter(Boolean) as HelpArticle[];
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "?") {
        e.preventDefault();
        openHelp();
      }
      if (e.key === "Escape" && isOpen) {
        closeHelp();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <HelpContext.Provider
      value={{
        isOpen,
        openHelp,
        closeHelp,
        currentArticle,
        searchArticles,
        getRelatedArticles,
      }}
    >
      {children}
      <HelpModal />
    </HelpContext.Provider>
  );
}

// Hook to use help
export function useHelp() {
  const context = React.useContext(HelpContext);
  if (!context) {
    throw new Error("useHelp must be used within a HelpProvider");
  }
  return context;
}

// Help Modal Component
function HelpModal() {
  const { isOpen, closeHelp, currentArticle, searchArticles } = useHelp();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredArticles = React.useMemo(() => {
    let articles = helpArticles;

    if (selectedCategory) {
      articles = articles.filter(
        (article) => article.category === selectedCategory,
      );
    }

    if (searchQuery) {
      articles = searchArticles(searchQuery);
    }

    return articles;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeHelp}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-white">Help Center</h2>
          <Button variant="ghost" size="sm" onClick={closeHelp} className="p-2">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r border-zinc-800 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search help..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    !selectedCategory
                      ? "bg-blue-950/30 text-blue-400 border border-blue-800/50"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50",
                  )}
                >
                  <Book className="w-4 h-4" />
                  <span>All Articles</span>
                </button>

                {helpCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                      selectedCategory === category.id
                        ? "bg-blue-950/30 text-blue-400 border border-blue-800/50"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/50",
                    )}
                  >
                    {category.icon}
                    <div className="flex-1 text-left">
                      <div className="font-medium">{category.name}</div>
                      <div className="text-xs opacity-70">
                        {category.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 border-t border-zinc-800 space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-zinc-400 hover:text-white"
                onClick={() => window.open("/docs", "_blank")}
              >
                <FileText className="w-4 h-4" />
                Full Documentation
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-zinc-400 hover:text-white"
                onClick={() =>
                  window.open(
                    "https://github.com/guardiavault/guardrail/issues",
                    "_blank",
                  )
                }
              >
                <MessageCircle className="w-4 h-4" />
                Report Issue
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col">
            {currentArticle ? (
              <ArticleView article={currentArticle} />
            ) : (
              <ArticleList articles={filteredArticles} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Article List Component
function ArticleList({ articles }: { articles: HelpArticle[] }) {
  const { openHelp } = useHelp();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-4">
        {articles.map((article) => (
          <Card
            key={article.id}
            className="cursor-pointer hover:border-zinc-600 transition-colors"
            onClick={() => openHelp(article.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-white">{article.title}</CardTitle>
              <CardDescription className="text-zinc-400">
                {article.content.slice(0, 150)}...
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Article View Component
function ArticleView({ article }: { article: HelpArticle }) {
  const { getRelatedArticles } = useHelp();
  const relatedArticles = getRelatedArticles(article.id);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        {/* Article Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            {article.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>Category: {article.category}</span>
            <div className="flex gap-1">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Article Content */}
        <div className="prose prose-invert max-w-none">
          <div className="bg-zinc-800/50 rounded-lg p-6">
            <pre className="whitespace-pre-wrap text-zinc-300">
              {article.content}
            </pre>
          </div>
        </div>

        {/* Code Example */}
        {article.codeExample && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Code Example
            </h3>
            <div className="bg-zinc-950 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-zinc-300">
                <code>{article.codeExample}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Video */}
        {article.videoUrl && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Video Tutorial
            </h3>
            <div className="aspect-video bg-zinc-800 rounded-lg flex items-center justify-center">
              <Button
                onClick={() => window.open(article.videoUrl, "_blank")}
                className="flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                Watch Tutorial
              </Button>
            </div>
          </div>
        )}

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white mb-4">
              Related Articles
            </h3>
            <div className="space-y-2">
              {relatedArticles.map((relatedArticle) => (
                <Card
                  key={relatedArticle.id}
                  className="cursor-pointer hover:border-zinc-600 transition-colors"
                >
                  <CardContent className="p-4">
                    <h4 className="text-white font-medium">
                      {relatedArticle.title}
                    </h4>
                    <p className="text-zinc-400 text-sm mt-1">
                      {relatedArticle.content.slice(0, 100)}...
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Help Button Component
export function HelpButton({
  className,
  showShortcut = true,
}: {
  className?: string;
  showShortcut?: boolean;
}) {
  const { openHelp } = useHelp();

  return (
    <Button
      onClick={() => openHelp()}
      variant="outline"
      size="sm"
      className={cn("gap-2", className)}
    >
      <HelpCircle className="w-4 h-4" />
      Help
      {showShortcut && (
        <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs">
          Ctrl+?
        </kbd>
      )}
    </Button>
  );
}

// Contextual Help Component
export function ContextualHelp({
  articleId,
  children,
  className,
}: {
  articleId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { openHelp } = useHelp();

  return (
    <button
      onClick={() => openHelp(articleId)}
      className={cn(
        "inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors",
        className,
      )}
    >
      {children}
      <HelpCircle className="w-3 h-3" />
    </button>
  );
}

// Keyboard Shortcuts Help
export function KeyboardShortcuts() {
  const shortcuts = [
    { key: "Ctrl+?", description: "Open help center" },
    { key: "Ctrl+K", description: "Open command palette" },
    { key: "Ctrl+/", description: "Toggle comments" },
    { key: "Esc", description: "Close modal/dialog" },
    { key: "Tab", description: "Navigate focusable elements" },
    { key: "Enter/Space", description: "Activate focused element" },
  ];

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Keyboard className="w-4 h-4" />
          Keyboard Shortcuts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between"
            >
              <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300">
                {shortcut.key}
              </kbd>
              <span className="text-zinc-400 text-sm">
                {shortcut.description}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
