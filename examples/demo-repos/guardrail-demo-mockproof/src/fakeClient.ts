import { realClient } from "./realClient.js";

export function getClient() {
  // Classic production leak: missing env var triggers a "safe" fallback
  if (!process.env.REAL_API_KEY) {
    return {
      async getUser(id: string) {
        return { id, name: "John Doe", plan: "demo", source: "FAKE_FALLBACK" };
      },
    };
  }
  return realClient(process.env.REAL_API_KEY);
}
