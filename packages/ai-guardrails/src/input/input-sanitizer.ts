import type { InputSanitizationConfig, InputSanitizationResult } from '@guardrail/core';

/** Zero-width and format characters sometimes used to smuggle instructions */
const INVISIBLE_SMUGGLE_PATTERN =
  /[\u200B-\u200D\uFEFF\u2060-\u2064\u206A-\u206F\uFE00-\uFE0F\u00AD]/g;

/**
 * Input sanitization — normalize untrusted text before it reaches the model.
 * Strips invisible Unicode, optional HTML tags, normalizes whitespace, enforces max length.
 */
export class InputSanitizer {
  sanitize(raw: string, config: InputSanitizationConfig): InputSanitizationResult {
    const start = Date.now();
    let s = raw;
    let strippedInvisible = 0;

    s = s.replace(INVISIBLE_SMUGGLE_PATTERN, (ch) => {
      strippedInvisible += ch.length;
      return '';
    });

    let strippedHtmlTags = false;
    if (config.stripHtml) {
      const before = s;
      s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
      s = s.replace(/<[^>]+>/g, '');
      strippedHtmlTags = s !== before;
    }

    if (config.normalizeUnicode) {
      s = s.normalize('NFKC');
      s = s.replace(/\s+/g, ' ').trim();
    }

    let truncated = false;
    if (s.length > config.maxLength) {
      s = s.slice(0, config.maxLength);
      truncated = true;
    }

    const applied =
      strippedInvisible > 0 ||
      strippedHtmlTags ||
      truncated ||
      (config.normalizeUnicode && s !== raw.trim());

    return {
      applied,
      originalLength: raw.length,
      resultLength: s.length,
      strippedInvisibleCount: strippedInvisible,
      strippedHtmlTags,
      truncated,
      content: s,
      processingTimeMs: Date.now() - start,
    };
  }
}

export const inputSanitizer = new InputSanitizer();
