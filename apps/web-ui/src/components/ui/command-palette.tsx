"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  History,
  Key,
  LayoutDashboard,
  Plug,
  Play,
  RefreshCw,
  Rocket,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Wand2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  action: () => void;
  category: "navigation" | "actions" | "recent";
  shortcut?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const commands: CommandItem[] = [
    // Navigation
    {
      id: "nav-overview",
      title: "Overview",
      description: "Go to dashboard overview",
      icon: LayoutDashboard,
      action: () => router.push("/dashboard"),
      category: "navigation",
    },
    {
      id: "nav-ship",
      title: "Ship Check",
      description: "Run or view ship check",
      icon: Rocket,
      action: () => router.push("/ship-check"),
      category: "navigation",
      shortcut: "G S",
    },
    {
      id: "nav-runs",
      title: "Runs",
      description: "View run history",
      icon: History,
      action: () => router.push("/runs"),
      category: "navigation",
      shortcut: "G R",
    },
    {
      id: "nav-policies",
      title: "Policies",
      description: "Manage enforcement policies",
      icon: ScrollText,
      action: () => router.push("/policies"),
      category: "navigation",
    },
    {
      id: "nav-findings",
      title: "Findings",
      description: "View all findings",
      icon: AlertTriangle,
      action: () => router.push("/findings"),
      category: "navigation",
    },
    {
      id: "nav-guardrails",
      title: "Guardrails",
      description: "AI rule playground",
      icon: Wand2,
      action: () => router.push("/guardrails"),
      category: "navigation",
    },
    {
      id: "nav-compliance",
      title: "Compliance",
      description: "Compliance dashboard",
      icon: FileText,
      action: () => router.push("/compliance"),
      category: "navigation",
    },
    {
      id: "nav-enforcement",
      title: "Enforcement",
      description: "GitHub PR checks",
      icon: ShieldCheck,
      action: () => router.push("/enforcement"),
      category: "navigation",
    },
    {
      id: "nav-audit",
      title: "Audit Log",
      description: "View audit history",
      icon: ClipboardList,
      action: () => router.push("/audit"),
      category: "navigation",
    },
    {
      id: "nav-api-key",
      title: "API Key",
      description: "Manage API key",
      icon: Key,
      action: () => router.push("/api-key"),
      category: "navigation",
    },
    {
      id: "nav-integrations",
      title: "Integrations",
      description: "CLI, CI, editors, MCP, containers",
      icon: Plug,
      action: () => router.push("/integrations"),
      category: "navigation",
    },
    {
      id: "nav-settings",
      title: "Settings",
      description: "Account settings",
      icon: Settings,
      action: () => router.push("/settings"),
      category: "navigation",
    },
    // Actions
    {
      id: "action-run-ship",
      title: "Run Ship Check",
      description: "Start a new ship check",
      icon: Play,
      action: () => router.push("/ship-check"),
      category: "actions",
      shortcut: "⌘ ⏎",
    },
    {
      id: "action-rescan",
      title: "Re-scan Current Repo",
      description: "Run full security scan",
      icon: RefreshCw,
      action: () => {},
      category: "actions",
    },
    {
      id: "action-export",
      title: "Export Latest Report",
      description: "Download as PDF",
      icon: Download,
      action: () => {},
      category: "actions",
    },
    {
      id: "action-docs",
      title: "Open Documentation",
      description: "View guardrail docs",
      icon: ExternalLink,
      action: () => window.open("https://guardrailai.dev/docs", "_blank"),
      category: "actions",
    },
  ];

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(query.toLowerCase()),
  );

  const groupedCommands = {
    navigation: filteredCommands.filter((c) => c.category === "navigation"),
    actions: filteredCommands.filter((c) => c.category === "actions"),
  };

  const allFiltered = useMemo(
    () => [...groupedCommands.navigation, ...groupedCommands.actions],
    [groupedCommands.navigation, groupedCommands.actions],
  );

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Ctrl+K or Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setQuery("");
        setSelectedIndex(0);
      }

      // Close with Escape
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Navigation within palette
  const handlePaletteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && allFiltered[selectedIndex]) {
        e.preventDefault();
        allFiltered[selectedIndex].action();
        setOpen(false);
      }
    },
    [allFiltered, selectedIndex],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="w-5 h-5 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handlePaletteKeyDown}
            placeholder="Search pages, actions..."
            className="flex-1 bg-transparent text-white placeholder:text-zinc-500 outline-none text-sm"
            autoFocus
          />
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {allFiltered.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {groupedCommands.navigation.length > 0 && (
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 px-1">
                    Pages
                  </span>
                </div>
              )}
              {groupedCommands.navigation.map((cmd, i) => {
                const globalIndex = i;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      selectedIndex === globalIndex
                        ? "bg-blue-600/20 text-white"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <cmd.icon
                      className={`w-4 h-4 ${selectedIndex === globalIndex ? "text-blue-400" : "text-zinc-500"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {cmd.title}
                      </p>
                      {cmd.description && (
                        <p className="text-xs text-zinc-500 truncate">
                          {cmd.description}
                        </p>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <span className="text-[10px] text-zinc-600 font-mono">
                        {cmd.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}

              {groupedCommands.actions.length > 0 && (
                <div className="px-3 py-1.5 mt-2 border-t border-zinc-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 px-1">
                    Actions
                  </span>
                </div>
              )}
              {groupedCommands.actions.map((cmd, i) => {
                const globalIndex = groupedCommands.navigation.length + i;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      selectedIndex === globalIndex
                        ? "bg-blue-600/20 text-white"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <cmd.icon
                      className={`w-4 h-4 ${selectedIndex === globalIndex ? "text-blue-400" : "text-zinc-500"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {cmd.title}
                      </p>
                      {cmd.description && (
                        <p className="text-xs text-zinc-500 truncate">
                          {cmd.description}
                        </p>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <span className="text-[10px] text-zinc-600 font-mono">
                        {cmd.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">
                ↵
              </kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">
                esc
              </kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
