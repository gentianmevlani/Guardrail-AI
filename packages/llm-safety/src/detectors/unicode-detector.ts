/**
 * Invisible unicode / homoglyph heuristics.
 */

const INVISIBLE = /[\u200B-\u200D\uFEFF\u2060\u180E]/g;
const MIXED_SCRIPT = /[\u0400-\u04FF].*[\u0041-\u005A\u0061-\u007A]/;

export interface UnicodeAnomaly {
  kind: 'invisible' | 'mixed-script-suspicious';
  detail: string;
}

export function detectUnicodeAnomalies(text: string): UnicodeAnomaly[] {
  const anomalies: UnicodeAnomaly[] = [];
  if (INVISIBLE.test(text)) {
    anomalies.push({ kind: 'invisible', detail: 'Zero-width or invisible characters detected' });
  }
  if (MIXED_SCRIPT.test(text)) {
    anomalies.push({
      kind: 'mixed-script-suspicious',
      detail: 'Cyrillic + Latin mix — possible homoglyph attack',
    });
  }
  return anomalies;
}
