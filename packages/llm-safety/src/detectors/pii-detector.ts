/**
 * PII regex patterns (+ hooks for future NER).
 */

export interface PIIMatch {
  type: 'phone' | 'email' | 'ssn' | 'credit-card';
  start: number;
  end: number;
  text: string;
}

const PHONE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const CC = /\b(?:\d[ -]*?){13,19}\b/g;

export function detectPII(text: string): PIIMatch[] {
  const out: PIIMatch[] = [];
  const t = text.slice(0, 200_000);

  for (const re of [PHONE, EMAIL, SSN, CC]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    const typ =
      re === PHONE
        ? 'phone'
        : re === EMAIL
          ? 'email'
          : re === SSN
            ? 'ssn'
            : 'credit-card';
    while ((m = re.exec(t)) !== null) {
      if (m[0]) {
        out.push({
          type: typ,
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
        });
      }
    }
  }

  return out;
}
