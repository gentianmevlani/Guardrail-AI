import {
  PIIEntity,
  PIILeakageResult,
  PIIType,
} from '@guardrail/core';
import { piiDetector } from '../input/pii-detector';

/**
 * PII Leakage Scanner — Output Guardrail
 *
 * Prevents PII from leaking in LLM responses. Cross-references
 * detected PII against the original user input to determine source
 * (user-provided vs. hallucinated/training data leakage).
 */
export class PIILeakageScanner {
  private sensitiveTypes: Set<PIIType> = new Set([
    'ssn', 'credit_card', 'passport', 'driver_license',
    'api_key', 'password',
  ]);

  /**
   * Scan LLM output for PII leakage
   */
  async scan(
    output: string,
    options?: {
      originalInput?: string;
      contextDocuments?: string[];
      scrub?: boolean;
      allowedTypes?: PIIType[];
    }
  ): Promise<PIILeakageResult> {
    // Detect PII in the output
    const outputScan = await piiDetector.scan(output, { redact: false });

    if (!outputScan.containsPII) {
      return {
        hasLeakage: false,
        leakedEntities: [],
        scrubbed: output,
        sourceCorrelation: [],
        riskLevel: 'none',
      };
    }

    // Filter out allowed types
    const allowedTypes = new Set(options?.allowedTypes || []);
    const potentialLeaks = outputScan.entities.filter(
      (e) => !allowedTypes.has(e.type)
    );

    if (potentialLeaks.length === 0) {
      return {
        hasLeakage: false,
        leakedEntities: [],
        scrubbed: output,
        sourceCorrelation: [],
        riskLevel: 'none',
      };
    }

    // Cross-reference with input to determine source
    const inputPII = options?.originalInput
      ? (await piiDetector.scan(options.originalInput, { redact: false })).entities
      : [];

    const contextPII: PIIEntity[] = [];
    if (options?.contextDocuments) {
      for (const doc of options.contextDocuments) {
        const docScan = await piiDetector.scan(doc, { redact: false });
        contextPII.push(...docScan.entities);
      }
    }

    const sourceCorrelation = potentialLeaks.map((outputEntity) => ({
      outputEntity,
      possibleSource: this.correlateSource(outputEntity, inputPII, contextPII),
    }));

    // Determine which are true leakages (not from user input)
    const leakedEntities = sourceCorrelation
      .filter((sc) => sc.possibleSource !== 'user_input')
      .map((sc) => sc.outputEntity);

    // Also flag any sensitive type even if from user input
    const sensitiveLeaks = potentialLeaks.filter(
      (e) => this.sensitiveTypes.has(e.type)
    );

    const allLeaks = this.deduplicateByValue([...leakedEntities, ...sensitiveLeaks]);

    // Scrub output if requested
    const scrubbed = options?.scrub !== false
      ? this.scrubOutput(output, allLeaks)
      : output;

    return {
      hasLeakage: allLeaks.length > 0,
      leakedEntities: allLeaks,
      scrubbed,
      sourceCorrelation: sourceCorrelation as PIILeakageResult['sourceCorrelation'],
      riskLevel: this.calculateRiskLevel(allLeaks),
    };
  }

  /**
   * Configure which PII types are considered sensitive (always scrubbed)
   */
  setSensitiveTypes(types: PIIType[]): void {
    this.sensitiveTypes = new Set(types);
  }

  private correlateSource(
    outputEntity: PIIEntity,
    inputPII: PIIEntity[],
    contextPII: PIIEntity[]
  ): 'user_input' | 'training_data' | 'context' | 'unknown' {
    // Check if the value was present in user input
    const normalizedOutput = this.normalizeValue(outputEntity.value);

    for (const inputEntity of inputPII) {
      if (
        inputEntity.type === outputEntity.type &&
        this.normalizeValue(inputEntity.value) === normalizedOutput
      ) {
        return 'user_input';
      }
    }

    // Check if it was in context documents
    for (const contextEntity of contextPII) {
      if (
        contextEntity.type === outputEntity.type &&
        this.normalizeValue(contextEntity.value) === normalizedOutput
      ) {
        return 'context';
      }
    }

    // If PII appears in output but not in any known source, it's likely
    // from training data or hallucinated — this is the most dangerous case
    return outputEntity.confidence > 0.9 ? 'training_data' : 'unknown';
  }

  private normalizeValue(value: string): string {
    return value.replace(/[\s\-().]/g, '').toLowerCase();
  }

  private scrubOutput(output: string, entities: PIIEntity[]): string {
    let scrubbed = output;
    // Sort by position descending
    const sorted = [...entities].sort((a, b) => b.location.start - a.location.start);

    for (const entity of sorted) {
      scrubbed =
        scrubbed.slice(0, entity.location.start) +
        entity.redactedValue +
        scrubbed.slice(entity.location.end);
    }

    return scrubbed;
  }

  private deduplicateByValue(entities: PIIEntity[]): PIIEntity[] {
    const seen = new Set<string>();
    return entities.filter((e) => {
      const key = `${e.type}:${e.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateRiskLevel(
    entities: PIIEntity[]
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (entities.length === 0) return 'none';

    if (entities.some((e) => this.sensitiveTypes.has(e.type))) return 'critical';
    if (entities.length > 5) return 'high';
    if (entities.length > 2) return 'medium';
    return 'low';
  }
}

export const piiLeakageScanner = new PIILeakageScanner();
