/**
 * Short-lived stdio MCP handshake to verify the bundled server speaks MCP
 * (JSON-RPC `initialize`). Matches @modelcontextprotocol/sdk stdio transport:
 * newline-delimited JSON (not Content-Length framing).
 */

import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type McpProtocolProbeResult = "responded" | "path_only" | "skipped";

const INIT_REQUEST_ID = 1;

/** SDK stdio transport: one JSON-RPC object per line (see sdk `serializeMessage`). */
function encodeMcpLine(payload: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(payload)}\n`, "utf-8");
}

function isInitializeReply(msg: unknown): boolean {
  if (!msg || typeof msg !== "object") {
    return false;
  }
  const m = msg as Record<string, unknown>;
  if (m.jsonrpc !== "2.0") {
    return false;
  }
  const id = m.id;
  if (id !== INIT_REQUEST_ID && id !== String(INIT_REQUEST_ID)) {
    return false;
  }
  return "result" in m || "error" in m;
}

/**
 * Spawn Node with the MCP server entry, send `initialize`, expect a JSON-RPC reply for that id.
 */
export async function probeMcpStdioProtocol(
  mcpServerPath: string,
  options: { timeoutMs?: number; log?: (msg: string) => void } = {},
): Promise<McpProtocolProbeResult> {
  const resolved = path.resolve(mcpServerPath);
  if (!fs.existsSync(resolved)) {
    return "skipped";
  }

  const timeoutMs = options.timeoutMs ?? 4500;
  const log = options.log;

  const initPayload = {
    jsonrpc: "2.0",
    id: INIT_REQUEST_ID,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "guardrail-vscode-extension",
        version: "1.0.0",
      },
    },
  };

  return new Promise<McpProtocolProbeResult>((resolve) => {
    let finished = false;
    let child: ChildProcess | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let buf = Buffer.alloc(0);

    const done = (r: McpProtocolProbeResult): void => {
      if (finished) {
        return;
      }
      finished = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (child) {
        try {
          child.stdout?.removeAllListeners();
          child.stderr?.removeAllListeners();
          child.removeAllListeners();
          child.stdin?.end();
          child.kill("SIGTERM");
          setTimeout(() => {
            try {
              child?.kill("SIGKILL");
            } catch {
              /* ignore */
            }
          }, 400);
        } catch {
          /* ignore */
        }
      }
      resolve(r);
    };

    const processStdoutChunk = (chunk: Buffer): void => {
      buf = Buffer.concat([buf, chunk]);
      while (true) {
        const nl = buf.indexOf(0x0a);
        if (nl === -1) {
          break;
        }
        const line = buf.slice(0, nl).toString("utf-8");
        buf = Buffer.from(buf.subarray(nl + 1));
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        let msg: unknown;
        try {
          msg = JSON.parse(trimmed) as unknown;
        } catch {
          continue;
        }
        if (isInitializeReply(msg)) {
          log?.("MCP stdio probe: initialize reply received");
          done("responded");
          return;
        }
      }
    };

    timer = setTimeout(() => {
      log?.("MCP stdio probe: timeout");
      done("path_only");
    }, timeoutMs);

    try {
      child = spawn(process.execPath, [resolved], {
        cwd: path.dirname(resolved),
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });
    } catch (e) {
      log?.(`MCP stdio probe: spawn failed ${String(e)}`);
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      resolve("path_only");
      return;
    }

    child.stdout?.on("data", processStdoutChunk);

    child.stderr?.on("data", (chunk: Buffer) => {
      log?.(`MCP stderr: ${chunk.toString("utf-8").slice(0, 200)}`);
    });

    child.on("error", (err) => {
      log?.(`MCP stdio probe: process error ${String(err)}`);
      done("path_only");
    });

    child.on("exit", (code, signal) => {
      if (!finished) {
        log?.(`MCP stdio probe: exit ${code} signal ${signal ?? ""}`);
        done("path_only");
      }
    });

    try {
      const frame = encodeMcpLine(initPayload);
      const ok = child.stdin?.write(frame);
      if (ok === false) {
        child.stdin?.once("drain", () => {
          /* noop */
        });
      }
    } catch (e) {
      log?.(`MCP stdio probe: write failed ${String(e)}`);
      done("path_only");
    }
  });
}
