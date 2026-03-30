// Simple test to verify Jest setup is working
describe("Test Setup", () => {
  it("should run a basic test", () => {
    expect(1 + 1).toBe(2);
  });

  it("should have Jest environment configured", () => {
    expect(typeof describe).toBe("function");
    expect(typeof it).toBe("function");
    expect(typeof expect).toBe("function");
  });

  it("should support async tests", async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
