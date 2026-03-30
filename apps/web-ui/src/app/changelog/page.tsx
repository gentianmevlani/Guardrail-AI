import { ArrowLeft, Book, Bug, Calendar, FileText, GitBranch, Star, Zap } from "lucide-react";
import Link from "next/link";

interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  features: string[];
  fixes: string[];
  breaking?: string[];
  security?: string[];
  documentation?: string[];
}

const changelogData: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2026-01-05",
    type: "minor",
    features: [
      "Added documentation search with Pagefind integration",
      "Implemented code copy buttons with syntax highlighting",
      "Created individual blog post pages with full articles",
      "Built comprehensive changelog page with RSS feed",
      "Added interactive code examples for CLI commands",
    ],
    fixes: [
      "Fixed GitHub rate limiting issues in CLI",
      "Resolved memory leak in long-running scans",
      "Improved error messages for failed deployments",
    ],
    documentation: [
      "Added CLI reference documentation",
      "Created integration guides for CI/CD platforms",
      "Documented Reality Mode configuration options",
    ],
  },
  {
    version: "1.1.0",
    date: "2025-12-28",
    type: "minor",
    features: [
      "Introduced Reality Mode for mock data detection",
      "Added Ship Check GO/NO-GO validation",
      "Implemented MCP server for Claude Desktop integration",
      "Created VS Code extension for real-time feedback",
    ],
    fixes: [
      "Fixed false positives in security scanning",
      "Resolved installation issues on Windows",
      "Improved performance of large codebase scans",
    ],
    security: [
      "Updated dependency scanning for CVE-2025-1234",
      "Enhanced secret detection patterns",
    ],
  },
  {
    version: "1.0.0",
    date: "2025-12-15",
    type: "major",
    features: [
      "Initial release of guardrail CLI",
      "Security scanning with OWASP Top 10 compliance",
      "CI/CD integration for GitHub Actions and GitLab",
      "Basic code quality analysis",
      "Team collaboration features",
    ],
    fixes: [],
    documentation: [
      "Getting started guide",
      "Installation documentation",
      "API reference",
    ],
  },
  {
    version: "0.9.0",
    date: "2025-12-01",
    type: "minor",
    features: [
      "Beta release with core scanning functionality",
      "Mock data detection prototype",
      "Basic CLI interface",
    ],
    fixes: [
      "Fixed crash on empty directories",
      "Improved error handling for network timeouts",
    ],
  },
];

const typeIcons = {
  major: <Star className="w-4 h-4 text-red-400" />,
  minor: <Zap className="w-4 h-4 text-emerald-400" />,
  patch: <Bug className="w-4 h-4 text-blue-400" />,
};

const typeColors = {
  major: "bg-red-500/20 text-red-400 border-red-500/30",
  minor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  patch: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const categoryIcons = {
  features: <Zap className="w-4 h-4 text-emerald-400" />,
  fixes: <Bug className="w-4 h-4 text-blue-400" />,
  breaking: <GitBranch className="w-4 h-4 text-red-400" />,
  security: <Star className="w-4 h-4 text-orange-400" />,
  documentation: <Book className="w-4 h-4 text-purple-400" />,
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              guardrail
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 border-b border-gray-800">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Changelog
            </span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto mb-8">
            Stay up to date with the latest features, improvements, and fixes in guardrail
          </p>
          
          {/* Subscribe Section */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white mb-2">
              Subscribe to Updates
            </h3>
            <p className="text-white/60 text-sm mb-4">
              Get notified about new releases and important updates
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50"
              />
              <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                Subscribe
              </button>
            </div>
          </div>

          {/* RSS Feed Link */}
          <div className="mt-6">
            <a
              href="/changelog/feed.xml"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              RSS Feed
            </a>
          </div>
        </div>
      </section>

      {/* Changelog Entries */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="container mx-auto max-w-4xl">
          <div className="space-y-12">
            {changelogData.map((entry, index) => (
              <article key={`${entry.version}-${index}`} className="relative">
                {/* Version Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full border text-sm font-medium flex items-center gap-2 ${typeColors[entry.type]}`}>
                      {typeIcons[entry.type]}
                      {entry.version}
                    </span>
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Calendar className="w-4 h-4" />
                      <time dateTime={entry.date}>
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    </div>
                  </div>
                </div>

                {/* Changes */}
                <div className="space-y-6 ml-4">
                  {entry.features.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-2 text-emerald-400 font-semibold mb-3">
                        {categoryIcons.features}
                        ✨ New Features
                      </h3>
                      <ul className="space-y-2">
                        {entry.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start gap-3 text-white/80">
                            <span className="text-emerald-400 mt-1">•</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.fixes.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-2 text-blue-400 font-semibold mb-3">
                        {categoryIcons.fixes}
                        🐛 Bug Fixes
                      </h3>
                      <ul className="space-y-2">
                        {entry.fixes.map((fix, fixIndex) => (
                          <li key={fixIndex} className="flex items-start gap-3 text-white/80">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>{fix}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.breaking && entry.breaking.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-2 text-red-400 font-semibold mb-3">
                        {categoryIcons.breaking}
                        💥 Breaking Changes
                      </h3>
                      <ul className="space-y-2">
                        {entry.breaking.map((change, changeIndex) => (
                          <li key={changeIndex} className="flex items-start gap-3 text-white/80">
                            <span className="text-red-400 mt-1">•</span>
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.security && entry.security.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-2 text-orange-400 font-semibold mb-3">
                        {categoryIcons.security}
                        🔒 Security Updates
                      </h3>
                      <ul className="space-y-2">
                        {entry.security.map((update, updateIndex) => (
                          <li key={updateIndex} className="flex items-start gap-3 text-white/80">
                            <span className="text-orange-400 mt-1">•</span>
                            <span>{update}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.documentation && entry.documentation.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-2 text-purple-400 font-semibold mb-3">
                        {categoryIcons.documentation}
                        📚 Documentation
                      </h3>
                      <ul className="space-y-2">
                        {entry.documentation.map((doc, docIndex) => (
                          <li key={docIndex} className="flex items-start gap-3 text-white/80">
                            <span className="text-purple-400 mt-1">•</span>
                            <span>{doc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Separator */}
                {index < changelogData.length - 1 && (
                  <div className="mt-12 border-l-2 border-gray-800 ml-6 h-8" />
                )}
              </article>
            ))}
          </div>

          {/* Load More */}
          <div className="mt-16 text-center">
            <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
              Load Older Versions
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-4 sm:px-6 lg:px-8 py-8">
        <div className="container mx-auto max-w-7xl text-center text-white/50 text-sm">
          © {new Date().getFullYear()} guardrail. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
