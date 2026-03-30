"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Calendar, User } from "lucide-react";
import Link from "next/link";

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  category: string;
  readTime: string;
}

// Static page - revalidate every hour
export const revalidate = 3600;

const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: "Introducing guardrail: AI Development Guardrails for Production",
    excerpt:
      "We're excited to announce guardrail, a comprehensive platform for adding safety guardrails to AI-powered development. Learn how guardrail helps teams ship faster while maintaining code quality and security standards.",
    date: "January 1, 2026",
    author: "guardrail Team",
    category: "Product",
    readTime: "5 min read",
  },
  {
    id: "2",
    title: "Why Mock Data Detection Matters in AI-Generated Code",
    excerpt:
      "AI assistants often generate placeholder or mock data that can accidentally make it to production. We built Reality Mode to detect and prevent this common issue. Here's how it works and why it matters.",
    date: "December 28, 2025",
    author: "Engineering Team",
    category: "Engineering",
    readTime: "8 min read",
  },
  {
    id: "3",
    title: "Ship Check: GO/NO-GO Validation for Every Deployment",
    excerpt:
      "Before you ship, run Ship Check. Our comprehensive validation system analyzes security, compliance, architecture, and code quality to give you a clear GO or NO-GO decision for deployment.",
    date: "December 22, 2025",
    author: "Product Team",
    category: "Features",
    readTime: "6 min read",
  },
  {
    id: "4",
    title: "Integrating guardrail with Your CI/CD Pipeline",
    excerpt:
      "Learn how to integrate guardrail into your continuous integration and deployment workflows. We'll cover GitHub Actions, GitLab CI, and other popular CI/CD platforms.",
    date: "December 15, 2025",
    author: "DevOps Team",
    category: "Tutorial",
    readTime: "10 min read",
  },
  {
    id: "5",
    title: "Security Scanning Best Practices for AI-Generated Code",
    excerpt:
      "AI-generated code introduces unique security challenges. This guide covers OWASP Top 10 compliance, dependency scanning, and other essential security practices when working with AI assistants.",
    date: "December 10, 2025",
    author: "Security Team",
    category: "Security",
    readTime: "12 min read",
  },
  {
    id: "6",
    title: "Using the guardrail MCP Server with Claude Desktop",
    excerpt:
      "A step-by-step guide to installing and configuring the guardrail MCP server for use with Claude Desktop, Cursor, and other AI assistants. Unlock professional guardrails directly in your development environment.",
    date: "December 5, 2025",
    author: "Developer Relations",
    category: "Tutorial",
    readTime: "7 min read",
  },
];

const categoryColors: Record<string, string> = {
  Product: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Engineering: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Features: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Tutorial: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Security: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function BlogPage() {
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
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold mb-6"
          >
            <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              guardrail Blog
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-white/70 max-w-2xl mx-auto"
          >
            Insights, tutorials, and updates on AI-powered development,
            security, and best practices
          </motion.p>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="container mx-auto max-w-5xl">
          <div className="space-y-8">
            {blogPosts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-all hover:border-emerald-500/30"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className={`text-xs px-3 py-1 rounded-full border ${
                      categoryColors[post.category] || categoryColors.Product
                    }`}
                  >
                    {post.category}
                  </span>
                  <span className="text-xs text-white/40">•</span>
                  <span className="text-xs text-white/60">{post.readTime}</span>
                </div>

                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors">
                  <Link href={`/blog/${post.id}`} className="hover:text-emerald-400 transition-colors">
                    {post.title}
                  </Link>
                </h2>

                <p className="text-white/70 mb-4 leading-relaxed">
                  {post.excerpt}
                </p>

                <div className="flex items-center gap-4 text-sm text-white/50">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{post.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{post.author}</span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>

          {/* Coming Soon Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-16 text-center"
          >
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8">
              <h3 className="text-xl font-semibold text-white mb-2">
                More Coming Soon
              </h3>
              <p className="text-white/60">
                We're constantly sharing new insights and tutorials. Follow us
                on{" "}
                <a
                  href="https://twitter.com/Guardrail_ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Twitter/X
                </a>{" "}
                or join our{" "}
                <a
                  href="https://discord.gg/guardrail"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Discord
                </a>{" "}
                for updates.
              </p>
            </div>
          </motion.div>
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
