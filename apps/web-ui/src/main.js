import "./style.css";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import SplitType from "split-type";
import { initGlobalBackdropShader } from "./global-backdrop-shader.js";
import { initHeroEvilryuShader } from "./hero-evilryu-shader.js";
import { initScrollVelocityMarquee } from "./scroll-velocity-marquee.js";

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const HERO_LINES = [
  { pre: "catch fake features and", highlight: "broken auth", post: "before users do" },
  { pre: "one command —", highlight: "guardrail ship", post: "with receipts" },
  { pre: "same rules from", highlight: "CI", post: "to IDE to MCP" },
  { pre: "built with AI?", highlight: "Ship", post: "with proof." }
];

initSmoothScroll();
initPageChrome();
const disposeGlobalBackdropShader = initGlobalBackdropShader({ prefersReducedMotion });
const disposeHeroEvilryuShader = initHeroEvilryuShader({ prefersReducedMotion });
initHeroCta();
initHeroSequence();
initFillRows();
initGlideSection();
initLogoStage();
initStackCards();
initSplitCards();
initJourneySection();
initJourneyTerminalFloat();
initPricingBilling();
initTestimonials();
initScrollVelocityMarquee({ prefersReducedMotion });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeGlobalBackdropShader?.();
    disposeHeroEvilryuShader?.();
  });
}

window.addEventListener("load", () => {
  ScrollTrigger.refresh();
});

if (document.fonts?.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

function initSmoothScroll() {
  if (prefersReducedMotion) {
    return;
  }

  const lenis = new Lenis({
    autoRaf: false,
    smoothWheel: true,
    lerp: 0.08
  });

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
}

function initPageChrome() {
  ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      const progress = document.getElementById("page-progress");
      progress.style.width = `${self.progress * 100}%`;
    }
  });

  document.querySelectorAll("[data-section]").forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top center",
      end: "bottom center",
      onToggle: (self) => {
        if (self.isActive) {
          document.getElementById("nav-section-label").textContent =
            section.dataset.section;
        }
      }
    });
  });
}

function initHeroCta() {
  const btn = document.querySelector("[data-copy-cli]");
  if (!btn) {
    return;
  }

  const text = btn.getAttribute("data-copy-cli") ?? "";
  const hint = btn.querySelector(".hero-cta__cli-hint");

  btn.addEventListener("click", async () => {
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add("is-copied");
      if (hint) {
        hint.textContent = "Copied";
      }
      window.setTimeout(() => {
        btn.classList.remove("is-copied");
        if (hint) {
          hint.textContent = "Copy";
        }
      }, 2000);
    } catch {
      /* ignore */
    }
  });
}

function initHeroSequence() {
  const titleEl = document.getElementById("heroTitle");

  if (!titleEl) {
    return;
  }

  if (prefersReducedMotion) {
    const line = HERO_LINES[0];
    titleEl.innerHTML = `${line.pre} <span class="accent">${line.highlight}</span> ${line.post}`;
    return;
  }

  let index = 0;

  const runAnimation = () => {
    const sentence = HERO_LINES[index];
    titleEl.innerHTML = `${sentence.pre} <span class="accent">${sentence.highlight}</span> ${sentence.post}`;

    const sentenceSplit = new SplitType(titleEl, {
      types: "words, chars",
      tagName: "span"
    });

    const accentEl = titleEl.querySelector(".accent");
    const accentSplit = accentEl
      ? new SplitType(accentEl, { types: "chars", tagName: "span" })
      : null;

    gsap.from(sentenceSplit.words, {
      y: -96,
      opacity: 0,
      rotation: () => gsap.utils.random(-20, 20),
      duration: 0.72,
      ease: "back.out(1.4)",
      stagger: 0.08
    });

    const timeline = gsap.timeline({ delay: 0.8 });

    if (accentSplit) {
      timeline.to(accentSplit.chars, {
        x: () => gsap.utils.random(-220, 220),
        y: () => gsap.utils.random(-180, 220),
        rotate: () => gsap.utils.random(-220, 220),
        opacity: 0,
        scale: 0.2,
        duration: 1.25,
        ease: "power3.out",
        stagger: 0.02,
        delay: 1.1
      });
    }

    timeline
      .to(
        sentenceSplit.words,
        {
          y: 96,
          opacity: 0,
          rotation: () => gsap.utils.random(-20, 20),
          duration: 0.6,
          ease: "back.in(1.2)",
          stagger: 0.06
        },
        accentSplit ? "<0.18" : "+=1.1"
      )
      .call(() => {
        accentSplit?.revert();
        sentenceSplit.revert();
        index = (index + 1) % HERO_LINES.length;
        runAnimation();
      });
  };

  runAnimation();

  gsap.from(".hero-copy > *", {
    y: 32,
    opacity: 0,
    duration: 1,
    ease: "power3.out",
    stagger: 0.12
  });
}

function initFillRows() {
  gsap.utils.toArray(".fill-row").forEach((row) => {
    const fill = row.querySelector(".fill");

    gsap.fromTo(
      fill,
      { backgroundSize: "0% 100%, 100% 100%" },
      {
        backgroundSize: "100% 100%, 100% 100%",
        ease: "none",
        scrollTrigger: {
          trigger: row,
          start: "top 88%",
          end: "bottom 46%",
          scrub: true
        }
      }
    );
  });
}

function initGlideSection() {
  const section = document.querySelector(".glide-stage");

  if (!section) {
    return;
  }

  const mm = gsap.matchMedia();

  mm.add("(min-width: 1000px)", () => {
    gsap.set(".glide-col-2", { xPercent: 104 });
    gsap.set(".glide-col-4", { yPercent: 104 });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=320%",
        pin: true,
        scrub: 1,
        anticipatePin: 1
      }
    });

    timeline
      .to(".glide-col-1", { autoAlpha: 0, scale: 0.82, duration: 1 })
      .to(".glide-col-2", { xPercent: 0, duration: 1 }, "<")
      .to(".glide-dash-hero-img", { scale: 1.14, duration: 1 }, "<")
      .to(".glide-col-2", { autoAlpha: 0, scale: 0.88, duration: 1 })
      .to(".glide-col-4", { yPercent: 0, duration: 1 }, "<");

    return () => {
      timeline.kill();
    };
  });
}

function initLogoStage() {
  const tiles = gsap.utils.toArray(".stack-stage .logo-tile");

  if (tiles.length === 0) {
    return;
  }

  gsap.from(tiles, {
    y: 48,
    opacity: 0,
    stagger: 0.08,
    duration: 0.8,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".stack-stage",
      start: "top 75%"
    }
  });
}

function initStackCards() {
  const section = document.querySelector(".stack-stage");
  const cards = gsap.utils.toArray(".stack-card");

  if (!section || cards.length === 0) {
    return;
  }

  const mm = gsap.matchMedia();

  mm.add("(min-width: 900px)", () => {
    const rotations = [-12, 10, -6, 5, -5, -2, 8, -7, 6, -4];

    cards.forEach((card, index) => {
      gsap.set(card, {
        rotate: rotations[index % rotations.length] || 0,
        y: window.innerHeight,
        x: 0
      });
    });

    const scrollMultiplier = Math.max(3.8, (3.8 / 5) * cards.length);

    const trigger = ScrollTrigger.create({
      trigger: ".sticky-cards",
      start: "top top",
      end: `+=${window.innerHeight * scrollMultiplier}`,
      pin: true,
      pinSpacing: true,
      scrub: 1,
      anticipatePin: 1,
      onUpdate: (self) => {
        const progress = self.progress;
        const totalCards = cards.length;
        const progressPerCard = 1 / totalCards;

        cards.forEach((card, index) => {
          const cardStart = index * progressPerCard;
          let cardProgress = (progress - cardStart) / progressPerCard;
          cardProgress = Math.min(Math.max(cardProgress, 0), 1);

          let yPos = window.innerHeight * (1 - cardProgress);
          let xPos = 0;

          if (cardProgress === 1 && index < totalCards - 1) {
            const remainingProgress =
              (progress - (cardStart + progressPerCard)) /
              (1 - (cardStart + progressPerCard));

            if (remainingProgress > 0) {
              const distanceMultiplier = 1 - index * 0.14;
              xPos = -window.innerWidth * 0.16 * distanceMultiplier * remainingProgress;
              yPos = -window.innerHeight * 0.16 * distanceMultiplier * remainingProgress;
            }
          }

          gsap.to(card, {
            y: yPos,
            x: xPos,
            duration: 0,
            ease: "none"
          });
        });
      }
    });

    return () => {
      trigger.kill();
    };
  });
}

function initSplitCards() {
  const section = document.querySelector(".split-stage");

  if (!section) {
    return;
  }

  const mm = gsap.matchMedia();

  mm.add("(min-width: 1000px)", () => {
    const cardContainer = document.querySelector(".card-container");
    const stickyHeader = document.querySelector(".sticky-header h2");
    const cards = document.querySelectorAll(".flip-card");

    let gapActivated = false;
    let flipActivated = false;

    const gapTl = gsap.timeline({ paused: true });
    gapTl
      .to(cardContainer, { gap: 44, duration: 1, ease: "power3.out" }, 0)
      .to("#card-1", { x: -36, duration: 1, ease: "power3.out" }, 0)
      .to("#card-3", { x: 36, duration: 1, ease: "power3.out" }, 0)
      .to(cards, { borderRadius: "28px", duration: 1, ease: "power3.out" }, 0);

    const flipTl = gsap.timeline({ paused: true });
    flipTl
      .to(
        ".flip-card",
        {
          rotationY: 180,
          duration: 1,
          ease: "power3.inOut",
          stagger: 0.08,
          transformOrigin: "center center"
        },
        0
      )
      .to(
        ["#card-1", "#card-3"],
        {
          y: 24,
          rotationZ: (index) => (index === 0 ? -11 : 11),
          duration: 1,
          ease: "power3.inOut"
        },
        0
      );

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: `+=${window.innerHeight * 3.2}`,
      scrub: 1,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        const progress = self.progress;

        if (progress >= 0.1 && progress <= 0.35) {
          const headerProgress = gsap.utils.mapRange(0.1, 0.35, 0, 1, progress);
          const yValue = gsap.utils.mapRange(0, 1, 40, 0, headerProgress);
          const opacityValue = gsap.utils.mapRange(0, 1, 0, 1, headerProgress);
          gsap.set(stickyHeader, { y: yValue, opacity: opacityValue });
        } else if (progress < 0.1) {
          gsap.set(stickyHeader, { y: 40, opacity: 0 });
        } else {
          gsap.set(stickyHeader, { y: 0, opacity: 1 });
        }

        if (progress <= 0.35) {
          const widthPercentage = gsap.utils.mapRange(0, 0.35, 96, 78, progress);
          gsap.set(cardContainer, { width: `${widthPercentage}%` });
        } else {
          gsap.set(cardContainer, { width: "78%" });
        }

        if (progress >= 0.45 && !gapActivated) {
          gapTl.play();
          gapActivated = true;
        } else if (progress < 0.45 && gapActivated) {
          gapTl.reverse();
          gapActivated = false;
        }

        if (progress >= 0.72 && !flipActivated) {
          flipTl.play();
          flipActivated = true;
        } else if (progress < 0.72 && flipActivated) {
          flipTl.reverse();
          flipActivated = false;
        }
      }
    });

    return () => {
      trigger.kill();
      gapTl.kill();
      flipTl.kill();
    };
  });
}

function initJourneySection() {
  const section = document.querySelector(".journey-stage");
  const paragraph = document.querySelector(".journey-para");

  if (!section || !paragraph) {
    return;
  }

  const split = new SplitType(paragraph, { types: "words", tagName: "span" });
  const chips = gsap.utils.toArray(".journey-chip");
  gsap.set(chips, {
    autoAlpha: 0,
    y: 16,
    clipPath: "inset(0 0 100% 0)"
  });

  const mm = gsap.matchMedia();

  mm.add("(min-width: 900px)", () => {
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=240%",
        pin: true,
        scrub: 1,
        anticipatePin: 1
      }
    });

    timeline
      .from(split.words, {
        opacity: 0,
        rotate: 8,
        yPercent: 34,
        stagger: 0.05,
        ease: "power1.out"
      })
      .fromTo(
        ".journey-media-frame",
        {
          clipPath: "inset(38% 38% 38% 38% round 1.25rem)",
          scale: 0.78
        },
        {
          clipPath: "inset(0% 0% 0% 0% round 1.25rem)",
          scale: 1,
          ease: "none"
        },
        0
      )
      .to(
        ".journey-orbit",
        {
          rotate: 240,
          ease: "none"
        },
        0
      )
      .to(
        chips,
        {
          autoAlpha: 1,
          y: 0,
          clipPath: "inset(0 0 0 0)",
          stagger: 0.14,
          duration: 0.5
        },
        0.2
      );

    return () => {
      timeline.kill();
    };
  });
}

function initJourneyTerminalFloat() {
  if (prefersReducedMotion) {
    return;
  }
  const el = document.querySelector(".journey-terminal-anim");
  if (!el) {
    return;
  }
  gsap.to(el, {
    y: -8,
    duration: 3.2,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1
  });
}

function initPricingBilling() {
  const root = document.querySelector(".gr-pricing");
  if (!root) {
    return;
  }

  const buttons = root.querySelectorAll(".gr-billing__btn");
  const cards = root.querySelectorAll(".gr-price-card");

  function formatMoney(n) {
    const num = Number.parseFloat(n);
    if (Number.isNaN(num)) {
      return n;
    }
    return num.toFixed(2);
  }

  function setCycle(cycle) {
    buttons.forEach((b) => {
      const on = b.dataset.cycle === cycle;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    cards.forEach((card) => {
      const numEl = card.querySelector(".gr-price-num");
      const suffixEl = card.querySelector(".gr-price-suffix");
      const annualLine = card.querySelector(".gr-price-card__annual");
      if (!numEl || numEl.hasAttribute("data-fixed")) {
        return;
      }

      const monthly = numEl.getAttribute("data-monthly") ?? "";
      const annualNum = numEl.getAttribute("data-annual-num");
      const annualTotal = numEl.getAttribute("data-annual-total");

      if (cycle === "monthly") {
        numEl.textContent = monthly;
        if (suffixEl) {
          suffixEl.hidden = false;
          suffixEl.textContent = "/month";
        }
        if (annualLine) {
          annualLine.hidden = true;
        }
      } else {
        numEl.textContent = `$${formatMoney(annualNum)}`;
        if (suffixEl) {
          suffixEl.hidden = false;
          suffixEl.textContent = "/month";
        }
        if (annualLine && annualTotal) {
          annualLine.hidden = false;
          const totalEl = annualLine.querySelector(".gr-annual-total");
          if (totalEl) {
            totalEl.textContent = `$${annualTotal}.00`;
          }
        }
      }
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setCycle(btn.dataset.cycle ?? "monthly"));
  });

  root.querySelectorAll(".gr-stripe").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cycle =
        root.querySelector(".gr-billing__btn.is-active")?.dataset.cycle ?? "monthly";
      const url =
        cycle === "annual"
          ? btn.getAttribute("data-stripe-a")
          : btn.getAttribute("data-stripe-m");
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    });
  });

  setCycle("monthly");
}

function initTestimonials() {
  const section = document.querySelector(".testimonial-stage");
  const cards = gsap.utils.toArray(".vd-card");

  if (!section || cards.length === 0) {
    return;
  }

  const mm = gsap.matchMedia();

  mm.add("(min-width: 900px)", () => {
    const cardTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=210%",
        scrub: 1,
        pin: true,
        anticipatePin: 1
      }
    });

    cardTimeline.from(cards, {
      yPercent: 220,
      stagger: 0.15,
      ease: "power2.out"
    });

    return () => {
      cardTimeline.kill();
    };
  });

  const STATE = {
    idle: "idle",
    hover: "hover",
    active: "active"
  };

  let activeCard = null;

  cards.forEach((card, index, allCards) => {
    const review = card.querySelector(".review-layer");
    const closeBtn = card.querySelector(".close-review");
    const coverMedia = card.querySelector(".card-cover img, .card-cover .cover-text");

    let state = STATE.idle;
    const width = card.offsetWidth;
    const height = card.offsetHeight;

    const hoverTl = gsap
      .timeline({ paused: true })
      .to(card, {
        x: index !== allCards.length - 1 ? -width / 3 : width / 3,
        duration: 0.28,
        ease: "power2.out"
      })
      .to(card, { x: 0, zIndex: 30, duration: 0.28, ease: "power2.inOut" });

    const openTl = gsap
      .timeline({ paused: true })
      .set(card, { zIndex: 70 })
      .to(card, {
        x: 0,
        y: "-2vh",
        width: width * 1.22,
        height: height * 1.16,
        rotationY: 180,
        duration: 0.7,
        ease: "power3.inOut"
      })
      .to(review, { opacity: 1, filter: "blur(0px)", duration: 0.18 }, "-=0.18");

    const closeTl = gsap
      .timeline({ paused: true })
      .to(review, { opacity: 0, filter: "blur(2px)", duration: 0.18 })
      .to(card, {
        x: 0,
        y: 0,
        width,
        height,
        rotationY: 0,
        duration: 0.6,
        ease: "power3.inOut"
      })
      .add(() => {
        state = STATE.idle;
        activeCard = null;
        card.classList.remove("active");
        unlockOthers();
      });

    const activateHover = () => {
      if (state !== STATE.idle || activeCard) {
        return;
      }

      lockOthers(card);
      state = STATE.hover;
      hoverTl.restart();
      gsap.to(card, { scale: 1.04, duration: 0.25 });
      if (coverMedia) {
        gsap.to(coverMedia, { scale: 1.06, duration: 0.4 });
      }
    };

    const deactivateHover = () => {
      if (state !== STATE.hover) {
        return;
      }

      state = STATE.idle;
      unlockOthers();
      hoverTl.reverse();
      gsap.to(card, { scale: 1, duration: 0.25 });
      if (coverMedia) {
        gsap.to(coverMedia, { scale: 1, duration: 0.35 });
      }
    };

    const activateCard = () => {
      if (state === STATE.active || activeCard) {
        return;
      }

      lockOthers(card);
      state = STATE.active;
      activeCard = card;
      card.classList.add("active");
      hoverTl.kill();
      openTl.restart();
    };

    card.addEventListener("mouseenter", activateHover);
    card.addEventListener("mouseleave", deactivateHover);
    card.addEventListener("focus", activateHover);
    card.addEventListener("blur", deactivateHover);
    card.addEventListener("click", activateCard);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateCard();
      }
    });

    closeBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (state !== STATE.active) {
        return;
      }

      closeTl.restart();
      gsap.to(card, { scale: 1, zIndex: "" });
      if (coverMedia) {
        gsap.to(coverMedia, { scale: 1, duration: 0.25 });
      }
    });
  });

  function lockOthers(except) {
    cards.forEach((card) => {
      if (card !== except) {
        gsap.to(card, {
          opacity: 0.45,
          filter: "blur(2px)",
          pointerEvents: "none",
          duration: 0.24
        });
      }
    });
  }

  function unlockOthers() {
    cards.forEach((card) => {
      gsap.to(card, {
        opacity: 1,
        filter: "blur(0px)",
        pointerEvents: "auto",
        duration: 0.24
      });
    });
  }
}
