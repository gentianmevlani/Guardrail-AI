export function elapsedMs(start: number): number {
  const n = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return Math.round(n - start);
}

export function startTimer(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
