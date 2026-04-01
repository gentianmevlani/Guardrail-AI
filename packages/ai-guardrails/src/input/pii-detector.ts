import {
  PIIType,
  PIIEntity,
  PIIScanResult,
} from '@guardrail/core';

/**
 * PII Detector — Input Guardrail
 *
 * Detects and redacts Personally Identifiable Information in user inputs
 * before they reach the LLM. Supports emails, phone numbers, SSNs,
 * credit cards, API keys, passwords, addresses, and more.
 */
export class PIIDetector {
  private detectors: Map<PIIType, PIIPattern[]> = new Map();
  private redactionStrategies: Map<PIIType, (value: string) => string> = new Map();

  constructor() {
    this.registerDefaultDetectors();
    this.registerDefaultRedactionStrategies();
  }

  /**
   * Scan content for PII entities
   */
  async scan(content: string, options?: {
    typesToDetect?: PIIType[];
    redact?: boolean;
    minConfidence?: number;
  }): Promise<PIIScanResult> {
    const startTime = Date.now();
    const entities: PIIEntity[] = [];
    const typesToCheck = options?.typesToDetect || Array.from(this.detectors.keys());
    const minConfidence = options?.minConfidence ?? 0.7;

    for (const piiType of typesToCheck) {
      const patterns = this.detectors.get(piiType);
      if (!patterns) continue;

      for (const detector of patterns) {
        const regex = new RegExp(detector.pattern, 'gi');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          const value = match[0];
          const confidence = detector.validator
            ? detector.validator(value) ? detector.confidence : detector.confidence * 0.5
            : detector.confidence;

          if (confidence < minConfidence) continue;

          entities.push({
            type: piiType,
            value,
            redactedValue: this.redact(piiType, value),
            location: { start: match.index, end: match.index + value.length },
            confidence,
          });
        }
      }
    }

    // Deduplicate overlapping detections (keep highest confidence)
    const deduped = this.deduplicateEntities(entities);

    const redactedContent = options?.redact !== false
      ? this.applyRedactions(content, deduped)
      : content;

    return {
      containsPII: deduped.length > 0,
      entities: deduped,
      redactedContent,
      riskLevel: this.calculateRiskLevel(deduped),
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Register a custom PII detector
   */
  registerDetector(type: PIIType, pattern: PIIPattern): void {
    const existing = this.detectors.get(type) || [];
    existing.push(pattern);
    this.detectors.set(type, existing);
  }

  /**
   * Register a custom redaction strategy
   */
  registerRedactionStrategy(type: PIIType, strategy: (value: string) => string): void {
    this.redactionStrategies.set(type, strategy);
  }

  private redact(type: PIIType, value: string): string {
    const strategy = this.redactionStrategies.get(type);
    if (strategy) return strategy(value);
    return '[REDACTED]';
  }

  private applyRedactions(content: string, entities: PIIEntity[]): string {
    let result = content;
    // Sort by position descending to avoid offset issues
    const sorted = [...entities].sort((a, b) => b.location.start - a.location.start);

    for (const entity of sorted) {
      result =
        result.slice(0, entity.location.start) +
        entity.redactedValue +
        result.slice(entity.location.end);
    }

    return result;
  }

  private deduplicateEntities(entities: PIIEntity[]): PIIEntity[] {
    if (entities.length <= 1) return entities;

    const sorted = [...entities].sort((a, b) => a.location.start - b.location.start);
    const result: PIIEntity[] = [];

    for (const entity of sorted) {
      const overlapping = result.find(
        (existing) =>
          entity.location.start < existing.location.end &&
          entity.location.end > existing.location.start
      );

      if (overlapping) {
        if (entity.confidence > overlapping.confidence) {
          const idx = result.indexOf(overlapping);
          result[idx] = entity;
        }
      } else {
        result.push(entity);
      }
    }

    return result;
  }

  private calculateRiskLevel(
    entities: PIIEntity[]
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (entities.length === 0) return 'none';

    const criticalTypes: PIIType[] = ['ssn', 'credit_card', 'passport', 'driver_license', 'api_key', 'password'];
    const highTypes: PIIType[] = ['date_of_birth', 'address', 'phone'];
    const mediumTypes: PIIType[] = ['email', 'name', 'ip_address'];

    if (entities.some((e) => criticalTypes.includes(e.type))) return 'critical';
    if (entities.some((e) => highTypes.includes(e.type))) return 'high';
    if (entities.some((e) => mediumTypes.includes(e.type))) return 'medium';
    return 'low';
  }

  private registerDefaultDetectors(): void {
    // Email
    this.detectors.set('email', [{
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      confidence: 0.95,
      validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    }]);

    // Phone numbers (US, international)
    this.detectors.set('phone', [{
      pattern: '(?:\\+?1[-.]?)?\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}',
      confidence: 0.85,
    }, {
      pattern: '\\+\\d{1,3}[-.]?\\d{1,4}[-.]?\\d{1,4}[-.]?\\d{1,9}',
      confidence: 0.8,
    }]);

    // SSN
    this.detectors.set('ssn', [{
      pattern: '\\b\\d{3}[-]?\\d{2}[-]?\\d{4}\\b',
      confidence: 0.9,
      validator: (v: string) => {
        const digits = v.replace(/\D/g, '');
        if (digits.length !== 9) return false;
        if (digits.startsWith('000') || digits.startsWith('666')) return false;
        if (digits.substring(0, 3) === '900') return false;
        return true;
      },
    }]);

    // Credit card numbers
    this.detectors.set('credit_card', [{
      pattern: '\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\\b',
      confidence: 0.95,
      validator: (v: string) => this.luhnCheck(v.replace(/\D/g, '')),
    }, {
      pattern: '\\b\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}\\b',
      confidence: 0.85,
      validator: (v: string) => this.luhnCheck(v.replace(/\D/g, '')),
    }]);

    // IP addresses
    this.detectors.set('ip_address', [{
      pattern: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
      confidence: 0.9,
    }]);

    // API keys (generic patterns)
    this.detectors.set('api_key', [{
      pattern: '(?:sk|pk|api|key|token|secret|access)[-_]?(?:live|test|prod)?[-_]?[a-zA-Z0-9]{20,}',
      confidence: 0.85,
    }, {
      pattern: 'Bearer\\s+[a-zA-Z0-9._-]{20,}',
      confidence: 0.9,
    }, {
      pattern: '(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}',
      confidence: 0.95,
    }, {
      pattern: 'xox[bpors]-[a-zA-Z0-9-]{10,}',
      confidence: 0.95,
    }]);

    // Passwords (in assignment context)
    this.detectors.set('password', [{
      pattern: '(?:password|passwd|pwd|pass)\\s*[=:]\\s*["\']?[^\\s"\']{4,}["\']?',
      confidence: 0.85,
    }, {
      pattern: '(?:password|passwd|pwd|pass)\\s*[=:]\\s*"[^"]{4,}"',
      confidence: 0.9,
    }]);

    // Date of birth
    this.detectors.set('date_of_birth', [{
      pattern: '(?:born|dob|date of birth|birthday)[:\\s]+(?:\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4})',
      confidence: 0.85,
    }, {
      pattern: '(?:born|dob|date of birth|birthday)[:\\s]+(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2},?\\s+\\d{4})',
      confidence: 0.9,
    }]);

    // Address (US)
    this.detectors.set('address', [{
      pattern: '\\d{1,5}\\s+\\w+\\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|Circle|Cir|Way|Place|Pl)\\.?(?:\\s+(?:Apt|Suite|Ste|Unit|#)\\s*\\w+)?',
      confidence: 0.75,
    }]);

    // Passport number
    this.detectors.set('passport', [{
      pattern: '(?:passport)\\s*(?:#|no\\.?|number)?\\s*[:]?\\s*[A-Z0-9]{6,9}',
      confidence: 0.8,
    }]);

    // Driver's license
    this.detectors.set('driver_license', [{
      pattern: '(?:driver.?s?\\s*license|DL)\\s*(?:#|no\\.?|number)?\\s*[:]?\\s*[A-Z0-9]{5,15}',
      confidence: 0.75,
    }]);
  }

  private registerDefaultRedactionStrategies(): void {
    this.redactionStrategies.set('email', (v) => {
      const [local, domain] = v.split('@');
      return `${local?.[0] ?? ''}***@${domain ?? '***'}`;
    });
    this.redactionStrategies.set('phone', (v) => {
      const digits = v.replace(/\D/g, '');
      return `***-***-${digits.slice(-4)}`;
    });
    this.redactionStrategies.set('ssn', () => '***-**-****');
    this.redactionStrategies.set('credit_card', (v) => {
      const digits = v.replace(/\D/g, '');
      return `****-****-****-${digits.slice(-4)}`;
    });
    this.redactionStrategies.set('ip_address', () => '***.***.***.***');
    this.redactionStrategies.set('api_key', () => '[API_KEY_REDACTED]');
    this.redactionStrategies.set('password', () => '[PASSWORD_REDACTED]');
    this.redactionStrategies.set('date_of_birth', () => '[DOB_REDACTED]');
    this.redactionStrategies.set('address', () => '[ADDRESS_REDACTED]');
    this.redactionStrategies.set('passport', () => '[PASSPORT_REDACTED]');
    this.redactionStrategies.set('driver_license', () => '[DL_REDACTED]');
    this.redactionStrategies.set('name', () => '[NAME_REDACTED]');
  }

  private luhnCheck(num: string): boolean {
    if (num.length < 13 || num.length > 19) return false;
    let sum = 0;
    let alternate = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = parseInt(num[i]!, 10);
      if (alternate) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 === 0;
  }
}

interface PIIPattern {
  pattern: string;
  confidence: number;
  validator?: (value: string) => boolean;
}

export const piiDetector = new PIIDetector();
