import crypto from "node:crypto";

export function hashString(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}

export function hashObject(obj: unknown): string {
  return hashString(JSON.stringify(obj));
}
