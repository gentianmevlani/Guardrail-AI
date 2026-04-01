"use client";

import {
  LandingAudienceSection,
  LandingBentoCapabilities,
  LandingFilmGrain,
  LandingFooterPro,
  LandingIntegrationsStrip,
  LandingRealityBridge,
  LandingShipTimeline,
  LandingStatsRail,
} from "@/components/landing/landing-expanded";
import { CTASection } from "@/components/landing/sections/cta-section";
import { FAQSection } from "@/components/landing/sections/faq-section";
import { HeroSection } from "@/components/landing/sections/hero-section";
import { HowItWorksSection } from "@/components/landing/sections/how-it-works-section";
import { PricingSection } from "@/components/landing/sections/pricing-section";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function HomeLanding() {
  const router = useRouter();

  const onOpenAuth = useCallback(
    (mode: "login" | "signup") => {
      router.push(`/auth${mode === "signup" ? "?mode=signup" : ""}`);
    },
    [router],
  );

  return (
    <div className="relative isolate min-h-screen w-full overflow-x-hidden bg-black text-white">
      <LandingFilmGrain />

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-neutral-950/85 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-white font-semibold tracking-tight"
          >
            <Image
              src="/guardrail-logo.svg"
              alt="guardrail"
              width={160}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          <nav
            className="hidden md:flex flex-1 items-center justify-center gap-8 text-sm text-zinc-400"
            aria-label="Sections"
          >
            <a href="#how-it-works" className="hover:text-teal-200 transition-colors">How it works</a>
            <a href="#teams" className="hover:text-teal-200 transition-colors">Teams</a>
            <a href="#capabilities" className="hover:text-teal-200 transition-colors">Capabilities</a>
            <a href="#integrate" className="hidden lg:inline hover:text-teal-200 transition-colors">Integrate</a>
            <a href="#pricing" className="hover:text-teal-200 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-teal-200 transition-colors">FAQ</a>
          </nav>
          <nav className="flex shrink-0 items-center gap-2 sm:gap-3" aria-label="Primary">
            <Button variant="ghost" className="text-gray-300 hover:text-white" asChild>
              <Link href="/auth">Log in</Link>
            </Button>
            <Button className="bg-teal-500 text-black hover:bg-teal-400 font-semibold" asChild>
              <Link href="/auth?mode=signup">Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 w-full">
        <HeroSection onOpenAuth={onOpenAuth} />
        <LandingStatsRail />
        <HowItWorksSection />
        <LandingAudienceSection />
        <LandingBentoCapabilities />
        <LandingShipTimeline />
        <LandingIntegrationsStrip />
        <LandingRealityBridge />
        <PricingSection />
        <CTASection onOpenAuth={onOpenAuth} />
        <FAQSection />
      </main>

      <div className="relative z-10 w-full">
        <LandingFooterPro />
      </div>
    </div>
  );
}
