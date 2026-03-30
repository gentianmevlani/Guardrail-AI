export function realClient(apiKey: string) {
  return {
    async getUser(id: string) {
      // Pretend this calls a real API
      return { id, name: "Real User", plan: "paid", source: "REAL_API" };
    },
  };
}
