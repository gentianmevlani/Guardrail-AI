/**
 * Interactive Launcher Menu
 * Premium control panel for guardrail
 */
import prompts from "prompts";
import chalk from "chalk";

import { brandHeader, badge, dim, bold, link } from "../ui/brand.js";
import { panel, divider } from "../ui/box.js";
import { kvTable } from "../ui/table.js";
import { shouldUseUI } from "../ui/terminal.js";
import { readStatus, formatAge } from "../ui/status.js";

import { cmdOn } from "./on.js";
import { cmdCheckpoint } from "./checkpoint.js";
import { cmdShip } from "./ship.js";
import { cmdStats } from "./stats.js";
import { cmdInit } from "./init.js";
import { cmdDoctor } from "./doctor.js";
import { login, logout, getAuthState } from "../auth/gate.js";

export async function cmdMenu(repoPath: string): Promise<void> {
  if (!shouldUseUI()) {
    console.log(`${brandHeader()} requires an interactive terminal.`);
    console.log(`Run: guardrail --help`);
    return;
  }

  const onCancel = () => {
    console.log(dim("\nExiting guardrail. Run 'guardrail on' to start Context Mode."));
    process.exit(0);
  };

  while (true) {
    const status = readStatus(repoPath);
    const authState = getAuthState();
    const isPro = authState.tier === "pro" || authState.tier === "enterprise";

    // Build status display
    const statusRows: Array<[string, string]> = [
      ["Repo", repoPath.split(/[/\\]/).pop() || repoPath],
      ["Truth Pack", status.truthPack.exists
        ? `${badge("Fresh", "ok")} (${formatAge(status.truthPack.ageSec)})${status.truthPack.symbolCount ? ` • ${status.truthPack.symbolCount} symbols` : ""}`
        : `${badge("Missing", "warn")} — run init`],
      ["Context Mode", status.contextMode.running
        ? `${badge("Running", "ok")} (PID: ${status.contextMode.pid})`
        : dim("Not running")],
      ["Telemetry", status.telemetry.exists
        ? `${badge("ON", "ok")} • ${status.telemetry.hallucinationsBlocked || 0} hallucinations blocked (24h)`
        : dim("Will appear after tool calls")],
      ["Tier", isPro
        ? badge(authState.tier.toUpperCase(), "pro")
        : `${badge("FREE", "info")} — ${link("guardrail upgrade")}`],
    ];

    console.clear();
    console.log(panel(brandHeader("Context Engine"), kvTable(statusRows), { kind: isPro ? "ok" : "neutral" }));
    console.log("");

    // Action menu
    const shipLabel = isPro
      ? "Ship Verdict (GO/NO-GO)"
      : `Ship Verdict (GO/NO-GO) ${badge("Pro", "lock")}`;

    const choices = [
      { title: `${bold("Start Context Mode")} ${dim("(watcher + MCP + telemetry)")}`, value: "on" },
      { title: `${bold("Run Checkpoint")} ${dim("(fast verification)")}`, value: "checkpoint" },
      { title: `${bold("View Stats")} ${dim("(hallucinations blocked)")}`, value: "stats" },
      { title: shipLabel, value: "ship" },
      { title: divider(40), value: "divider", disabled: true },
      { title: `Init / Setup ${dim("(install rules + build Truth Pack)")}`, value: "init" },
      { title: `Doctor ${dim("(diagnose issues)")}`, value: "doctor" },
      { title: isPro ? `Account ${dim(`(${authState.tier})`)}` : `Login / Upgrade`, value: "auth" },
      { title: dim("Exit"), value: "exit" },
    ];

    const res = await prompts({
      type: "select",
      name: "action",
      message: "What do you want to do?",
      choices,
      initial: 0,
    }, { onCancel });

    const action = res.action as string | undefined;
    if (!action || action === "exit" || action === "divider") {
      if (action === "exit") {
        console.log(dim("\nRun 'guardrail on' to start Context Mode anytime."));
      }
      return;
    }

    console.log("");

    try {
      switch (action) {
        case "on":
          await cmdOn(repoPath, { http: false, verbose: false });
          break;

        case "checkpoint":
          await cmdCheckpoint(repoPath, {});
          break;

        case "stats":
          await cmdStats(repoPath, {});
          break;

        case "ship":
          await cmdShip(repoPath, { report: true });
          break;

        case "init":
          await cmdInit(repoPath);
          break;

        case "doctor":
          await cmdDoctor(repoPath);
          break;

        case "auth":
          await handleAuth(repoPath, isPro);
          break;
      }
    } catch (e: any) {
      console.error(chalk.red(`Error: ${e.message}`));
    }

    // Pause to let user read output
    console.log("");
    await prompts({
      type: "confirm",
      name: "back",
      message: "Back to menu?",
      initial: true,
    }, { onCancel: () => process.exit(0) });
  }
}

async function handleAuth(repoPath: string, isPro: boolean): Promise<void> {
  const authState = getAuthState();

  if (isPro) {
    console.log(bold("Account"));
    console.log(`  Tier: ${badge(authState.tier.toUpperCase(), "pro")}`);
    console.log(`  ${dim("Run 'guardrail logout' to sign out")}`);
    
    const res = await prompts({
      type: "confirm",
      name: "logout",
      message: "Log out?",
      initial: false,
    });
    
    if (res.logout) {
      logout();
    }
  } else {
    console.log(bold("Login / Upgrade"));
    console.log("");
    console.log(`  ${badge("Ship Verdict", "lock")} requires Pro ($29/mo)`);
    console.log("");
    console.log(`  ${dim("Get your API key at:")} ${link("https://guardrailai.dev/dashboard")}`);
    console.log("");

    const res = await prompts({
      type: "password",
      name: "key",
      message: "Enter your API key (starts with gr_...)",
    });

    if (res.key) {
      await login(res.key);
    }
  }
}
