"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronUp,
  Github,
  Heart,
  Linkedin,
  MessageSquare,
  Shield,
  Twitter,
} from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

// Footer Component
export function Footer({
  className,
  showBackToTop = true,
}: {
  className?: string;
  showBackToTop?: boolean;
}) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentYear] = useState(2026);

  // Handle scroll to show/hide back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.pageYOffset > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const footerLinks = {
    product: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Reality Mode", href: "/reality-mode" },
      { label: "AI Analysis", href: "/ai-analysis" },
      { label: "Compliance", href: "/compliance" },
      { label: "Changelog", href: "/changelog" },
    ],
    company: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "Contact", href: "/contact" },
    ],
    resources: [
      { label: "Documentation", href: "/docs" },
      { label: "API Reference", href: "/api" },
      { label: "CLI Guide", href: "/cli" },
      { label: "Help Center", href: "/help" },
      { label: "Community", href: "/community" },
      { label: "Status", href: "https://status.guardrail.dev" },
    ],
    legal: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Security", href: "/security" },
      { label: "GDPR", href: "/gdpr" },
      { label: "SLA", href: "/sla" },
    ],
    social: [
      {
        label: "GitHub",
        href: "https://github.com/guardiavault/guardrail",
        icon: Github,
      },
      {
        label: "Twitter",
        href: "https://twitter.com/getguardrail",
        icon: Twitter,
      },
      {
        label: "LinkedIn",
        href: "https://linkedin.com/company/guardrail",
        icon: Linkedin,
      },
      {
        label: "Discord",
        href: "https://discord.gg/guardrail",
        icon: MessageSquare,
      },
    ],
  };

  return (
    <>
      <footer className={cn("bg-zinc-950 border-t border-zinc-800", className)}>
        {/* Main Footer Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">guardrail</h3>
                  <p className="text-zinc-400 text-sm">Ship with confidence</p>
                </div>
              </div>
              <p className="text-zinc-400 text-sm mb-6">
                Production-ready security scanning and code quality analysis for
                modern applications. Deploy confidently with automated testing
                and continuous monitoring.
              </p>

              {/* Social Links */}
              <div className="flex items-center gap-3">
                {footerLinks.social.map((social) => (
                  <Link
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="w-4 h-4" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                {footerLinks.product.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-zinc-400 hover:text-white transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                {footerLinks.company.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-zinc-400 hover:text-white transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                {footerLinks.resources.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-zinc-400 hover:text-white transition-colors text-sm"
                      target={
                        link.href.startsWith("http") ? "_blank" : undefined
                      }
                      rel={
                        link.href.startsWith("http")
                          ? "noopener noreferrer"
                          : undefined
                      }
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal & Newsletter */}
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 mb-6">
                {footerLinks.legal.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-zinc-400 hover:text-white transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Newsletter Signup */}
              <div className="space-y-3">
                <h5 className="text-white font-medium text-sm">Stay Updated</h5>
                <p className="text-zinc-400 text-xs">
                  Get the latest security insights and product updates
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Subscribe
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="mt-12 pt-8 border-t border-zinc-800">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4 text-zinc-400 text-sm">
                <span>© {currentYear} guardrail Inc.</span>
                <span>•</span>
                <span>Built with</span>
                <Heart className="w-3 h-3 text-red-400" />
                <span>for developers</span>
              </div>

              <div className="flex items-center gap-6 text-zinc-400 text-sm">
                <div className="flex items-center gap-2">
                  <span>Version</span>
                  <code className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300">
                    v1.0.0
                  </code>
                </div>

                <div className="flex items-center gap-2">
                  <span>Status</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span>All systems operational</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to Top Button */}
      {showBackToTop && showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 z-40"
          aria-label="Back to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </>
  );
}

// Minimal Footer for Auth Pages
export function MinimalFooter({ className }: { className?: string }) {
  const currentYear = 2026;

  return (
    <footer
      className={cn("bg-zinc-950 border-t border-zinc-800 py-6", className)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <span>© {currentYear} guardrail Inc.</span>
          </div>

          <div className="flex items-center gap-6 text-zinc-400 text-sm">
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/security"
              className="hover:text-white transition-colors"
            >
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Compact Footer for Dashboard
export function CompactFooter({ className }: { className?: string }) {
  const currentYear = 2026;

  return (
    <footer
      className={cn("bg-zinc-900 border-t border-zinc-800 py-3", className)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <span>© {currentYear} guardrail</span>
            <span>•</span>
            <span>v1.0.0</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-500 text-xs">
            <Link
              href="/terms"
              className="hover:text-zinc-400 transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:text-zinc-400 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="https://status.guardrail.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 transition-colors"
            >
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Footer with Analytics (for marketing pages)
export function MarketingFooter({
  className,
  showAnalytics = true,
}: {
  className?: string;
  showAnalytics?: boolean;
}) {
  const currentYear = new Date().getFullYear();

  return (
    <>
      <Footer className={className} />

      {/* Analytics Scripts - Using Next.js Script component for security */}
      {showAnalytics && (
        <>
          {/* Google Analytics */}
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=GA-XXXXXXXXX"
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'GA-XXXXXXXXX');
            `}
          </Script>

          {/* Hotjar */}
          <Script id="hotjar-analytics" strategy="afterInteractive">
            {`
              (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:1234567,hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `}
          </Script>
        </>
      )}
    </>
  );
}

// Footer with Cookie Consent
export function FooterWithCookieConsent({ className }: { className?: string }) {
  const [showConsent, setShowConsent] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  useEffect(() => {
    // Check if consent was already given
    const consent = localStorage.getItem("cookie-consent");
    if (consent === "given") {
      setConsentGiven(true);
    } else if (!consent) {
      // Show consent banner after a delay
      const timer = setTimeout(() => setShowConsent(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookie-consent", "given");
    setConsentGiven(true);
    setShowConsent(false);

    // Load analytics scripts
    loadAnalytics();
  };

  const rejectCookies = () => {
    localStorage.setItem("cookie-consent", "rejected");
    setShowConsent(false);
  };

  const loadAnalytics = () => {
    // Load analytics scripts here
    logger.info("Analytics loaded", {
      component: 'FooterWithCookieConsent',
      timestamp: new Date().toISOString()
    });
  };

  return (
    <>
      <Footer className={className} />

      {/* Cookie Consent Banner */}
      {showConsent && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-zinc-300 text-sm mb-2">
                  <strong>Cookie Notice</strong>
                </p>
                <p className="text-zinc-400 text-sm">
                  We use cookies to enhance your experience, analyze site
                  traffic, and personalize content. By continuing to use our
                  site, you agree to our use of cookies.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open("/privacy", "_blank")}
                  className="text-zinc-400 hover:text-white"
                >
                  Learn More
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={rejectCookies}
                  className="text-zinc-400 hover:text-white"
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={acceptCookies}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Accept All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Footer Stats Component (for showing impressive numbers)
export function FooterStats({
  stats,
  className,
}: {
  stats: Array<{
    label: string;
    value: string;
    description?: string;
  }>;
  className?: string;
}) {
  return (
    <div className={cn("bg-zinc-900 py-12", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-3xl font-bold text-white mb-2">
                {stat.value}
              </div>
              <div className="text-lg font-medium text-zinc-300 mb-1">
                {stat.label}
              </div>
              {stat.description && (
                <div className="text-sm text-zinc-500">{stat.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
