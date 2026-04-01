"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const pathLabels: Record<string, string> = {
  dashboard: "Overview",
  "ship-check": "Ship Check",
  runs: "Runs",
  policies: "Policies",
  findings: "Findings",
  guardrails: "Guardrails",
  compliance: "Compliance",
  enforcement: "Enforcement",
  audit: "Audit Log",
  setup: "Setup Wizard",
  integrations: "Integrations",
  activity: "Activity",
  billing: "Billing",
  settings: "Settings",
  profile: "Profile",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  
  if (!pathname || pathname === "/dashboard") {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  
  const breadcrumbs: BreadcrumbItem[] = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    
    // Check if it's a dynamic segment (like run ID)
    const isDynamic = segment.startsWith("run-") || segment.match(/^[a-f0-9-]{8,}$/);
    
    let label = pathLabels[segment] || segment;
    if (isDynamic) {
      label = segment.length > 12 ? `${segment.slice(0, 12)}...` : segment;
    }

    return {
      label,
      href: isLast ? undefined : href,
    };
  });

  return (
    <nav className="flex items-center gap-1 text-sm mb-4">
      <Link
        href="/dashboard"
        className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      
      {breadcrumbs.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
          {item.href ? (
            <Link
              href={item.href}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-zinc-300 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
