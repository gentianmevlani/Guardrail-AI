import {
  GroundingSource,
  GroundingClaim,
  GroundingResult,
} from '@guardrail/core';

/**
 * Factual Grounding Verifier — Output Guardrail
 *
 * Verifies that LLM-generated claims are grounded in provided
 * context/sources. Detects hallucinated facts, unsupported claims,
 * and fabricated references before they reach the user.
 */
export class FactualGroundingVerifier {
  private minimumConfidence = 0.6;

  /**
   * Verify that output claims are grounded in provided sources
   */
  async verify(
    output: string,
    sources: GroundingSource[],
    options?: { threshold?: number; strictMode?: boolean }
  ): Promise<GroundingResult> {
    const startTime = Date.now();
    const threshold = options?.threshold ?? this.minimumConfidence;
    const strictMode = options?.strictMode ?? false;

    // Extract claims from the output
    const claims = this.extractClaims(output);

    // Verify each claim against sources
    const verifiedClaims: GroundingClaim[] = [];
    for (const claim of claims) {
      const verification = this.verifyClaim(claim, sources, threshold);
      verifiedClaims.push(verification);
    }

    const ungroundedClaims = verifiedClaims.filter((c) => !c.grounded);
    const groundedCount = verifiedClaims.filter((c) => c.grounded).length;
    const overallScore = verifiedClaims.length > 0
      ? groundedCount / verifiedClaims.length
      : 1.0;

    const isGrounded = strictMode
      ? ungroundedClaims.length === 0
      : overallScore >= threshold;

    return {
      isGrounded,
      overallScore,
      claims: verifiedClaims,
      ungroundedClaims,
      recommendation: this.getRecommendation(overallScore, ungroundedClaims.length, strictMode),
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Set minimum confidence threshold
   */
  setMinimumConfidence(confidence: number): void {
    this.minimumConfidence = Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract verifiable claims from text
   */
  private extractClaims(output: string): RawClaim[] {
    const claims: RawClaim[] = [];
    const sentences = this.splitIntoSentences(output);

    for (const sentence of sentences) {
      const category = this.classifySentence(sentence);

      // Only verify factual and code claims, not opinions or instructions
      if (category === 'factual' || category === 'code') {
        const trimmed = sentence.trim();
        if (trimmed.length < 10) continue; // Skip very short fragments

        const startIdx = output.indexOf(trimmed);
        claims.push({
          text: trimmed,
          location: {
            start: startIdx >= 0 ? startIdx : 0,
            end: startIdx >= 0 ? startIdx + trimmed.length : trimmed.length,
          },
          category,
        });
      }
    }

    return claims;
  }

  /**
   * Verify a single claim against all sources
   */
  private verifyClaim(
    claim: RawClaim,
    sources: GroundingSource[],
    threshold: number
  ): GroundingClaim {
    let bestScore = 0;
    const matchedSources: string[] = [];

    for (const source of sources) {
      const similarity = this.computeSimilarity(claim.text, source.content);

      if (similarity >= threshold) {
        matchedSources.push(source.id);
      }

      if (similarity > bestScore) {
        bestScore = similarity;
      }
    }

    // Check for specific factual patterns that need grounding
    const containsSpecificFacts = this.containsVerifiableFacts(claim.text);

    // If the claim contains specific facts (numbers, dates, names) but
    // has no source match, it's more likely a hallucination
    if (containsSpecificFacts && matchedSources.length === 0) {
      bestScore = Math.min(bestScore, 0.3);
    }

    return {
      claim: claim.text,
      location: claim.location,
      grounded: matchedSources.length > 0 || bestScore >= threshold,
      confidence: bestScore,
      sources: matchedSources,
      category: claim.category,
    };
  }

  /**
   * Compute semantic similarity between claim and source
   * Uses token overlap + key entity matching as a proxy
   */
  private computeSimilarity(claim: string, source: string): number {
    const claimTokens = this.tokenize(claim);
    const sourceTokens = new Set(this.tokenize(source));

    if (claimTokens.length === 0) return 0;

    // Token overlap
    let matchCount = 0;
    for (const token of claimTokens) {
      if (sourceTokens.has(token)) matchCount++;
    }
    const tokenOverlap = matchCount / claimTokens.length;

    // Key entity matching (numbers, proper nouns, technical terms)
    const claimEntities = this.extractKeyEntities(claim);
    const sourceText = source.toLowerCase();
    let entityMatches = 0;
    for (const entity of claimEntities) {
      if (sourceText.includes(entity.toLowerCase())) entityMatches++;
    }
    const entityOverlap = claimEntities.length > 0
      ? entityMatches / claimEntities.length
      : 1.0;

    // N-gram overlap (bigrams)
    const claimBigrams = this.getBigrams(claim.toLowerCase());
    const sourceBigrams = new Set(this.getBigrams(source.toLowerCase()));
    let bigramMatches = 0;
    for (const bg of claimBigrams) {
      if (sourceBigrams.has(bg)) bigramMatches++;
    }
    const bigramOverlap = claimBigrams.length > 0
      ? bigramMatches / claimBigrams.length
      : 0;

    // Weighted combination
    return tokenOverlap * 0.3 + entityOverlap * 0.4 + bigramOverlap * 0.3;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  private extractKeyEntities(text: string): string[] {
    const entities: string[] = [];

    // Numbers (including decimals, percentages)
    const numbers = text.match(/\d+(?:\.\d+)?%?/g);
    if (numbers) entities.push(...numbers);

    // Proper nouns (capitalized words not at sentence start)
    const properNouns = text.match(/(?<=\s)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
    if (properNouns) entities.push(...properNouns);

    // Technical terms (camelCase, PascalCase, SCREAMING_CASE)
    const techTerms = text.match(/\b[a-z]+[A-Z]\w+\b|\b[A-Z]{2,}\b|\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
    if (techTerms) entities.push(...techTerms);

    // Quoted strings
    const quoted = text.match(/["']([^"']{3,})["']/g);
    if (quoted) entities.push(...quoted.map((q) => q.replace(/["']/g, '')));

    return entities;
  }

  private getBigrams(text: string): string[] {
    const words = text.split(/\s+/).filter((w) => w.length > 1);
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
    return bigrams;
  }

  private splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries while preserving code blocks
    const codeBlocks: string[] = [];
    let cleaned = text.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\n)\s*(?=\S)/);

    return sentences.map((s) => {
      // Restore code blocks
      return s.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[parseInt(idx)] || '');
    }).filter((s) => s.trim().length > 0);
  }

  private classifySentence(sentence: string): 'factual' | 'opinion' | 'instruction' | 'code' | 'unknown' {
    const trimmed = sentence.trim();

    // Code detection
    if (/^```|^\s*(?:const|let|var|function|class|import|export|def|if|for|while|return)\s/m.test(trimmed)) {
      return 'code';
    }

    // Instruction detection
    if (/^(?:please|you should|try to|make sure|don't|do not|always|never|remember to)/i.test(trimmed)) {
      return 'instruction';
    }

    // Opinion detection
    if (/^(?:I think|I believe|in my opinion|it seems|I feel|personally|arguably|perhaps|maybe)/i.test(trimmed)) {
      return 'opinion';
    }

    // Factual indicators
    if (/(?:\d+%|\bin \d{4}\b|according to|studies show|research|data|statistic|was founded|is located)/i.test(trimmed)) {
      return 'factual';
    }

    // Default: factual for statements, unknown for others
    if (/^[A-Z].*[.!]$/.test(trimmed)) return 'factual';
    return 'unknown';
  }

  private containsVerifiableFacts(text: string): boolean {
    return /\d+(?:\.\d+)?%|\bin \d{4}\b|founded in|located in|according to|studies show/i.test(text);
  }

  private getRecommendation(
    overallScore: number,
    ungroundedCount: number,
    strictMode: boolean
  ): 'accept' | 'flag' | 'reject' | 'review' {
    if (strictMode && ungroundedCount > 0) return 'reject';
    if (overallScore >= 0.9) return 'accept';
    if (overallScore >= 0.7) return 'flag';
    if (overallScore >= 0.4) return 'review';
    return 'reject';
  }
}

interface RawClaim {
  text: string;
  location: { start: number; end: number };
  category: 'factual' | 'opinion' | 'instruction' | 'code' | 'unknown';
}

export const factualGroundingVerifier = new FactualGroundingVerifier();
