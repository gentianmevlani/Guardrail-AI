"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  BookOpen,
  ExternalLink,
  Github,
  GitPullRequest,
  Heart,
  Lightbulb,
  MessageCircle,
  Star,
  Twitter,
  Users,
} from "lucide-react";
import Link from "next/link";
import React from "react";

interface CommunityLink {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  stats?: string;
}

const communityLinks: CommunityLink[] = [
  {
    title: "Discord Community",
    description:
      "Join thousands of developers discussing AI development, security, and best practices.",
    href: "https://discord.gg/guardrail",
    icon: <MessageCircle className="w-6 h-6" />,
    color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    stats: "2,500+ members",
  },
  {
    title: "GitHub Discussions",
    description:
      "Ask questions, share ideas, and help shape the future of guardrail.",
    href: "https://github.com/guardrail-Official/guardrail/discussions",
    icon: <Github className="w-6 h-6" />,
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    stats: "Open source",
  },
  {
    title: "Twitter / X",
    description: "Follow us for updates, tips, and community highlights.",
    href: "https://twitter.com/getguardrail",
    icon: <Twitter className="w-6 h-6" />,
    color: "bg-sky-500/20 text-sky-400 border-sky-500/30",
    stats: "@getguardrail",
  },
];

const contributors = [
  { name: "Core Team", count: 5, role: "Maintainers" },
  { name: "Contributors", count: 47, role: "Code & Docs" },
  { name: "Community", count: "2.5k+", role: "Discord Members" },
];

const waysToContribute = [
  {
    icon: <GitPullRequest className="w-5 h-5" />,
    title: "Submit Pull Requests",
    description: "Fix bugs, add features, or improve documentation.",
  },
  {
    icon: <Lightbulb className="w-5 h-5" />,
    title: "Share Ideas",
    description: "Propose new features in GitHub Discussions.",
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: "Improve Docs",
    description: "Help make our documentation better.",
  },
  {
    icon: <MessageCircle className="w-5 h-5" />,
    title: "Help Others",
    description: "Answer questions in Discord or GitHub.",
  },
  {
    icon: <Star className="w-5 h-5" />,
    title: "Star the Repo",
    description: "Show your support on GitHub.",
  },
  {
    icon: <Heart className="w-5 h-5" />,
    title: "Spread the Word",
    description: "Share guardrail with your network.",
  },
];

const upcomingEvents = [
  {
    title: "Community Call",
    date: "Every Thursday",
    time: "10:00 AM PST",
    description: "Weekly community call to discuss updates and roadmap.",
  },
  {
    title: "Office Hours",
    date: "Tuesdays",
    time: "2:00 PM PST",
    description: "Drop in to get help from the core team.",
  },
  {
    title: "guardrail Conf 2026",
    date: "March 15, 2026",
    time: "All Day",
    description: "Our first annual conference! Virtual and free.",
  },
];

export default function CommunityPage() {
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

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 border-b border-gray-800">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 text-purple-400 text-sm mb-6">
              <Users className="w-4 h-4" />
              Join the Community
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Built by Developers,{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                for Developers
              </span>
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              guardrail is open source and community-driven. Join thousands of
              developers who are shaping the future of AI-powered development.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Community Stats */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-b border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-3 gap-4">
            {contributors.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center p-6 rounded-xl border border-white/10 bg-white/[0.03]"
              >
                <div className="text-3xl md:text-4xl font-bold text-emerald-400 mb-2">
                  {item.count}
                </div>
                <div className="text-white font-medium">{item.name}</div>
                <div className="text-sm text-white/50">{item.role}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Community Links */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Connect With Us
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              {communityLinks.map((link) => (
                <a
                  key={link.title}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all"
                >
                  <div
                    className={`inline-flex p-3 rounded-lg border ${link.color} mb-4`}
                  >
                    {link.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                    {link.title}
                    <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-white/60 text-sm mb-3">
                    {link.description}
                  </p>
                  {link.stats && (
                    <span className="text-xs text-emerald-400 font-medium">
                      {link.stats}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Ways to Contribute */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              Ways to Contribute
            </h2>
            <p className="text-white/60 text-center mb-8">
              Every contribution matters, no matter how small.
            </p>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {waysToContribute.map((item, index) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-emerald-400">{item.icon}</div>
                    <h3 className="font-semibold text-white">{item.title}</h3>
                  </div>
                  <p className="text-sm text-white/60">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <a
                href="https://github.com/guardrail-Official/guardrail/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
              >
                <Github className="w-5 h-5" />
                Read Contributing Guide
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Upcoming Events
            </h2>

            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div
                  key={event.title}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-5 flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="flex-shrink-0 text-center md:text-left md:w-32">
                    <div className="text-emerald-400 font-semibold">
                      {event.date}
                    </div>
                    <div className="text-sm text-white/50">{event.time}</div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">
                      {event.title}
                    </h3>
                    <p className="text-sm text-white/60">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Code of Conduct */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center"
          >
            <Award className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Code of Conduct
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto mb-6">
              We're committed to providing a welcoming and inclusive experience
              for everyone. Our community follows the{" "}
              <a
                href="https://www.contributor-covenant.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Contributor Covenant
              </a>{" "}
              code of conduct.
            </p>
            <a
              href="https://github.com/guardrail-Official/guardrail/blob/main/CODE_OF_CONDUCT.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Read our Code of Conduct →
            </a>
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
