"use client";

import { useEffect, useRef } from "react";
import "./landing.css";

export function GsapLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const gsapModule = await import("gsap");
      const gsap = gsapModule.default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      const LenisModule = await import("lenis");
      const Lenis = LenisModule.default;
      const SplitTypeModule = await import("split-type");
      const SplitType = SplitTypeModule.default;
      // @ts-ignore — vanilla JS modules, no declarations needed
      const { initGlobalBackdropShader } = await import("./global-backdrop-shader");
      // @ts-ignore
      const { initHeroEvilryuShader } = await import("./hero-evilryu-shader");
      // @ts-ignore
      const { initScrollVelocityMarquee } = await import("./scroll-velocity-marquee");

      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const HERO_LINES = [
        { pre: "catch fake features and", highlight: "broken auth", post: "before users do" },
        { pre: "one command —", highlight: "guardrail ship", post: "with receipts" },
        { pre: "same rules from", highlight: "CI", post: "to IDE to MCP" },
        { pre: "built with AI?", highlight: "Ship", post: "with proof." },
      ];

      // Smooth scroll
      if (!prefersReducedMotion) {
        const lenis = new Lenis({
          autoRaf: false,
          smoothWheel: true,
          lerp: 0.08,
        });
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add((time: number) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        cleanupRef.current.push(() => lenis.destroy());
      }

      // Page chrome (progress bar + section label)
      ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const progress = document.getElementById("page-progress");
          if (progress) progress.style.width = `${self.progress * 100}%`;
        },
      });

      document.querySelectorAll("[data-section]").forEach((section) => {
        ScrollTrigger.create({
          trigger: section,
          start: "top center",
          end: "bottom center",
          onToggle: (self) => {
            if (self.isActive) {
              const label = document.getElementById("nav-section-label");
              if (label) label.textContent = (section as HTMLElement).dataset.section || "";
            }
          },
        });
      });

      // Hero CTA copy button
      const btn = document.querySelector("[data-copy-cli]") as HTMLElement | null;
      if (btn) {
        const text = btn.getAttribute("data-copy-cli") ?? "";
        const hint = btn.querySelector(".hero-cta__cli-hint");
        const handler = async () => {
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
            btn.classList.add("is-copied");
            if (hint) hint.textContent = "Copied";
            setTimeout(() => {
              btn.classList.remove("is-copied");
              if (hint) hint.textContent = "Copy";
            }, 2000);
          } catch {}
        };
        btn.addEventListener("click", handler);
        cleanupRef.current.push(() => btn.removeEventListener("click", handler));
      }

      // Hero text sequence
      const titleEl = document.getElementById("heroTitle");
      if (titleEl) {
        if (prefersReducedMotion) {
          const line = HERO_LINES[0];
          titleEl.innerHTML = `${line.pre} <span class="accent">${line.highlight}</span> ${line.post}`;
        } else {
          let index = 0;
          const runAnimation = () => {
            if (cancelled) return;
            const sentence = HERO_LINES[index];
            titleEl.innerHTML = `${sentence.pre} <span class="accent">${sentence.highlight}</span> ${sentence.post}`;
            const sentenceSplit = new SplitType(titleEl, { types: "words,chars", tagName: "span" });
            const accentEl = titleEl.querySelector(".accent");
            const accentSplit = accentEl ? new SplitType(accentEl as HTMLElement, { types: "chars", tagName: "span" }) : null;
            gsap.from(sentenceSplit.words || [], { y: -96, opacity: 0, rotation: () => gsap.utils.random(-20, 20), duration: 0.72, ease: "back.out(1.4)", stagger: 0.08 });
            const timeline = gsap.timeline({ delay: 0.8 });
            if (accentSplit) {
              timeline.to(accentSplit.chars || [], { x: () => gsap.utils.random(-220, 220), y: () => gsap.utils.random(-180, 220), rotate: () => gsap.utils.random(-220, 220), opacity: 0, scale: 0.2, duration: 1.25, ease: "power3.out", stagger: 0.02, delay: 1.1 });
            }
            timeline.to(sentenceSplit.words || [], { y: 96, opacity: 0, rotation: () => gsap.utils.random(-20, 20), duration: 0.6, ease: "back.in(1.2)", stagger: 0.06 }, accentSplit ? "<0.18" : "+=1.1")
              .call(() => { accentSplit?.revert(); sentenceSplit.revert(); index = (index + 1) % HERO_LINES.length; runAnimation(); });
          };
          runAnimation();
          gsap.from(".hero-copy > *", { y: 32, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.12 });
        }
      }

      // Fill rows
      gsap.utils.toArray(".fill-row").forEach((row: any) => {
        const fill = row.querySelector(".fill");
        gsap.fromTo(fill, { backgroundSize: "0% 100%, 100% 100%" }, { backgroundSize: "100% 100%, 100% 100%", ease: "none", scrollTrigger: { trigger: row, start: "top 88%", end: "bottom 46%", scrub: true } });
      });

      // Glide section
      const glideSection = document.querySelector(".glide-stage");
      if (glideSection) {
        const mm = gsap.matchMedia();
        mm.add("(min-width: 1000px)", () => {
          gsap.set(".glide-col-2", { xPercent: 104 });
          gsap.set(".glide-col-4", { yPercent: 104 });
          const tl = gsap.timeline({ scrollTrigger: { trigger: glideSection, start: "top top", end: "+=320%", pin: true, scrub: 1, anticipatePin: 1 } });
          tl.to(".glide-col-1", { autoAlpha: 0, scale: 0.82, duration: 1 })
            .to(".glide-col-2", { xPercent: 0, duration: 1 }, "<")
            .to(".glide-dash-hero-img", { scale: 1.14, duration: 1 }, "<")
            .to(".glide-col-2", { autoAlpha: 0, scale: 0.88, duration: 1 })
            .to(".glide-col-4", { yPercent: 0, duration: 1 }, "<");
          return () => tl.kill();
        });
      }

      // Logo stage
      const logoTiles = gsap.utils.toArray(".stack-stage .logo-tile");
      if (logoTiles.length > 0) {
        gsap.from(logoTiles, { y: 48, opacity: 0, stagger: 0.08, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: ".stack-stage", start: "top 75%" } });
      }

      // Stack cards
      const stackSection = document.querySelector(".stack-stage");
      const cards = gsap.utils.toArray(".stack-card") as HTMLElement[];
      if (stackSection && cards.length > 0) {
        const mm = gsap.matchMedia();
        mm.add("(min-width: 900px)", () => {
          const rotations = [-12, 10, -6, 5, -5, -2, 8, -7, 6, -4];
          cards.forEach((card, idx) => { gsap.set(card, { rotate: rotations[idx % rotations.length] || 0, y: window.innerHeight, x: 0 }); });
          const scrollMul = Math.max(3.8, (3.8 / 5) * cards.length);
          const trigger = ScrollTrigger.create({
            trigger: ".sticky-cards", start: "top top", end: `+=${window.innerHeight * scrollMul}`, pin: true, pinSpacing: true, scrub: 1, anticipatePin: 1,
            onUpdate: (self) => {
              const progress = self.progress;
              const total = cards.length;
              const ppc = 1 / total;
              cards.forEach((card, idx) => {
                const cardStart = idx * ppc;
                let cp = Math.min(Math.max((progress - cardStart) / ppc, 0), 1);
                let yPos = window.innerHeight * (1 - cp);
                let xPos = 0;
                if (cp === 1 && idx < total - 1) {
                  const rp = (progress - (cardStart + ppc)) / (1 - (cardStart + ppc));
                  if (rp > 0) { const dm = 1 - idx * 0.14; xPos = -window.innerWidth * 0.16 * dm * rp; yPos = -window.innerHeight * 0.16 * dm * rp; }
                }
                gsap.to(card, { y: yPos, x: xPos, duration: 0, ease: "none" });
              });
            },
          });
          return () => trigger.kill();
        });
      }

      // Split cards (Teams)
      const splitSection = document.querySelector(".split-stage");
      if (splitSection) {
        const mm = gsap.matchMedia();
        mm.add("(min-width: 1000px)", () => {
          const cardContainer = document.querySelector(".card-container") as HTMLElement;
          const stickyHeader = document.querySelector(".sticky-header h2") as HTMLElement;
          const flipCards = document.querySelectorAll(".flip-card");
          let gapActivated = false;
          let flipActivated = false;
          const gapTl = gsap.timeline({ paused: true });
          gapTl.to(cardContainer, { gap: 44, duration: 1, ease: "power3.out" }, 0)
            .to("#card-1", { x: -36, duration: 1, ease: "power3.out" }, 0)
            .to("#card-3", { x: 36, duration: 1, ease: "power3.out" }, 0)
            .to(flipCards, { borderRadius: "28px", duration: 1, ease: "power3.out" }, 0);
          const flipTl = gsap.timeline({ paused: true });
          flipTl.to(".flip-card", { rotationY: 180, duration: 1, ease: "power3.inOut", stagger: 0.08, transformOrigin: "center center" }, 0)
            .to(["#card-1", "#card-3"], { y: 24, rotationZ: (index: number) => (index === 0 ? -11 : 11), duration: 1, ease: "power3.inOut" }, 0);
          const trigger = ScrollTrigger.create({
            trigger: splitSection, start: "top top", end: `+=${window.innerHeight * 3.2}`, scrub: 1, pin: true, pinSpacing: true, anticipatePin: 1,
            onUpdate: (self) => {
              const p = self.progress;
              if (p >= 0.1 && p <= 0.35) { const hp = gsap.utils.mapRange(0.1, 0.35, 0, 1, p); gsap.set(stickyHeader, { y: gsap.utils.mapRange(0, 1, 40, 0, hp), opacity: gsap.utils.mapRange(0, 1, 0, 1, hp) }); }
              else if (p < 0.1) { gsap.set(stickyHeader, { y: 40, opacity: 0 }); }
              else { gsap.set(stickyHeader, { y: 0, opacity: 1 }); }
              if (p <= 0.35) { gsap.set(cardContainer, { width: `${gsap.utils.mapRange(0, 0.35, 96, 78, p)}%` }); }
              else { gsap.set(cardContainer, { width: "78%" }); }
              if (p >= 0.45 && !gapActivated) { gapTl.play(); gapActivated = true; }
              else if (p < 0.45 && gapActivated) { gapTl.reverse(); gapActivated = false; }
              if (p >= 0.72 && !flipActivated) { flipTl.play(); flipActivated = true; }
              else if (p < 0.72 && flipActivated) { flipTl.reverse(); flipActivated = false; }
            },
          });
          return () => { trigger.kill(); gapTl.kill(); flipTl.kill(); };
        });
      }

      // Journey section
      const journeySection = document.querySelector(".journey-stage");
      const journeyPara = document.querySelector(".journey-para");
      if (journeySection && journeyPara) {
        const split = new SplitType(journeyPara as HTMLElement, { types: "words", tagName: "span" });
        const chips = gsap.utils.toArray(".journey-chip");
        gsap.set(chips, { autoAlpha: 0, y: 16, clipPath: "inset(0 0 100% 0)" });
        const mm = gsap.matchMedia();
        mm.add("(min-width: 900px)", () => {
          const tl = gsap.timeline({ scrollTrigger: { trigger: journeySection, start: "top top", end: "+=240%", pin: true, scrub: 1, anticipatePin: 1 } });
          tl.from(split.words || [], { opacity: 0, rotate: 8, yPercent: 34, stagger: 0.05, ease: "power1.out" })
            .fromTo(".journey-media-frame", { clipPath: "inset(38% 38% 38% 38% round 1.25rem)", scale: 0.78 }, { clipPath: "inset(0% 0% 0% 0% round 1.25rem)", scale: 1, ease: "none" }, 0)
            .to(".journey-orbit", { rotate: 240, ease: "none" }, 0)
            .to(chips, { autoAlpha: 1, y: 0, clipPath: "inset(0 0 0 0)", stagger: 0.14, duration: 0.5 }, 0.2);
          return () => tl.kill();
        });
      }

      // Journey terminal float
      if (!prefersReducedMotion) {
        const el = document.querySelector(".journey-terminal-anim");
        if (el) gsap.to(el, { y: -8, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
      }

      // Pricing billing toggle
      const pricingRoot = document.querySelector(".gr-pricing");
      if (pricingRoot) {
        const buttons = pricingRoot.querySelectorAll(".gr-billing__btn");
        const priceCards = pricingRoot.querySelectorAll(".gr-price-card");
        const formatMoney = (n: string) => { const num = parseFloat(n); if (isNaN(num)) return n; return num.toFixed(2); };
        const setCycle = (cycle: string) => {
          buttons.forEach((b) => { const on = (b as HTMLElement).dataset.cycle === cycle; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
          priceCards.forEach((card) => {
            const numEl = card.querySelector(".gr-price-num") as HTMLElement | null;
            const suffixEl = card.querySelector(".gr-price-suffix") as HTMLElement | null;
            const annualLine = card.querySelector(".gr-price-card__annual") as HTMLElement | null;
            if (!numEl || numEl.hasAttribute("data-fixed")) return;
            const monthly = numEl.getAttribute("data-monthly") ?? "";
            const annualNum = numEl.getAttribute("data-annual-num");
            const annualTotal = numEl.getAttribute("data-annual-total");
            if (cycle === "monthly") {
              numEl.textContent = monthly;
              if (suffixEl) { suffixEl.hidden = false; suffixEl.textContent = "/month"; }
              if (annualLine) annualLine.hidden = true;
            } else {
              numEl.textContent = `$${formatMoney(annualNum || "")}`;
              if (suffixEl) { suffixEl.hidden = false; suffixEl.textContent = "/month"; }
              if (annualLine && annualTotal) { annualLine.hidden = false; const totalEl = annualLine.querySelector(".gr-annual-total"); if (totalEl) totalEl.textContent = `$${annualTotal}.00`; }
            }
          });
        }
        buttons.forEach((b) => { b.addEventListener("click", () => setCycle((b as HTMLElement).dataset.cycle ?? "monthly")); });
        pricingRoot.querySelectorAll(".gr-stripe").forEach((b) => {
          b.addEventListener("click", () => {
            const cycle = (pricingRoot.querySelector(".gr-billing__btn.is-active") as HTMLElement)?.dataset.cycle ?? "monthly";
            const url = cycle === "annual" ? b.getAttribute("data-stripe-a") : b.getAttribute("data-stripe-m");
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          });
        });
        setCycle("monthly");
      }

      // Testimonials
      const testimonialSection = document.querySelector(".testimonial-stage");
      const vdCards = gsap.utils.toArray(".vd-card") as HTMLElement[];
      if (testimonialSection && vdCards.length > 0) {
        const mm = gsap.matchMedia();
        mm.add("(min-width: 900px)", () => {
          const cardTl = gsap.timeline({ scrollTrigger: { trigger: testimonialSection, start: "top top", end: "+=210%", scrub: 1, pin: true, anticipatePin: 1 } });
          cardTl.from(vdCards, { yPercent: 220, stagger: 0.15, ease: "power2.out" });
          return () => cardTl.kill();
        });

        const STATE = { idle: "idle", hover: "hover", active: "active" } as const;
        let activeCard: HTMLElement | null = null;

        const lockOthers = (except: HTMLElement) => {
          vdCards.forEach((c) => { if (c !== except) gsap.to(c, { opacity: 0.45, filter: "blur(2px)", pointerEvents: "none", duration: 0.24 }); });
        };
        const unlockOthers = () => {
          vdCards.forEach((c) => gsap.to(c, { opacity: 1, filter: "blur(0px)", pointerEvents: "auto", duration: 0.24 }));
        };

        vdCards.forEach((card, index, allCards) => {
          const review = card.querySelector(".review-layer") as HTMLElement;
          const closeBtn = card.querySelector(".close-review") as HTMLElement;
          const coverMedia = card.querySelector(".card-cover img, .card-cover .cover-text") as HTMLElement;
          let state: string = STATE.idle;
          const width = card.offsetWidth;
          const height = card.offsetHeight;

          const hoverTl = gsap.timeline({ paused: true })
            .to(card, { x: index !== allCards.length - 1 ? -width / 3 : width / 3, duration: 0.28, ease: "power2.out" })
            .to(card, { x: 0, zIndex: 30, duration: 0.28, ease: "power2.inOut" });
          const openTl = gsap.timeline({ paused: true })
            .set(card, { zIndex: 70 })
            .to(card, { x: 0, y: "-2vh", width: width * 1.22, height: height * 1.16, rotationY: 180, duration: 0.7, ease: "power3.inOut" })
            .to(review, { opacity: 1, filter: "blur(0px)", duration: 0.18 }, "-=0.18");
          const closeTl = gsap.timeline({ paused: true })
            .to(review, { opacity: 0, filter: "blur(2px)", duration: 0.18 })
            .to(card, { x: 0, y: 0, width, height, rotationY: 0, duration: 0.6, ease: "power3.inOut" })
            .add(() => { state = STATE.idle; activeCard = null; card.classList.remove("active"); unlockOthers(); });

          const activateHover = () => { if (state !== STATE.idle || activeCard) return; lockOthers(card); state = STATE.hover; hoverTl.restart(); gsap.to(card, { scale: 1.04, duration: 0.25 }); if (coverMedia) gsap.to(coverMedia, { scale: 1.06, duration: 0.4 }); };
          const deactivateHover = () => { if (state !== STATE.hover) return; state = STATE.idle; unlockOthers(); hoverTl.reverse(); gsap.to(card, { scale: 1, duration: 0.25 }); if (coverMedia) gsap.to(coverMedia, { scale: 1, duration: 0.35 }); };
          const activateCard = () => { if (state === STATE.active || activeCard) return; lockOthers(card); state = STATE.active; activeCard = card; card.classList.add("active"); hoverTl.kill(); openTl.restart(); };

          card.addEventListener("mouseenter", activateHover);
          card.addEventListener("mouseleave", deactivateHover);
          card.addEventListener("click", activateCard);
          card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateCard(); } });
          if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              if (state !== STATE.active) return;
              closeTl.restart();
              gsap.to(card, { scale: 1, zIndex: "" });
              if (coverMedia) gsap.to(coverMedia, { scale: 1, duration: 0.25 });
            });
          }
        });
      }

      // Shaders
      const disposeBackdrop = initGlobalBackdropShader({ prefersReducedMotion });
      const disposeHero = initHeroEvilryuShader({ prefersReducedMotion });
      if (disposeBackdrop) cleanupRef.current.push(disposeBackdrop);
      if (disposeHero) cleanupRef.current.push(disposeHero);

      // Marquee
      initScrollVelocityMarquee({ prefersReducedMotion });

      // Refresh triggers after load
      window.addEventListener("load", () => ScrollTrigger.refresh());
      if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

      cleanupRef.current.push(() => {
        ScrollTrigger.getAll().forEach((t) => t.kill());
        gsap.globalTimeline.clear();
      });
    }

    init();

    return () => {
      cancelled = true;
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
    };
  }, []);

  return (
    <div ref={rootRef} className="gsap-landing">
      <nav className="page-nav page-nav--landing" aria-label="Primary">
        <a className="nav-brand" href="#top">
          <img className="nav-logo" src="/guardrail-logo.svg" width={120} height={24} alt="guardrail" />
        </a>
        <div className="page-nav__links-wrap">
          <nav className="page-nav__links" aria-label="On-page sections">
            <a href="#how-it-works">How it works</a>
            <a href="#teams">Teams</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#integrate">Integrate</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
        </div>
        <div className="page-nav__actions">
          <a className="page-nav__ghost" href="/auth">Log in</a>
          <a className="page-nav__signup" href="/auth?mode=signup">Sign up</a>
        </div>
        <div className="page-nav__track">
          <span className="nav-label" id="nav-section-label">Overview</span>
          <div className="nav-progress">
            <div className="nav-progress-fill" id="page-progress"></div>
          </div>
        </div>
      </nav>

      <main id="top">
        {/* Hero */}
        <section className="hero-panel hero-panel--guardrail panel" data-section="Overview">
          <div className="hero-backdrop" aria-hidden="true"></div>
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="hero-copy-frost">
                <p className="section-kicker">Ship with proof</p>
                <p className="hero-name">guardrail</p>
                <h1 id="heroTitle" className="hero-title" aria-live="polite"></h1>
                <div className="hero-cta">
                  <a className="hero-cta__primary" href="/auth?mode=signup">Get started</a>
                  <button
                    type="button"
                    className="hero-cta__cli"
                    data-copy-cli="npx @guardrail/cli init"
                    aria-label="Copy command: npx @guardrail/cli init"
                  >
                    <code className="hero-cta__cli-code">npx @guardrail/cli init</code>
                    <span className="hero-cta__cli-hint" aria-hidden="true">Copy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scroll Velocity Marquee */}
        <section
          className="scroll-velocity-marquee panel"
          data-section="Signals"
          aria-label="Scroll velocity marquee demonstration"
        >
          <div className="svm-stack">
            <div className="svm-marquee-section" id="svmMarqueeSection">
              <div className="svm-m-row" id="svmRow0"><div className="svm-m-track" id="svmTrack0"></div><span className="svm-m-row__badge">01</span></div>
              <div className="svm-m-row" id="svmRow1"><div className="svm-m-track" id="svmTrack1"></div><span className="svm-m-row__badge">02</span></div>
              <div className="svm-m-row" id="svmRow2"><div className="svm-m-track" id="svmTrack2"></div><span className="svm-m-row__badge">03</span></div>
              <div className="svm-m-row" id="svmRow3"><div className="svm-m-track" id="svmTrack3"></div><span className="svm-m-row__badge">04</span></div>
            </div>
          </div>
          <div className="svm-hud" aria-hidden="true">
            <span className="svm-hud__label">scroll velocity</span>
            <div className="svm-hud__track">
              <div className="svm-hud__fill" id="svmHudFill"></div>
            </div>
            <span className="svm-hud__val" id="svmHudVal">0 px/s</span>
          </div>
        </section>

        {/* Stats Rail */}
        <section id="stats" className="gr-landing gr-stats-rail panel" data-section="Stats">
          <div className="gr-landing__wrap">
            <div className="gr-stat-item">
              <p className="gr-stat-item__label">Classes of failure</p>
              <p className="gr-stat-item__value">40+</p>
              <p className="gr-stat-item__hint">mock data, dead routes, auth gaps, secret leaks</p>
            </div>
            <div className="gr-stat-item">
              <p className="gr-stat-item__label">Minutes to first scan</p>
              <p className="gr-stat-item__value">&lt; 3</p>
              <p className="gr-stat-item__hint">CLI init → ship check in your repo</p>
            </div>
            <div className="gr-stat-item">
              <p className="gr-stat-item__label">Where it runs</p>
              <p className="gr-stat-item__value">CI · IDE · MCP</p>
              <p className="gr-stat-item__hint">same rules from terminal to merge queue</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="gr-landing gr-how panel" data-section="How it works">
          <div className="gr-landing__wrap gr-landing__narrow">
            <h2 className="gr-how__title">
              Three steps.
              <span className="gr-how__accent">Then you ship with receipts.</span>
            </h2>
            <p className="gr-how__sub">Minutes to setup, not hours.</p>
          </div>
          <ol className="gr-how__steps gr-landing__wrap">
            <li className="gr-how__step">
              <span className="gr-how__step-num">01</span>
              <h3 className="gr-how__step-title">Install</h3>
              <p className="gr-how__step-code">npx @guardrail/cli init</p>
            </li>
            <li className="gr-how__step">
              <span className="gr-how__step-num">02</span>
              <h3 className="gr-how__step-title">Scan</h3>
              <p className="gr-how__step-code">guardrail ship</p>
            </li>
            <li className="gr-how__step">
              <span className="gr-how__step-num">03</span>
              <h3 className="gr-how__step-title">Autopilot</h3>
              <p className="gr-how__step-code">Set and forget</p>
            </li>
          </ol>
        </section>

        {/* Glide Stage */}
        <section className="glide-stage panel" data-section="Scan results">
          <div className="glide-shell">
            <div className="glide-intro">
              <p className="section-kicker glide-intro__kicker">Product surface</p>
              <h2 className="section-title">Findings that match reality—not mocks.</h2>
              <p className="glide-intro__lead">
                Severity, paths, and policy status in one place—so AI-generated optimism doesn&apos;t outrun what production actually does.
              </p>
            </div>
            <div className="glide-wrapper">
              <div className="glide-col glide-col-1">
                <div className="glide-copy glide-copy--dash-intro">
                  <p className="glide-dash-label">Severity</p>
                  <h3>See critical issues before they hit production.</h3>
                  <figure className="glide-dash-figure">
                    <img src="/assets/dash/desktop-01.png" alt="guardrail scan overview with severity breakdown" loading="lazy" />
                  </figure>
                </div>
              </div>
              <div className="glide-col glide-col-2">
                <img className="glide-dash-hero-img" src="/assets/dash/desktop-02.png" alt="guardrail findings detail with paths and rules" loading="lazy" />
              </div>
              <div className="glide-col glide-col-4">
                <div className="glide-image glide-image--orb glide-image--dash-cap">
                  <img className="glide-dash-cap-img" src="/assets/dash/desktop-04.png" alt="guardrail ship check and policy status" loading="lazy" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities / Stack Cards */}
        <section id="capabilities" className="stack-stage panel" data-section="Capabilities">
          <div className="section-head">
            <p className="section-kicker">Capabilities</p>
            <h2 className="section-title">One pipeline. Many places it actually runs.</h2>
          </div>
          <div className="sticky-cards">
            {[
              { num: "01", title: "Reality Mode", desc: 'Exercise real flows—not fixtures. Catch "green CI, broken humans" before release.' },
              { num: "02", title: "MCP + IDE", desc: "Guardrails inside Cursor, VS Code, and any MCP client." },
              { num: "03", title: "Policy gates", desc: "Block merges on severity, tier, or org rules—automatically." },
              { num: "04", title: "40+ failure classes", desc: "Mock data, dead routes, auth gaps, secret leaks—modeled for AI-built apps." },
              { num: "05", title: "CI · IDE · MCP", desc: "Same rules from terminal to merge queue—no drift between environments." },
              { num: "06", title: "guardrail ship", desc: "One command tells you if your app works—or only looks like it does." },
              { num: "07", title: "Audit-ready exports", desc: "PDFs and evidence trails your security team can file without rework." },
            ].map((card) => (
              <article key={card.num} className="stack-card">
                <div className="stack-card-media stack-card-media--mark">
                  <img src="/guardrail-logo.svg" alt="guardrail" />
                </div>
                <div className="stack-card-copy">
                  <span>{card.num}</span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Green vs reality */}
        <section className="gr-landing gr-failure panel" data-section="Green vs reality">
          <div className="gr-landing__wrap gr-failure__card">
            <div className="gr-failure__head">
              <p className="section-kicker">The usual failure mode</p>
              <h2 className="gr-failure__title">Green checks. Red reality.</h2>
              <p className="gr-failure__aside">
                We model the hand-off from AI-generated optimism to what production actually does—so you fix it while it is still cheap.
              </p>
            </div>
            <div className="gr-failure__steps">
              <div>
                <span className="gr-failure__badge">01</span>
                <h3 className="gr-failure__step-title">AI drafts the feature</h3>
                <p>Fast iterations, optimistic UI, synthetic data that &quot;looks fine.&quot;</p>
              </div>
              <div>
                <span className="gr-failure__badge">02</span>
                <h3 className="gr-failure__step-title">CI goes green</h3>
                <p>Unit mocks pass; integration is shallow; security lags behind vibe.</p>
              </div>
              <div>
                <span className="gr-failure__badge">03</span>
                <h3 className="gr-failure__step-title">guardrail says no</h3>
                <p>Reality gates, secret detection, and policy blocks on what matters.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Teams / Split Cards */}
        <section id="teams" className="split-stage panel" data-section="Teams">
          <div className="split-shell">
            <div className="sticky-header">
              <p className="section-kicker">Teams</p>
              <h2>Built for everyone who signs the release.</h2>
            </div>
            <div className="card-container">
              <article className="flip-card" id="card-1">
                <div className="card-face card-front">
                  <img src="/vs/vs-1.png" alt="Engineers shipping with guardrail" />
                </div>
                <div className="card-face card-back">
                  <span>01</span>
                  <p>Engineers: catch dead routes, mock data, and auth gaps before the merge queue—without another dashboard to babysit.</p>
                </div>
              </article>
              <article className="flip-card" id="card-2">
                <div className="card-face card-front">
                  <img src="/vs/vs-2.png" alt="Security and compliance" />
                </div>
                <div className="card-face card-back">
                  <span>02</span>
                  <p>Security: exports and evidence that map to how the app actually behaves, not how the README claims it behaves.</p>
                </div>
              </article>
              <article className="flip-card" id="card-3">
                <div className="card-face card-front">
                  <img src="/vs/vs-3.png" alt="Leads and delivery" />
                </div>
                <div className="card-face card-back">
                  <span>03</span>
                  <p>Leads: one verdict on readiness—block deploys on severity, tier, or policy; same rules in CI and IDE.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Journey / Reality */}
        <section className="journey-stage panel" data-section="Reality">
          <div className="journey-shell">
            <div className="journey-copy">
              <p className="section-kicker">Reality check</p>
              <h2 className="section-title">Go beyond static scans—exercise real user flows.</h2>
              <p className="journey-para">
                guardrail models the hand-off from AI-generated optimism to what production actually
                does. Reality Mode and ship checks catch fake features, shallow integration, and
                security drift while fixes are still cheap—then wire the same rules through CI, the
                IDE, and MCP so judgment doesn&apos;t vary by surface.
              </p>
              <div className="journey-chip-group" aria-label="guardrail highlights">
                <span className="journey-chip journey-chip--1">guardrail ship</span>
                <span className="journey-chip journey-chip--2">Reality runs</span>
                <span className="journey-chip journey-chip--3">Secret &amp; policy gates</span>
                <span className="journey-chip journey-chip--4">SARIF &amp; webhooks</span>
              </div>
            </div>
            <div className="journey-media-wrap">
              <div className="journey-orbit" aria-hidden="true">Ship with proof</div>
              <div className="journey-media-frame">
                <div className="hero-terminal hero-terminal--journey journey-terminal-anim" aria-label="guardrail CLI demo">
                  <div className="hero-terminal__glow" aria-hidden="true"></div>
                  <div className="hero-terminal__shell">
                    <div className="hero-terminal__titlebar">
                      <div className="hero-terminal__dots" aria-hidden="true">
                        <span></span><span></span><span></span>
                      </div>
                      <span className="hero-terminal__title">
                        guardrail scan <span className="hero-terminal__run">● running</span>
                      </span>
                    </div>
                    <div className="hero-terminal__body">
                      <img
                        className="hero-terminal__gif journey-media"
                        src="/terminal-demo.gif"
                        width={1200}
                        height={675}
                        alt="guardrail terminal demo"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="hero-terminal__foot">
                      <span>v1.0.0</span><span>secure</span>
                    </div>
                  </div>
                  <p className="hero-terminal__caption">Real-time security scanning in your terminal</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Integrate */}
        <section id="integrate" className="gr-landing gr-integrate strip panel" data-section="Integrate">
          <div className="gr-landing__wrap">
            <p className="gr-integrate__label">Where you work</p>
            <div className="gr-integrate__row">
              <a className="gr-integrate__cell" href="/install">
                <span className="gr-integrate__name">CLI</span>
                <span className="gr-integrate__meta">npm · brew · docker</span>
              </a>
              <a className="gr-integrate__cell" href="/vscode">
                <span className="gr-integrate__name">VS Code</span>
                <span className="gr-integrate__meta">extension</span>
              </a>
              <a className="gr-integrate__cell" href="/products/mcp">
                <span className="gr-integrate__name">MCP</span>
                <span className="gr-integrate__meta">Cursor · Claude Desktop</span>
              </a>
              <a className="gr-integrate__cell" href="/docs">
                <span className="gr-integrate__name">Docs</span>
                <span className="gr-integrate__meta">guides + API</span>
              </a>
            </div>
          </div>
        </section>

        {/* Reality Bridge */}
        <section id="reality-bridge" className="gr-landing gr-bridge panel" data-section="Bridge">
          <div className="gr-landing__wrap gr-bridge__flex">
            <div>
              <p className="section-kicker">Reality check</p>
              <p className="gr-bridge__text">
                Go beyond static scans—exercise real user flows before you tag a release.
              </p>
            </div>
            <a className="final-link gr-bridge__btn" href="/reality-check">Explore Reality Check</a>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="gr-landing gr-pricing panel" data-section="Pricing">
          <div className="gr-landing__wrap gr-pricing__inner">
            <div className="gr-pricing__intro">
              <p className="section-kicker">Pricing</p>
              <h2 className="gr-pricing__title">
                Straight numbers.
                <span className="gr-pricing__accent">No spreadsheet archaeology.</span>
              </h2>
              <p className="gr-pricing__lead">Same tiers as in-app. Upgrade when findings stop being hypothetical.</p>
            </div>
            <div className="gr-pricing__billing" role="tablist" aria-label="Billing period">
              <button type="button" className="gr-billing__btn is-active" data-cycle="monthly">Monthly</button>
              <button type="button" className="gr-billing__btn" data-cycle="annual">
                Annual <span className="gr-billing__badge">~20% off</span>
              </button>
            </div>
            <div className="gr-pricing__grid">
              <article className="gr-price-card">
                <header>
                  <h3 className="gr-price-card__name">Free</h3>
                  <p className="gr-price-card__desc">Severity counts &amp; scans — findings blurred</p>
                  <p className="gr-price-card__limit">1 project</p>
                </header>
                <div className="gr-price-card__price">
                  <span className="gr-price-num" data-fixed="">$0</span>
                  <span className="gr-price-suffix">forever</span>
                </div>
                <ul className="gr-price-card__list">
                  <li>guardrail scan — static analysis</li>
                  <li>Severity breakdown (critical / high / medium / low)</li>
                  <li>Findings blurred — upgrade for paths &amp; snippets</li>
                  <li>10 scans/month</li>
                  <li>CLI &amp; extension access</li>
                </ul>
                <a className="gr-price-card__btn gr-price-card__btn--outline" href="/auth?mode=signup">Start free</a>
              </article>
              <article className="gr-price-card">
                <header>
                  <h3 className="gr-price-card__name">Starter</h3>
                  <p className="gr-price-card__desc">Full findings — no auto-fix</p>
                  <p className="gr-price-card__limit">3 projects</p>
                </header>
                <div className="gr-price-card__price">
                  <span className="gr-price-num" data-monthly="$9.99" data-annual-num="8.00" data-annual-total="96">$9.99</span>
                  <span className="gr-price-suffix">/month</span>
                </div>
                <p className="gr-price-card__annual" hidden>
                  <span className="gr-annual-total">$96.00</span> billed yearly · <span className="gr-save">save ~20%</span>
                </p>
                <ul className="gr-price-card__list">
                  <li>Everything in Free (unblurred)</li>
                  <li>Full issue detail: paths, rules, snippets</li>
                  <li>guardrail ship, reality, gate</li>
                  <li>100 scans/mo, 20 Reality runs/mo</li>
                </ul>
                <button type="button" className="gr-price-card__btn gr-stripe" data-stripe-m="https://buy.stripe.com/8x2fZa4GZegD9QU7YW3Nm03" data-stripe-a="https://buy.stripe.com/fZu8wI4GZgoL8MQ6US3Nm04">Subscribe</button>
              </article>
              <article className="gr-price-card gr-price-card--featured">
                <p className="gr-price-card__ribbon">Most teams start here</p>
                <header>
                  <h3 className="gr-price-card__name">Pro</h3>
                  <p className="gr-price-card__desc">Auto-fix &amp; automation</p>
                  <p className="gr-price-card__limit">10 projects</p>
                </header>
                <div className="gr-price-card__price">
                  <span className="gr-price-num" data-monthly="$29.99" data-annual-num="24.00" data-annual-total="288">$29.99</span>
                  <span className="gr-price-suffix">/month</span>
                </div>
                <p className="gr-price-card__annual" hidden>
                  <span className="gr-annual-total">$288.00</span> billed yearly · <span className="gr-save">save ~20%</span>
                </p>
                <ul className="gr-price-card__list">
                  <li>Everything in Starter</li>
                  <li>guardrail fix — auto-fix</li>
                  <li>AI Agent, autopilot, MCP</li>
                  <li>500 scans, 100 Reality, 50 AI runs/mo</li>
                  <li>SARIF, API, webhooks</li>
                </ul>
                <button type="button" className="gr-price-card__btn gr-price-card__btn--primary gr-stripe" data-stripe-m="https://buy.stripe.com/cNi14g7TbegDbZ25QO3Nm05" data-stripe-a="https://buy.stripe.com/bJcMY4GZfkHgfi6US3Nm06">Subscribe</button>
              </article>
              <article className="gr-price-card">
                <header>
                  <h3 className="gr-price-card__name">Compliance</h3>
                  <p className="gr-price-card__desc">Frameworks &amp; audit-ready</p>
                  <p className="gr-price-card__limit">25 projects</p>
                </header>
                <div className="gr-price-card__price">
                  <span className="gr-price-num" data-monthly="$59.99" data-annual-num="48.00" data-annual-total="576">$59.99</span>
                  <span className="gr-price-suffix">/month</span>
                </div>
                <p className="gr-price-card__annual" hidden>
                  <span className="gr-annual-total">$576.00</span> billed yearly · <span className="gr-save">save ~20%</span>
                </p>
                <ul className="gr-price-card__list">
                  <li>Everything in Pro</li>
                  <li>SOC2, HIPAA, GDPR, PCI, NIST, ISO 27001</li>
                  <li>PDF reports, deploy hooks</li>
                  <li>Higher scan &amp; Reality quotas</li>
                  <li>10 team seats included</li>
                </ul>
                <button type="button" className="gr-price-card__btn gr-stripe" data-stripe-m="https://buy.stripe.com/cNi5kwflD0pN4wAfro3Nm07" data-stripe-a="https://buy.stripe.com/14A8wI4GZ4G34wAgvs3Nm08">Subscribe</button>
              </article>
            </div>
            <p className="gr-pricing__foot">Cancel anytime. Questions? <a href="/support">Talk to us</a>.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="gr-landing gr-faq panel" data-section="FAQ">
          <div className="gr-landing__wrap gr-faq__wrap">
            <div className="gr-faq__intro">
              <h2 className="gr-faq__title">
                Questions?
                <span className="gr-faq__accent">Answers.</span>
              </h2>
              <p className="gr-faq__sub">Can&apos;t find what you need? <a href="/support">Reach out to our team</a>.</p>
            </div>
            <div className="gr-faq__list">
              <details className="gr-faq__item">
                <summary>What is guardrail?</summary>
                <p>A tool that verifies your AI-built app actually works before you ship it.</p>
              </details>
              <details className="gr-faq__item">
                <summary>How does it work?</summary>
                <p>Run one command. guardrail tests your app, finds issues, and tells you exactly what to fix.</p>
              </details>
              <details className="gr-faq__item">
                <summary>Is my code secure?</summary>
                <p>Your code never leaves your machine. Everything runs locally.</p>
              </details>
              <details className="gr-faq__item">
                <summary>Which IDEs work?</summary>
                <p>Cursor, VS Code, Claude Desktop, Windsurf, and any MCP-compatible editor.</p>
              </details>
              <details className="gr-faq__item">
                <summary>How long to setup?</summary>
                <p>About two minutes. Run the init command and you&apos;re ready.</p>
              </details>
              <details className="gr-faq__item">
                <summary>Multiple projects?</summary>
                <p>Yes. guardrail learns patterns across your repos.</p>
              </details>
            </div>
          </div>
        </section>

        {/* Testimonials / Proof Cards */}
        <section className="testimonial-stage panel" data-section="Proof">
          <div className="testimonial-pin-box">
            <article className="vd-card rotate-4" tabIndex={0} aria-label="Open details for Install">
              <div className="card-cover card-cover--text">
                <div className="cover-text"><strong>Install</strong><span>Minutes to first scan</span></div>
              </div>
              <div className="review-layer">
                <div className="review-content">
                  <span className="review-tag">CLI</span>
                  <p>Run <code>npx @guardrail/cli init</code> and get to a first ship check in under three minutes—local execution, no upload required.</p>
                  <button className="close-review" type="button" aria-label="Close review">Close</button>
                </div>
              </div>
            </article>
            <article className="vd-card rotate--10" tabIndex={0} aria-label="Open details for Scan">
              <div className="card-cover card-cover--text">
                <div className="cover-text"><strong>Scan</strong><span>Static + reality</span></div>
              </div>
              <div className="review-layer">
                <div className="review-content">
                  <span className="review-tag">guardrail ship</span>
                  <p>One command surfaces broken auth, dead routes, mock data, and leaked secrets before users do—so &quot;green CI&quot; isn&apos;t lying to you.</p>
                  <button className="close-review" type="button" aria-label="Close review">Close</button>
                </div>
              </div>
            </article>
            <article className="vd-card rotate--4" tabIndex={0} aria-label="Open details for Integrations">
              <div className="card-cover card-cover--text">
                <div className="cover-text"><strong>Integrations</strong><span>Where you work</span></div>
              </div>
              <div className="review-layer">
                <div className="review-content">
                  <span className="review-tag">IDE · CI · MCP</span>
                  <p>Same rules in Cursor, VS Code, Claude Desktop, GitHub Actions, and any MCP client—no duplicate policy spreadsheets.</p>
                  <button className="close-review" type="button" aria-label="Close review">Close</button>
                </div>
              </div>
            </article>
            <article className="vd-card rotate--3" tabIndex={0} aria-label="Open details for Trust">
              <div className="card-cover card-cover--text">
                <div className="cover-text"><strong>Trust</strong><span>Local-first</span></div>
              </div>
              <div className="review-layer">
                <div className="review-content">
                  <span className="review-tag">Your machine</span>
                  <p>Your code stays local. Run scans and Reality checks without handing the repo to a black box you don&apos;t control.</p>
                  <button className="close-review" type="button" aria-label="Close review">Close</button>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-panel panel" data-section="Ship">
          <div className="final-copy">
            <p className="section-kicker">Get started</p>
            <h2 className="final-title">Proof beats polish. Ship with guardrail.</h2>
            <p className="final-body">
              Start free, wire CI, and let Reality Mode argue with your next deploy. Catch fake features and exposed secrets before your users do—same tiers in-app, upgrade when findings stop being hypothetical.
            </p>
            <div className="final-links">
              <a className="final-link" href="/auth?mode=signup">Sign up</a>
              <a className="final-link" href="/install">Install</a>
              <a className="final-link" href="/docs">Docs</a>
              <a className="final-link" href="#top">Back to top</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
