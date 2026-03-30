describe('Simple Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });
  
  it('should handle async', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(true).toBe(true);
  });
});
