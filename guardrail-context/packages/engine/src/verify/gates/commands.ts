import { execSync } from "node:child_process";

export type CommandResult = {
  ok: boolean;
  out: string;
  code?: number;
};

export function runCommand(cmd: string, cwd: string): CommandResult {
  try {
    const out = execSync(cmd, { 
      cwd, 
      stdio: "pipe", 
      encoding: "utf8",
      timeout: 60000, // 60 second timeout
    });
    return { ok: true, out: out || "", code: 0 };
  } catch (e: any) {
    const out = (e?.stdout ?? "") + "\n" + (e?.stderr ?? "");
    return { ok: false, out: String(out).slice(0, 6000), code: e?.status };
  }
}

export function runCommandAsync(cmd: string, cwd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    try {
      const out = execSync(cmd, { 
        cwd, 
        stdio: "pipe", 
        encoding: "utf8",
        timeout: 120000,
      });
      resolve({ ok: true, out: out || "", code: 0 });
    } catch (e: any) {
      const out = (e?.stdout ?? "") + "\n" + (e?.stderr ?? "");
      resolve({ ok: false, out: String(out).slice(0, 6000), code: e?.status });
    }
  });
}
