import type { ScanResult } from "./mcp-client";

let lastScanResult: ScanResult | null = null;

export function setLastScanResult(result: ScanResult): void {
  lastScanResult = result;
}

export function getLastScanResult(): ScanResult | null {
  return lastScanResult;
}
