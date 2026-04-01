/**
 * Narrow unknown caught values to a safe log / API string.
 */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Stack trace when err is an Error; otherwise undefined. */
export function getErrorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}
