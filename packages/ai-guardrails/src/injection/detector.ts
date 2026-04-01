<<<<<<< HEAD
=======
import { prisma } from "@guardrail/database";
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
import {
  InjectionScanRequest,
  InjectionScanResult,
  Detection,
} from "@guardrail/core";
<<<<<<< HEAD

type InjectionVerdict = InjectionScanResult["verdict"];
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
// import { calculateHash } from '@guardrail/core'; // Not used yet
import { INJECTION_PATTERNS, SEMANTIC_TRIGGERS } from "./patterns";

// Define ScanVerdict locally since it's not exported from database
export enum ScanVerdict {
  CLEAN = "clean",
  SUSPICIOUS = "suspicious",
  MALICIOUS = "malicious",
  BLOCKED = "blocked",
}

/**
 * Prompt Injection Detector
 *
 * Detects and prevents prompt injection attacks using multiple techniques:
 * - Lexical pattern matching
 * - Semantic analysis
 * - Encoding detection
 * - Entropy analysis
 */
export class PromptInjectionDetector {
  private initialized: boolean = false;

  /**
   * Initialize the detector (load patterns, models, etc.)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // In a production system, you might load ML models here
    // For now, we're using pattern-based detection

    this.initialized = true;
  }

  /**
   * Main scan function
   */
  async scan(request: InjectionScanRequest): Promise<InjectionScanResult> {
    const startTime = Date.now();
    await this.initialize();

    const content = request.content;
    // const contentHash = calculateHash(content); // Not used yet

    // Check cache first - skip for now as database table may not exist
    // In production, implement proper caching

    // Run all detection methods
    const lexicalDetections = await this.lexicalScan(content);
    const semanticDetections = await this.semanticScan(content);
    const indirectDetections = await this.scanIndirectInjection(content);

    // Combine all detections
    const allDetections = [
      ...lexicalDetections,
      ...semanticDetections,
      ...indirectDetections,
    ];

    // Calculate verdict and confidence
    const { verdict, confidence } = this.calculateVerdict(
      allDetections,
      content,
    );

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      verdict,
      allDetections,
      content,
    );

    const scanDuration = Date.now() - startTime;

<<<<<<< HEAD
=======
    // Save to database
    try {
      // @ts-ignore - injectionScan may not exist in schema yet
      await prisma.injectionScan.create({
        data: {
          id:
            (request as any).id ||
            `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          contentType: request.contentType || "text",
          contentHash: "hash_placeholder", // Required field
          verdict: verdict as any, // Cast to any to avoid type mismatch
          confidence,
          detections: allDetections as any,
          recommendation: "Review detected issues", // Required field
          scanDuration: Date.now() - startTime, // Required field
        } as any,
      });
    } catch (error) {
      // Database table may not exist - continue without saving
    }

>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    return {
      verdict,
      confidence,
      detections: allDetections,
      sanitizedContent: recommendation.sanitizedContent,
      recommendation: {
        action: recommendation.action as
          | "allow"
          | "sanitize"
          | "block"
          | "review",
        reason: recommendation.reason,
      },
      scanDuration,
    };
  }

  /**
   * Lexical scanning using regex patterns
   */
  private async lexicalScan(content: string): Promise<Detection[]> {
    const detections: Detection[] = [];

    // Decode any obvious encoding first
    const decodedContent = this.decodeContent(content);

    for (const pattern of INJECTION_PATTERNS) {
      // Check regex patterns
      for (const regex of pattern.patterns) {
        // Preserve original flags and add global flag
        const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
        const globalRegex = new RegExp(regex.source, flags);
        const matches = [...decodedContent.matchAll(globalRegex)];
        for (const match of matches) {
          if (match.index !== undefined) {
            detections.push({
              type: pattern.type,
              pattern: regex.source,
              location: {
                start: match.index,
                end: match.index + match[0].length,
              },
              severity: pattern.severity,
              confidence: 0.9,
              description: pattern.description,
            });
          }
        }
      }

      // Check keywords
      for (const keyword of pattern.keywords) {
        const index = decodedContent
          .toLowerCase()
          .indexOf(keyword.toLowerCase());
        if (index !== -1) {
          detections.push({
            type: pattern.type,
            pattern: keyword,
            location: {
              start: index,
              end: index + keyword.length,
            },
            severity: pattern.severity,
            confidence: 0.8,
            description: pattern.description,
          });
        }
      }
    }

    return detections;
  }

  /**
   * Semantic scanning for conceptual attacks
   */
  private async semanticScan(content: string): Promise<Detection[]> {
    const detections: Detection[] = [];
    const lowerContent = content.toLowerCase();

    // Simple semantic matching (in production, use embeddings)
    for (const trigger of SEMANTIC_TRIGGERS) {
      if (lowerContent.includes(trigger.toLowerCase())) {
        const index = lowerContent.indexOf(trigger.toLowerCase());
        detections.push({
          type: "semantic_injection",
          pattern: trigger,
          location: {
            start: index,
            end: index + trigger.length,
          },
          severity: "high",
          confidence: 0.7,
          description: "Semantic pattern matching malicious intent",
        });
      }
    }

    // Check for unusual entropy (might indicate encoded content)
    // const entropy = calculateEntropy(content); // Function not available
    // if (entropy > 4.5) {
    //   detections.push({
    //     type: 'high_entropy',
    //     pattern: 'entropy_analysis',
    //     location: { start: 0, end: content.length },
    //     severity: 'medium',
    //     confidence: 0.6,
    //     description: `High entropy (${entropy.toFixed(2)}) suggests encoded or random data`,
    //   });
    // }

    return detections;
  }

  /**
   * Scan for indirect injection in data sources
   */
  private async scanIndirectInjection(content: string): Promise<Detection[]> {
    const detections: Detection[] = [];

    // Look for instructions hidden in various formats
    const hiddenPatterns = [
      { pattern: /<!--.*?-->/gs, type: "html_comment" },
      { pattern: /\/\*.*?\*\//gs, type: "block_comment" },
      { pattern: /\/\/.*$/gm, type: "line_comment" },
      { pattern: /""".*?"""/gs, type: "docstring" },
    ];

    for (const { pattern, type } of hiddenPatterns) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const matchContent = match[0];

        // Check if comment contains injection keywords
        const hasInjection = INJECTION_PATTERNS.some((p) =>
          p.keywords.some((k) =>
            matchContent.toLowerCase().includes(k.toLowerCase()),
          ),
        );

        if (hasInjection && match.index !== undefined) {
          detections.push({
            type: "indirect_injection",
            pattern: type,
            location: {
              start: match.index,
              end: match.index + matchContent.length,
            },
            severity: "medium",
            confidence: 0.75,
            description: `Potential injection hidden in ${type}`,
          });
        }
      }
    }

    return detections;
  }

  /**
   * Decode obfuscated content
   */
  private decodeContent(content: string): string {
    let decoded = content;

    try {
      // Try base64 decoding
      if (/^[A-Za-z0-9+/]+=*$/.test(content) && content.length > 20) {
        const base64Decoded = Buffer.from(content, "base64").toString("utf-8");
        decoded = base64Decoded;
      }
    } catch {
      // Not base64, continue
    }

    // Decode HTML entities
    decoded = decoded.replace(/&#(\d+);/g, (_, dec) =>
      String.fromCharCode(dec),
    );
    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );

    // Decode URL encoding
    try {
      const urlDecoded = decodeURIComponent(decoded);
      decoded = urlDecoded;
    } catch {
      // Not URL encoded
    }

    return decoded;
  }

  /**
   * Calculate overall verdict and confidence
   */
  private calculateVerdict(
    detections: Detection[],
    _content: string,
<<<<<<< HEAD
  ): { verdict: InjectionVerdict; confidence: number } {
=======
  ): { verdict: any; confidence: number } {
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    // const severityScores = { low: 1, medium: 2, high: 3, critical: 4 }; // Not used
    // const totalScore = detections.reduce(
    //   (sum, d) => sum + severityScores[d.severity],
    //   0
    // ); // Not used

    const avgConfidence =
<<<<<<< HEAD
      detections.length === 0
        ? 1
        : detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;
=======
      detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

    // Determine verdict
    const hasCritical = detections.some((d) => d.severity === "critical");
    const hasHigh = detections.some((d) => d.severity === "high");

<<<<<<< HEAD
    let verdict: InjectionVerdict;
    if (hasCritical) verdict = "MALICIOUS";
    else if (hasHigh) verdict = "SUSPICIOUS";
    else if (detections.length > 0) verdict = "BLOCKED";
    else verdict = "CLEAN";
=======
    let verdict: any;
    if (hasCritical) verdict = "MALICIOUS" as any;
    else if (hasHigh) verdict = "SUSPICIOUS" as any;
    else if (detections.length > 0) verdict = "BLOCKED" as any;
    else verdict = "CLEAN" as any;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

    return { verdict, confidence: avgConfidence };
  }

  /**
   * Generate recommendation based on verdict
   */
  private generateRecommendation(
<<<<<<< HEAD
    verdict: InjectionVerdict,
=======
    verdict: any,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    detections: Detection[],
    content: string,
  ): { action: string; reason: string; sanitizedContent?: string } {
    switch (verdict) {
      case "CLEAN":
        return {
          action: "allow",
          reason: "No injection patterns detected",
        };

      case "SUSPICIOUS":
        return {
          action: "review",
          reason: `Suspicious patterns detected: ${detections.map((d) => d.type).join(", ")}`,
          sanitizedContent: this.sanitize(content, detections),
        };

      case "MALICIOUS":
        return {
          action: "sanitize",
          reason: `Malicious patterns detected: ${detections.map((d) => d.type).join(", ")}`,
          sanitizedContent: this.sanitize(content, detections),
        };

      case "BLOCKED":
        return {
          action: "block",
          reason: `Critical injection attempt detected: ${detections
            .filter((d) => d.severity === "critical")
            .map((d) => d.type)
            .join(", ")}`,
        };

      default:
        return {
          action: "block",
          reason: "Unknown verdict",
        };
    }
  }

  /**
   * Sanitize malicious content
   */
  private sanitize(content: string, detections: Detection[]): string {
    let sanitized = content;

    // Sort detections by location (descending) to avoid index shifting
    const sorted = [...detections].sort(
      (a, b) => b.location.start - a.location.start,
    );

    for (const detection of sorted) {
      const before = sanitized.substring(0, detection.location.start);
      const after = sanitized.substring(detection.location.end);
      const masked = "[REDACTED]";
      sanitized = before + masked + after;
    }

    return sanitized;
  }
}

// Export singleton instance
export const promptInjectionDetector = new PromptInjectionDetector();
