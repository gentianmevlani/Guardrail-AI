"use client";

import { useCallback, useState } from "react";
import type { CSSProperties } from "react";

const hidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

const visible: CSSProperties = {
  position: "fixed",
  zIndex: 100,
  left: 16,
  top: 16,
  padding: "8px 16px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  borderRadius: 6,
  textDecoration: "none",
  clip: "auto",
  width: "auto",
  height: "auto",
  margin: 0,
  overflow: "visible",
  whiteSpace: "normal",
};

/**
 * Skip links that work even when global CSS / Tailwind fails to load
 * (sr-only relies on compiled utilities).
 */
export function SkipLinks() {
  const [active, setActive] = useState<"main" | "nav" | null>(null);

  const onBlur = useCallback(() => {
    setActive(null);
  }, []);

  return (
    <>
      <a
        href="#main-content"
        style={active === "main" ? visible : hidden}
        onFocus={() => setActive("main")}
        onBlur={onBlur}
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        style={
          active === "nav"
            ? { ...visible, left: 200 }
            : hidden
        }
        onFocus={() => setActive("nav")}
        onBlur={onBlur}
      >
        Skip to navigation
      </a>
    </>
  );
}
