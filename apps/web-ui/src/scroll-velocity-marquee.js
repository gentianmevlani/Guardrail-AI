import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const ROW_CONFIGS = [
  {
    direction: 1,
    baseSpeed: 0.5,
    words: [
      { text: "GUARDRAIL", mod: "" },
      { text: "✦", mod: "sep" },
      { text: "SHIP", mod: "svm-m-word--accent" },
      { text: "✦", mod: "sep" },
      { text: "SCAN", mod: "svm-m-word--outline" },
      { text: "✦", mod: "sep" },
      { text: "REALITY", mod: "" },
      { text: "✦", mod: "sep" },
      { text: "SECRETS", mod: "svm-m-word--accent" },
      { text: "✦", mod: "sep" },
      { text: "POLICY", mod: "svm-m-word--outline" },
      { text: "✦", mod: "sep" }
    ]
  },
  {
    direction: -1,
    baseSpeed: 0.48,
    words: [
      { text: "CURSOR", mod: "" },
      { text: "◆", mod: "sep" },
      { text: "VS CODE", mod: "svm-m-word--accent" },
      { text: "◆", mod: "sep" },
      { text: "MCP", mod: "svm-m-word--outline" },
      { text: "◆", mod: "sep" },
      { text: "GITHUB", mod: "" },
      { text: "◆", mod: "sep" },
      { text: "CLI", mod: "svm-m-word--accent" },
      { text: "◆", mod: "sep" },
      { text: "SARIF", mod: "svm-m-word--outline" },
      { text: "◆", mod: "sep" }
    ]
  },
  {
    direction: 1,
    baseSpeed: 0.65,
    words: [
      { text: "MOCK DATA", mod: "" },
      { text: "▸", mod: "sep" },
      { text: "DEAD ROUTES", mod: "svm-m-word--accent" },
      { text: "▸", mod: "sep" },
      { text: "AUTH GAPS", mod: "svm-m-word--outline" },
      { text: "▸", mod: "sep" },
      { text: "CI GREEN", mod: "" },
      { text: "▸", mod: "sep" },
      { text: "RED REALITY", mod: "svm-m-word--accent" },
      { text: "▸", mod: "sep" },
      { text: "PROOF", mod: "svm-m-word--outline" },
      { text: "▸", mod: "sep" }
    ]
  },
  {
    direction: -1,
    baseSpeed: 0.5,
    words: [
      { text: "AUTOPILOT", mod: "" },
      { text: "●", mod: "sep" },
      { text: "AUTO-FIX", mod: "svm-m-word--accent" },
      { text: "●", mod: "sep" },
      { text: "WEBHOOKS", mod: "svm-m-word--outline" },
      { text: "●", mod: "sep" },
      { text: "AUDIT", mod: "" },
      { text: "●", mod: "sep" },
      { text: "TEAMS", mod: "svm-m-word--accent" },
      { text: "●", mod: "sep" },
      { text: "LOCAL", mod: "svm-m-word--outline" },
      { text: "●", mod: "sep" }
    ]
  }
];

function renderSet(trackEl, words) {
  const frag = document.createDocumentFragment();
  words.forEach(({ text, mod }) => {
    const span = document.createElement("span");
    if (mod === "sep") {
      span.className = "svm-m-sep";
    } else {
      span.className = ("svm-m-word " + mod).trim();
    }
    span.textContent = text;
    frag.appendChild(span);
  });
  trackEl.appendChild(frag);
}

const MAX_SCROLL_VEL = 2500;
const BOOST_FACTOR = 10;

export function initScrollVelocityMarquee({ prefersReducedMotion }) {
  const root = document.querySelector(".scroll-velocity-marquee");
  if (!root) {
    return;
  }

  const marqueeRows = ROW_CONFIGS.map((cfg, i) => {
    const trackEl = document.getElementById(`svmTrack${i}`);
    if (!trackEl) {
      return null;
    }
    renderSet(trackEl, cfg.words);
    return {
      trackEl,
      cfg,
      setW: 0,
      x: 0,
      speed: cfg.baseSpeed * cfg.direction
    };
  }).filter(Boolean);

  if (marqueeRows.length === 0) {
    return;
  }

  function buildTracks() {
    marqueeRows.forEach((row) => {
      row.trackEl.innerHTML = "";
      renderSet(row.trackEl, row.cfg.words);

      const firstSetW = row.trackEl.scrollWidth;
      row.setW = firstSetW;

      const copies = Math.ceil((window.innerWidth * 3) / firstSetW) + 1;
      for (let i = 1; i < copies; i++) {
        renderSet(row.trackEl, row.cfg.words);
      }

      if (row.cfg.direction === -1) {
        row.x = -row.setW * Math.floor(copies / 2);
      } else {
        row.x = 0;
      }

      gsap.set(row.trackEl, { x: row.x });
    });
    ScrollTrigger.refresh();
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      buildTracks();
    });
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      buildTracks();
    }, 150);
  });

  const hudFill = document.getElementById("svmHudFill");
  const hudVal = document.getElementById("svmHudVal");
  const hud = root.querySelector(".svm-hud");

  if (prefersReducedMotion) {
    if (hud) {
      hud.style.display = "none";
    }
    return;
  }

  if (hud) {
    hud.style.opacity = "0";
    hud.style.visibility = "hidden";
    hud.style.transition = "opacity 0.35s ease";
  }

  ScrollTrigger.create({
    trigger: root,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => {
      if (!hud) {
        return;
      }
      if (self.isActive) {
        hud.style.visibility = "visible";
        hud.style.opacity = "1";
      } else {
        hud.style.opacity = "0";
        window.requestAnimationFrame(() => {
          if (!self.isActive) {
            hud.style.visibility = "hidden";
          }
        });
      }
    }
  });

  const speedSetters = marqueeRows.map((row) =>
    gsap.quickTo(row, "speed", {
      duration: 0.7,
      ease: "power3.out"
    })
  );

  const tickerFn = () => {
    marqueeRows.forEach((row) => {
      if (!row.setW) {
        return;
      }

      row.x -= row.speed;

      if (row.x <= -row.setW) {
        row.x += row.setW;
      }
      if (row.x >= 0) {
        row.x -= row.setW;
      }

      gsap.set(row.trackEl, { x: row.x });
    });
  };

  gsap.ticker.add(tickerFn);

  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate(self) {
      const rawVel = self.getVelocity();
      const absVel = Math.abs(rawVel);

      if (hudFill) {
        const pct = Math.min((absVel / MAX_SCROLL_VEL) * 100, 100);
        hudFill.style.width = pct + "%";
      }
      if (hudVal) {
        hudVal.textContent = `${Math.round(absVel)} px/s`;
      }

      const clamped = Math.max(-MAX_SCROLL_VEL, Math.min(MAX_SCROLL_VEL, rawVel));
      const norm = clamped / MAX_SCROLL_VEL;

      marqueeRows.forEach((row, i) => {
        const { baseSpeed, direction } = row.cfg;
        const boost = norm * BOOST_FACTOR * direction;
        const target = baseSpeed * direction + boost;
        speedSetters[i](target);
      });
    }
  });
}
