"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowRight,
    Book,
    Clock,
    Code,
    FileText,
    Hash,
    Search,
    Terminal
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

interface SearchResult {
  title: string;
  url: string;
  excerpt: string;
  section: string;
  subsection?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock search results - in production, this would use Pagefind
const mockSearchResults: SearchResult[] = [
  {
    title: "Getting Started",
    url: "/docs#getting-started",
    excerpt: "Get guardrail up and running in your project in just a few commands.",
    section: "Docs",
    subsection: "Introduction"
  },
  {
    title: "guardrail scan",
    url: "/docs#cli-scan",
    excerpt: "Run security and code quality scans on your codebase.",
    section: "CLI Reference",
  },
  {
    title: "Reality Mode",
    url: "/docs#reality-mode",
    excerpt: "Detect mock data and placeholder content in your application.",
    section: "Features",
  },
  {
    title: "GitHub Actions Integration",
    url: "/docs#github-actions",
    excerpt: "Add guardrail to your CI/CD pipeline with our official GitHub Action.",
    section: "Integrations",
  },
  {
    title: "Installation Guide",
    url: "/docs#installation",
    excerpt: "Detailed installation instructions for all platforms.",
    section: "Docs",
    subsection: "Getting Started"
  },
  {
    title: "Configuration",
    url: "/docs#configuration",
    excerpt: "Configure guardrail for your project with guardrail.config.js.",
    section: "Docs",
    subsection: "Getting Started"
  },
  {
    title: "guardrail ship",
    url: "/docs#cli-ship",
    excerpt: "Pre-deployment validation to ensure code is ready to ship.",
    section: "CLI Reference",
  },
  {
    title: "Security Scanning",
    url: "/docs#security",
    excerpt: "OWASP Top 10 compliance and vulnerability detection.",
    section: "Features",
  },
  {
    title: "Ship Check",
    url: "/docs#ship-check",
    excerpt: "GO/NO-GO deployment validation for production readiness.",
    section: "Features",
  },
  {
    title: "API Reference",
    url: "/docs#rest-api",
    excerpt: "HTTP API endpoints for integrating guardrail with your tools.",
    section: "API",
  },
];

const sectionIcons = {
  "Docs": Book,
  "CLI Reference": Terminal,
  "Features": Code,
  "Integrations": Hash,
  "API": FileText,
};

const sectionColors = {
  "Docs": "text-blue-400",
  "CLI Reference": "text-emerald-400",
  "Features": "text-purple-400",
  "Integrations": "text-orange-400",
  "API": "text-pink-400",
};

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('guardrail-search-recent');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    }
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter results based on query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const filtered = mockSearchResults.filter(result => 
      result.title.toLowerCase().includes(query.toLowerCase()) ||
      result.excerpt.toLowerCase().includes(query.toLowerCase()) ||
      result.section.toLowerCase().includes(query.toLowerCase())
    );

    setResults(filtered);
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Add to recent searches
    const newRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecent);
    if (typeof window !== 'undefined') {
      localStorage.setItem('guardrail-search-recent', JSON.stringify(newRecent));
    }

    // Navigate to result
    router.push(result.url);
    onClose();
    setQuery("");
  };

  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
    inputRef.current?.focus();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('guardrail-search-recent');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2 }}
          className="relative mx-auto max-w-2xl mt-20 px-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {/* Search Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <Search className="w-5 h-5 text-white/40" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search documentation, guides, API reference..."
                className="flex-1 bg-transparent text-white placeholder-white/40 outline-none"
              />
              <div className="flex items-center gap-1 text-white/30 text-sm">
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs">ESC</kbd>
                <span>to close</span>
              </div>
            </div>

            {/* Search Results */}
            <div className="max-h-96 overflow-y-auto">
              {!query && recentSearches.length > 0 && (
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                      Recent Searches
                    </h3>
                    <button
                      onClick={clearRecentSearches}
                      className="text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        onClick={() => handleRecentSearchClick(search)}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-sm transition-colors flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" />
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {query && results.length === 0 && (
                <div className="p-8 text-center">
                  <Search className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    No results found
                  </h3>
                  <p className="text-white/60 mb-4">
                    Try searching for different keywords or browse our documentation sections.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Object.keys(sectionIcons).map((section) => {
                      const Icon = sectionIcons[section as keyof typeof sectionIcons];
                      return (
                        <button
                          key={section}
                          onClick={() => setQuery(section)}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-sm transition-colors flex items-center gap-1"
                        >
                          <Icon className="w-3 h-3" />
                          {section}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {results.length > 0 && (
                <div className="py-2">
                  {results.map((result, index) => {
                    const Icon = sectionIcons[result.section as keyof typeof sectionIcons];
                    const colorClass = sectionColors[result.section as keyof typeof sectionColors];
                    
                    return (
                      <button
                        key={`${result.url}-${index}`}
                        onClick={() => handleResultClick(result)}
                        className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors ${
                          index === selectedIndex ? 'bg-white/5' : ''
                        }`}
                      >
                        <div className={`mt-0.5 ${colorClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-white">
                              {result.title}
                            </h4>
                            {result.subsection && (
                              <span className="text-xs text-white/40">
                                • {result.subsection}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white/60 line-clamp-2">
                            {result.excerpt}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs ${colorClass}`}>
                              {result.section}
                            </span>
                            <span className="text-xs text-white/40">
                              {result.url}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-white/20 mt-0.5" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
              <div className="flex items-center gap-4">
                <span>Powered by guardrail AI</span>
                <span>•</span>
                <span>{results.length} results</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">↑↓</kbd>
                <span>to navigate</span>
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs ml-2">↵</kbd>
                <span>to select</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
