"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  Binary,
  Blocks,
  FileCheck,
  Gauge,
  GitBranch,
  Layers,
  Radio,
  Shield,
  Sparkles,
  Timer,
  Workflow,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

/** Noise layer — absolute within `isolate` landing root (avoids fixed + blend bugs). */
export function LandingFilmGrain() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
}

const STATS = [
  {
    label: "Classes of failure",
    value: "40+",
    hint: "mock data, dead routes, auth gaps, secret leaks",
    icon: Shield,
  },
  {
    label: "Minutes to first scan",
    value: "< 3",
    hint: "CLI init → ship check in your repo",
    icon: Timer,
  },
  {
    label: "Where it runs",
    value: "CI · IDE · MCP",
    hint: "same rules from terminal to merge queue",
    icon: Workflow,
  },
] as const;

export function LandingStatsRail() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section
      ref={ref}
      className="relative z-10 border-y border-white/10 bg-gradient-to-r from-teal-950/25 via-black to-amber-950/15"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3 md:gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 28 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="group relative"
            >
              <div className="absolute -left-2 top-0 hidden h-full w-px bg-gradient-to-b from-teal-400/0 via-teal-400/50 to-amber-500/0 md:block" />
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-teal-500/25 bg-teal-500/10 text-teal-300 shadow-[0_0_24px_-4px_rgba(45,212,191,0.35)]">
                  <s.icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div>
                  <p
                    className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-500"
                    style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
                  >
                    {s.label}
                  </p>
                  <p
                    className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight text-white"
                    style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
                  >
                    {s.value}
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-400">
                    {s.hint}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const BENTO = [
  {
    title: "Reality Mode",
    body: "Exercise real flows—not fixtures. Catch “green CI, broken humans” before release.",
    icon: Gauge,
    accent: "from-teal-500/20 to-cyan-600/5",
    border: "border-teal-500/25",
    iconClass: "text-teal-200",
    span: "md:col-span-2",
  },
  {
    title: "MCP + IDE",
    body: "Guardrails inside Cursor, VS Code, and any MCP client.",
    icon: Blocks,
    accent: "from-amber-500/15 to-orange-600/5",
    border: "border-amber-500/30",
    iconClass: "text-amber-200",
    span: "md:col-span-1",
  },
  {
    title: "Policy gates",
    body: "Block merges on severity, tier, or org rules—automatically.",
    icon: Binary,
    accent: "from-zinc-700/30 to-zinc-950/50",
    border: "border-white/15",
    iconClass: "text-zinc-200",
    span: "md:col-span-1",
  },
  {
    title: "Audit-ready exports",
    body: "PDFs and evidence trails your security team can file without rework.",
    icon: FileCheck,
    accent: "from-emerald-500/15 to-teal-900/20",
    border: "border-emerald-500/25",
    iconClass: "text-emerald-200",
    span: "md:col-span-2",
  },
] as const;

export function LandingBentoCapabilities() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section
      id="capabilities"
      ref={ref}
      className="relative z-10 scroll-mt-28 overflow-hidden px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="pointer-events-none absolute right-0 top-1/2 h-[min(480px,80vw)] w-[min(480px,80vw)] -translate-y-1/2 translate-x-1/4 rounded-full bg-teal-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[min(320px,70vw)] w-[min(320px,70vw)] -translate-x-1/3 rounded-full bg-amber-600/10 blur-[90px]" />

      <div className="relative mx-auto w-full max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14 max-w-3xl"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium uppercase tracking-widest text-teal-200/90">
            <Sparkles className="h-3.5 w-3.5" />
            Capabilities
          </div>
          <h2
            className="text-4xl sm:text-5xl font-semibold tracking-tight text-white sm:leading-[1.1]"
            style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
          >
            One pipeline.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-white to-amber-200">
              Many places it actually runs.
            </span>
          </h2>
          <p className="mt-5 text-lg text-zinc-400 leading-relaxed">
            Ship checks, scans, and enforcement that align with how AI-built
            software is really created—not how your README pretends it is.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          {BENTO.map((cell, i) => (
            <motion.article
              key={cell.title}
              initial={{ opacity: 0, y: 32 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className={`relative overflow-hidden rounded-2xl border ${cell.border} bg-gradient-to-br ${cell.accent} p-6 sm:p-8 ${cell.span}`}
            >
              <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,rgba(255,255,255,.03)_100%)]" />
              <cell.icon
                className={`relative mb-4 h-8 w-8 ${cell.iconClass}`}
                strokeWidth={1.25}
              />
              <h3
                className="relative text-xl font-semibold text-white"
                style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
              >
                {cell.title}
              </h3>
              <p className="relative mt-2 max-w-prose text-sm leading-relaxed text-zinc-400">
                {cell.body}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

const TIMELINE = [
  {
    step: "01",
    title: "AI drafts the feature",
    detail: "Fast iterations, optimistic UI, synthetic data that “looks fine.”",
    icon: Layers,
  },
  {
    step: "02",
    title: "CI goes green",
    detail: "Unit mocks pass; integration is shallow; security lags behind vibe.",
    icon: GitBranch,
  },
  {
    step: "03",
    title: "guardrail says no",
    detail: "Reality gates, secret detection, and policy blocks on what matters.",
    icon: Radio,
  },
] as const;

export function LandingShipTimeline() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 36 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/60 via-zinc-950/80 to-black p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-12 md:p-14"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/70">
                The usual failure mode
              </p>
              <h2
                className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-white"
                style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
              >
                Green checks. Red reality.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400 md:text-right">
              We model the hand-off from AI-generated optimism to what production
              actually does—so you fix it while it is still cheap.
            </p>
          </div>

          <div className="relative mt-14 grid gap-10 md:grid-cols-3">
            <div className="pointer-events-none absolute left-[10%] right-[10%] top-[2.25rem] hidden h-px bg-gradient-to-r from-transparent via-teal-500/35 to-transparent md:block" />
            {TIMELINE.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                className="relative"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-teal-500/30 bg-teal-500/10 text-xs font-mono text-teal-200">
                  {item.step}
                </div>
                <item.icon className="mb-3 h-6 w-6 text-amber-200/80" strokeWidth={1.25} />
                <h3
                  className="text-lg font-semibold text-white"
                  style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
                >
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {item.detail}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function LandingIntegrationsStrip() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.35 });

  const links = [
    { href: "/install", label: "CLI", sub: "npm · brew · docker" },
    { href: "/vscode", label: "VS Code", sub: "extension" },
    { href: "/products/mcp", label: "MCP", sub: "Cursor · Claude Desktop" },
    { href: "/docs", label: "Docs", sub: "guides + API" },
  ] as const;

  return (
    <section
      id="integrate"
      className="relative z-10 scroll-mt-28 border-t border-white/10 bg-zinc-950/20 px-4 py-14 sm:px-6 lg:px-8"
    >
      <div ref={ref} className="mx-auto w-full max-w-7xl">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="mb-6 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500"
        >
          Where you work
        </motion.p>
        <div className="flex flex-col divide-y divide-white/10 sm:flex-row sm:divide-x sm:divide-y-0 sm:divide-white/10">
          {links.map((l, i) => (
            <motion.div
              key={l.href}
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              className="min-w-0 flex-1 py-5 sm:px-8 sm:py-0 md:flex-[unset] md:basis-0 md:grow"
            >
              <Link
                href={l.href}
                className="group flex items-start justify-between gap-3 transition-colors sm:flex-col"
              >
                <div>
                  <span className="font-display text-base font-semibold text-white transition-colors group-hover:text-teal-200">
                    {l.label}
                  </span>
                  <p className="mt-0.5 text-xs text-zinc-500">{l.sub}</p>
                </div>
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-300" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const AUDIENCE = [
  {
    title: "Engineers",
    body: "Catch dead routes, mock data, and auth gaps before the merge queue—without another dashboard to babysit.",
  },
  {
    title: "Security",
    body: "Exports and evidence that map to how the app actually behaves, not how the README claims it behaves.",
  },
  {
    title: "Leads",
    body: "One verdict on readiness: block deploys on severity, tier, or policy—same rules in CI and IDE.",
  },
] as const;

/** Who it’s for — layout only, no card chrome */
export function LandingAudienceSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      id="teams"
      ref={ref}
      className="relative z-10 scroll-mt-28 border-y border-white/10 px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-400/80">
            Teams
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Built for everyone who signs the release.
          </h2>
        </motion.div>
        <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-0">
          {AUDIENCE.map((block, i) => (
            <motion.div
              key={block.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              className={
                i === 0
                  ? "md:pr-10 lg:pr-14"
                  : "md:border-l md:border-white/10 md:px-10 lg:px-14"
              }
            >
              <h3 className="font-display text-lg font-semibold text-white">
                {block.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {block.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Bridge to product depth — single CTA row */
export function LandingRealityBridge() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <section className="relative z-10 px-4 py-14 sm:px-6 lg:px-8">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-6 border border-white/10 bg-gradient-to-br from-teal-950/20 via-zinc-950/40 to-black px-6 py-8 sm:flex-row sm:items-center sm:px-10 sm:py-9"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300/80">
            Reality check
          </p>
          <p className="font-display mt-2 max-w-xl text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Go beyond static scans—exercise real user flows before you tag a release.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 rounded-full border-teal-400/40 bg-transparent text-teal-200 hover:bg-teal-500/10 hover:text-teal-100"
          asChild
        >
          <Link href="/reality-check">Explore Reality Check</Link>
        </Button>
      </motion.div>
    </section>
  );
}

export function LandingFooterPro() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-gradient-to-b from-black via-zinc-950/60 to-black">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p
              className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-snug"
              style={{ fontFamily: "var(--font-landing-display), sans-serif" }}
            >
              Proof beats polish.
              <span className="block mt-2 text-lg font-normal text-zinc-400">
                Start free, wire CI, and let Reality Mode argue with your next
                deploy.
              </span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                className="rounded-full bg-teal-500 text-black hover:bg-teal-400"
                asChild
              >
                <Link href="/auth?mode=signup">Create account</Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10"
                asChild
              >
                <Link href="/auth">Log in</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7 lg:justify-end">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Product
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                <li>
                  <Link href="/#teams" className="hover:text-white transition-colors">
                    Teams
                  </Link>
                </li>
                <li>
                  <Link href="/#capabilities" className="hover:text-white transition-colors">
                    Capabilities
                  </Link>
                </li>
                <li>
                  <Link href="/#pricing" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="hover:text-white transition-colors">
                    Docs
                  </Link>
                </li>
                <li>
                  <Link href="/changelog" className="hover:text-white transition-colors">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Developers
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                <li>
                  <Link href="/install" className="hover:text-white transition-colors">
                    Install
                  </Link>
                </li>
                <li>
                  <Link href="/vscode" className="hover:text-white transition-colors">
                    VS Code
                  </Link>
                </li>
                <li>
                  <Link href="/products/mcp" className="hover:text-white transition-colors">
                    MCP
                  </Link>
                </li>
                <li>
                  <Link href="/community" className="hover:text-white transition-colors">
                    Community
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Legal
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                <li>
                  <Link href="/legal/privacy" className="hover:text-white transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/legal/terms" className="hover:text-white transition-colors">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/support" className="hover:text-white transition-colors">
                    Support
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-10 text-center text-xs text-zinc-600 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} guardrail. All rights reserved.</p>
          <p className="max-w-md sm:text-right">
            Built for teams shipping AI-generated code without outsourcing judgment.
          </p>
        </div>
      </div>
    </footer>
  );
}
