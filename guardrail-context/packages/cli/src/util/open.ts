/**
 * File/URL opener utility
 * Cross-platform open in default browser/app
 */
import open from "open";

export async function openFile(target: string): Promise<boolean> {
  try {
    await open(target);
    return true;
  } catch {
    return false;
  }
}

export async function openUrl(url: string): Promise<boolean> {
  try {
    await open(url);
    return true;
  } catch {
    return false;
  }
}
