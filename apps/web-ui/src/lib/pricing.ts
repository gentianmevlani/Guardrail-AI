/**
 * Unified pricing structure for guardrail
 * Used across landing page, pricing page, and billing page
 */

export interface PricingPlan {
  id: string;
  name: string;
  title?: string;
  price: number | null;
  period?: string;
  annual?: number | null;
  description: string;
  popular: boolean;
  icon?: React.ComponentType<{ className?: string }> | null;
  features: string[];
  cta: string;
  trialDays?: number;
  limit?: string;
  disabled?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    title: "Developer",
    price: 0,
    period: "forever",
    annual: 0,
    description: "Severity counts & scans — findings blurred",
    popular: false,
    icon: null,
    features: [
      "guardrail scan — static analysis",
      "Severity breakdown (critical / high / medium / low)",
      "Findings list blurred — upgrade to see paths & snippets",
      "10 scans/month",
      "CLI & extension access",
    ],
    cta: "Get Started",
    limit: "1 project",
    disabled: false,
  },
  {
    id: "starter",
    name: "Starter",
    title: "Starter",
    price: 9.99,
    period: "/month",
    annual: 96,
    description: "Full findings — no auto-fix",
    popular: false,
    icon: null,
    features: [
      "Everything in Free (unblurred findings)",
      "Full issue detail: paths, rules, messages, snippets",
      "guardrail ship, reality, gate",
      "100 scans/month, 20 Reality runs/month",
      "No auto-fix (upgrade to Pro)",
    ],
    cta: "Subscribe",
    limit: "3 projects",
    disabled: false,
  },
  {
    id: "pro",
    name: "Pro",
    title: "Professional",
    price: 29.99,
    period: "/month",
    annual: 288,
    description: "Auto-fix & automation",
    popular: true,
    icon: null,
    features: [
      "Everything in Starter",
      "guardrail fix — auto-fix",
      "AI Agent, autopilot, MCP",
      "500 scans, 100 Reality, 50 AI Agent runs/month",
      "SARIF, API, webhooks",
    ],
    cta: "Subscribe",
    limit: "10 projects",
    disabled: false,
  },
  {
    id: "compliance",
    name: "Compliance",
    title: "Compliance",
    price: 59.99,
    period: "/month",
    annual: 576,
    description: "Frameworks & audit-ready",
    popular: false,
    icon: null,
    features: [
      "Everything in Pro",
      "SOC2, HIPAA, GDPR, PCI, NIST, ISO 27001",
      "PDF reports, deploy hooks",
      "1000 scans, 200 Reality, 100 AI Agent runs/month",
      "10 team seats included",
    ],
    cta: "Subscribe",
    limit: "25 projects",
    disabled: false,
  },
];

export function calculateSavings(monthly: number, annual: number): number {
  const monthlyTotal = monthly * 12;
  return Math.round(((monthlyTotal - annual) / monthlyTotal) * 100);
}
