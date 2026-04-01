import type { SymbolRecord } from "@guardrail-context/shared";

export type FuzzyMatch = {
  symbol: SymbolRecord;
  score: number;
  distance: number;
  matchType: "exact" | "prefix" | "contains" | "fuzzy" | "camelCase";
};

export function fuzzySearchSymbols(
  symbols: SymbolRecord[],
  query: string,
  limit = 10
): FuzzyMatch[] {
  const lowerQuery = query.toLowerCase();
  const matches: FuzzyMatch[] = [];

  for (const symbol of symbols) {
    const lowerName = symbol.name.toLowerCase();
    
    // Exact match
    if (symbol.name === query) {
      matches.push({ symbol, score: 1.0, distance: 0, matchType: "exact" });
      continue;
    }

    // Exact case-insensitive match
    if (lowerName === lowerQuery) {
      matches.push({ symbol, score: 0.95, distance: 0, matchType: "exact" });
      continue;
    }

    // Prefix match (startsWith)
    if (lowerName.startsWith(lowerQuery)) {
      const score = 0.9 - (lowerName.length - lowerQuery.length) * 0.01;
      matches.push({ symbol, score, distance: lowerName.length - lowerQuery.length, matchType: "prefix" });
      continue;
    }

    // CamelCase match (e.g., "useAC" matches "useAuthContext")
    if (matchesCamelCase(symbol.name, query)) {
      matches.push({ symbol, score: 0.85, distance: 1, matchType: "camelCase" });
      continue;
    }

    // Contains match
    if (lowerName.includes(lowerQuery)) {
      const pos = lowerName.indexOf(lowerQuery);
      const score = 0.7 - pos * 0.01;
      matches.push({ symbol, score, distance: pos, matchType: "contains" });
      continue;
    }

    // Levenshtein fuzzy match (for typos)
    const distance = levenshteinDistance(lowerQuery, lowerName);
    const maxLen = Math.max(lowerQuery.length, lowerName.length);
    if (distance <= Math.ceil(lowerQuery.length * 0.4)) { // Allow 40% error rate
      const score = 0.5 * (1 - distance / maxLen);
      matches.push({ symbol, score, distance, matchType: "fuzzy" });
    }
  }

  // Sort by score descending
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function matchesCamelCase(symbolName: string, query: string): boolean {
  // Extract capital letters from symbol name
  const capitals = symbolName.replace(/[a-z]/g, "");
  const lowerCapitals = capitals.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Check if query matches the capitals pattern
  if (lowerCapitals.startsWith(lowerQuery)) return true;
  
  // Check if query matches camelCase parts
  const parts = symbolName.split(/(?=[A-Z])/);
  let partIndex = 0;
  let queryIndex = 0;
  
  while (queryIndex < query.length && partIndex < parts.length) {
    const part = parts[partIndex].toLowerCase();
    const queryPart = query.substring(queryIndex).toLowerCase();
    
    if (part.startsWith(queryPart.charAt(0))) {
      // Check how much of this part matches
      let matchLen = 0;
      while (matchLen < part.length && matchLen < queryPart.length && 
             part[matchLen] === queryPart[matchLen]) {
        matchLen++;
      }
      queryIndex += matchLen;
    }
    partIndex++;
  }
  
  return queryIndex >= query.length * 0.7; // 70% of query matched
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

export function suggestSimilarSymbols(
  symbols: SymbolRecord[],
  query: string,
  kind?: string
): string[] {
  let filtered = symbols;
  if (kind) {
    filtered = symbols.filter(s => s.kind === kind);
  }
  
  const matches = fuzzySearchSymbols(filtered, query, 5);
  return matches.map(m => `${m.symbol.name} (${m.matchType}, ${Math.round(m.score * 100)}% match)`);
}
