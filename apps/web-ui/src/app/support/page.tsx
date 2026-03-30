"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Book,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  HelpCircle,
  Mail,
  MessageCircle,
  Send,
  Zap,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

interface FAQ {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQ[] = [
  {
    category: "Getting Started",
    question: "How do I install guardrail?",
    answer:
      "guardrail can be installed via npm (npm install -g @guardrail/cli), Homebrew on macOS (brew install guardrail), or downloaded directly from our website. Visit our installation guide at /install for detailed instructions for all platforms.",
  },
  {
    category: "Getting Started",
    question: "Is guardrail free to use?",
    answer:
      "Yes! guardrail offers a generous free tier that includes 10 scans per month, basic security scanning, and CLI access. For teams and advanced features like unlimited scans, priority support, and enterprise integrations, check out our paid plans.",
  },
  {
    category: "Features",
    question: "What is Reality Mode?",
    answer:
      "Reality Mode detects mock data, placeholder content, and TODO comments that AI assistants often generate. It prevents these from accidentally making it to production by scanning for patterns like 'lorem ipsum', fake emails, placeholder API keys, and more.",
  },
  {
    category: "Features",
    question: "What security vulnerabilities does guardrail detect?",
    answer:
      "guardrail scans for OWASP Top 10 vulnerabilities, hardcoded secrets, SQL injection, XSS, insecure dependencies, and 50+ other security patterns. Our AI-powered scanner also detects context-specific issues that traditional static analysis misses.",
  },
  {
    category: "Features",
    question: "How does Ship Check work?",
    answer:
      "Ship Check runs a comprehensive pre-deployment validation that combines security scanning, Reality Mode checks, code quality analysis, and custom policy enforcement. It gives you a clear GO or NO-GO verdict with detailed reasoning.",
  },
  {
    category: "Integration",
    question: "Does guardrail work with my CI/CD pipeline?",
    answer:
      "Yes! guardrail integrates with GitHub Actions, GitLab CI, Jenkins, CircleCI, and most other CI/CD platforms. We provide official actions and detailed documentation for each platform.",
  },
  {
    category: "Integration",
    question: "Can I use guardrail with Claude or Cursor?",
    answer:
      "Absolutely! Our MCP (Model Context Protocol) server allows guardrail to run directly within Claude Desktop, Cursor, and other MCP-compatible AI assistants, providing real-time feedback as you code.",
  },
  {
    category: "Billing",
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes, you can cancel your subscription at any time from your dashboard. Your access will continue until the end of your current billing period.",
  },
  {
    category: "Billing",
    question: "Do you offer refunds?",
    answer:
      "We offer a 14-day money-back guarantee for all paid plans. If you're not satisfied, contact support within 14 days of purchase for a full refund.",
  },
  {
    category: "Enterprise",
    question: "Do you offer self-hosted/on-premise deployment?",
    answer:
      "Yes! Our Enterprise plan includes self-hosted deployment options, allowing you to run guardrail entirely within your own infrastructure for maximum security and compliance.",
  },
];

const supportChannels = [
  {
    title: "Documentation",
    description: "Comprehensive guides and API reference",
    href: "/docs",
    icon: <Book className="w-6 h-6" />,
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    availability: "Always available",
  },
  {
    title: "Discord Community",
    description: "Get help from the community and team",
    href: "https://discord.gg/guardrail",
    icon: <MessageCircle className="w-6 h-6" />,
    color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    availability: "Community support",
  },
  {
    title: "Email Support",
    description: "Direct support from our team",
    href: "mailto:support@guardrail.dev",
    icon: <Mail className="w-6 h-6" />,
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    availability: "24-48 hour response",
  },
  {
    title: "Priority Support",
    description: "Dedicated support for paid plans",
    href: "mailto:priority@guardrail.dev",
    icon: <Zap className="w-6 h-6" />,
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    availability: "Same-day response",
  },
];

const supportTiers = [
  {
    name: "Free",
    features: ["Documentation access", "Community Discord", "GitHub Issues"],
    responseTime: "Community-based",
  },
  {
    name: "Starter / Pro",
    features: ["Email support", "Community Discord", "Priority issues"],
    responseTime: "24-48 hours",
  },
  {
    name: "Enterprise",
    features: [
      "Dedicated support engineer",
      "Slack/Teams integration",
      "SLA guarantee",
      "On-call support",
    ],
    responseTime: "4 hours",
  },
];

function FAQItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: FAQ;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between text-left bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      >
        <span className="font-medium text-white">{faq.question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-white/60 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/60 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10">
          <p className="text-white/70 leading-relaxed">{faq.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const categories = [
    "All",
    ...Array.from(new Set(faqs.map((f) => f.category))),
  ];
  const filteredFAQs =
    selectedCategory === "All"
      ? faqs
      : faqs.filter((f) => f.category === selectedCategory);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Would integrate with backend
    window.location.href = `mailto:support@guardrail.dev?subject=${encodeURIComponent(contactForm.subject)}&body=${encodeURIComponent(`Name: ${contactForm.name}\nEmail: ${contactForm.email}\n\n${contactForm.message}`)}`;
  };

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
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 text-emerald-400 text-sm mb-6">
              <HelpCircle className="w-4 h-4" />
              Help & Support
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              How Can We Help?
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Find answers in our documentation, get help from the community, or
              reach out to our support team directly.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Support Channels */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Support Channels
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {supportChannels.map((channel) => (
                <a
                  key={channel.title}
                  href={channel.href}
                  target={
                    channel.href.startsWith("http") ? "_blank" : undefined
                  }
                  rel={
                    channel.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all"
                >
                  <div
                    className={`inline-flex p-3 rounded-lg border ${channel.color} mb-4`}
                  >
                    {channel.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                    {channel.title}
                    {channel.href.startsWith("http") && (
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </h3>
                  <p className="text-white/60 text-sm mb-2">
                    {channel.description}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <Clock className="w-3 h-3" />
                    {channel.availability}
                  </div>
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Support Tiers */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Support by Plan
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              {supportTiers.map((tier) => (
                <div
                  key={tier.name}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <h3 className="text-lg font-semibold text-white mb-3">
                    {tier.name}
                  </h3>
                  <div className="mb-4">
                    <span className="text-sm text-white/60">
                      Response time:
                    </span>
                    <div className="text-emerald-400 font-medium">
                      {tier.responseTime}
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-white/70"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              Frequently Asked Questions
            </h2>
            <p className="text-white/60 text-center mb-8">
              Quick answers to common questions
            </p>

            {/* Category Filter */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === category
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/5 text-white/60 border border-white/10 hover:text-white"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* FAQ List */}
            <div className="space-y-3">
              {filteredFAQs.map((faq, index) => (
                <FAQItem
                  key={index}
                  faq={faq}
                  isOpen={openFAQ === index}
                  onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              Still Need Help?
            </h2>
            <p className="text-white/60 text-center mb-8">
              Send us a message and we'll get back to you as soon as possible.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50"
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={contactForm.subject}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, subject: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50"
                  placeholder="How can we help?"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Message
                </label>
                <textarea
                  value={contactForm.message}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, message: e.target.value })
                  }
                  rows={5}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50 resize-none"
                  placeholder="Describe your issue or question..."
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
              >
                <Send className="w-5 h-5" />
                Send Message
              </button>
            </form>
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
