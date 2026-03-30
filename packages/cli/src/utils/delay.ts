/** Small async delay helper for CLI spinners and UX pacing. */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
