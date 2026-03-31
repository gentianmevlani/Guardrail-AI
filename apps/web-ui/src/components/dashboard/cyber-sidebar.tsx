"use client";

import { useDashboardQueryContext } from "@/context/dashboard-query-context";
import { useGitHub } from "@/context/github-context";
import { cn } from "@/lib/utils";
import {
  Brain,
  Cpu,
  FileText,
  Fingerprint,
  Key,
  LayoutDashboard,
  Lock,
  Network,
  Plug,
  RefreshCw,
  Rocket,
  Shield,
  Terminal,
  type LucideIcon,
  LifeBuoy,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const mainNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Threats", href: "/findings", icon: Shield },
  { label: "Network", href: "/integrations", icon: Network },
  { label: "Identity", href: "/team", icon: Fingerprint },
  { label: "Vault", href: "/vault", icon: Lock },
];

const footerNav: NavItem[] = [
  { label: "Updates", href: "/runs", icon: RefreshCw },
  { label: "Support", href: "/cli", icon: LifeBuoy },
];

export function CyberSidebar() {
  const pathname = usePathname();
  const { connected } = useGitHub();
  const { isScanning } = useDashboardQueryContext();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  return (
    <aside className="h-[calc(100vh-3.5rem)] w-64 border-r border-white/5 sticky top-14 left-0 bg-slate-950 flex-col py-6 hidden lg:flex">
      {/* Session Info */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400">
          <Terminal className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-slate-200 font-display font-bold text-sm tracking-tight">
            Guardrail
          </h3>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest flex items-center gap-1">
            <span
              className={cn(
                "w-1 h-1 rounded-full",
                isScanning
                  ? "bg-amber-400 animate-pulse"
                  : connected
                    ? "bg-cyan-400 animate-pulse"
                    : "bg-slate-600"
              )}
            />
            {isScanning ? "Scanning" : connected ? "Active Session" : "Offline"}
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1">
        {mainNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-xs font-semibold transition-all duration-200 cursor-pointer group",
                active
                  ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300 hover:translate-x-1 border-l-2 border-transparent"
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Deploy Scanner Button */}
      <div className="px-4 mt-8">
        <Link
          href="/ship"
          className="w-full py-2.5 bg-gradient-to-br from-cyan-300 to-cyan-500 text-slate-900 font-display font-bold text-xs uppercase tracking-widest rounded transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] active:scale-95 flex items-center justify-center gap-2"
        >
          <Rocket className="h-3.5 w-3.5" />
          Deploy Scanner
        </Link>
      </div>

      {/* Footer Links */}
      <div className="mt-auto pt-6 border-t border-white/5 space-y-1">
        {footerNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 text-slate-500 px-4 py-2 hover:bg-white/5 hover:text-slate-300 text-[10px] uppercase font-bold tracking-widest transition-all"
          >
            <item.icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
