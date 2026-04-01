/**
 * Format Validator
 * Validates and parses guardrail-v1 agent output format
 */

import {
  StrictAgentOutput,
  FORMAT_RETRY_PROMPT,
  DIFF_FORMAT_RETRY_PROMPT,
} from './types';

export interface FormatValidationResult {
  valid: boolean;
  output?: StrictAgentOutput;
  retryPrompt?: string;
  error?: string;
}

/**
 * Extract JSON from raw agent response
 * Accepts raw JSON or a single ```json fenced block
 */
function extractJson(raw: string): string | null {
  const trimmed = raw.trim();

  // Try to parse as raw JSON first
  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  // Look for ```json fenced block
  const jsonFenceMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonFenceMatch) {
    return jsonFenceMatch[1].trim();
  }

  // Look for ``` fenced block (no language specified)
  const plainFenceMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/);
  if (plainFenceMatch) {
    const content = plainFenceMatch[1].trim();
    if (content.startsWith('{')) {
      return content;
    }
  }

  return null;
}

/**
 * Validate that a string looks like a unified diff
 */
function isValidDiffStructure(diff: string): boolean {
  if (!diff || typeof diff !== 'string' || diff.trim().length === 0) {
    return false;
  }

  const hasDiffHeader = diff.includes('diff --git') || diff.includes('diff -');
  const hasOldFileMarker = diff.includes('---');
  const hasNewFileMarker = diff.includes('+++');
  const hasHunkHeader = /@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(diff);

  return hasDiffHeader && hasOldFileMarker && hasNewFileMarker && hasHunkHeader;
}

/**
 * Validate the guardrail-v1 format
 */
export function validateFormat(raw: string): FormatValidationResult {
  if (!raw || typeof raw !== 'string') {
    return {
      valid: false,
      retryPrompt: FORMAT_RETRY_PROMPT,
      error: 'Empty or invalid input',
    };
  }

  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    return {
      valid: false,
      retryPrompt: FORMAT_RETRY_PROMPT,
      error: 'Could not extract JSON from response. Expected raw JSON or a single ```json block.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    return {
      valid: false,
      retryPrompt: FORMAT_RETRY_PROMPT,
      error: `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      retryPrompt: FORMAT_RETRY_PROMPT,
      error: 'Response must be a JSON object',
    };
  }

  const obj = parsed as Record<string, unknown>;

  // Check format field
  if (obj.format !== 'guardrail-v1') {
    return {
      valid: false,
      retryPrompt: FORMAT_RETRY_PROMPT,
      error: `Invalid format field. Expected "guardrail-v1", got "${String(obj.format)}"`,
    };
  }

  // If error field exists, surface it (do not auto-retry)
  if (typeof obj.error === 'string' && obj.error.length > 0) {
    return {
      valid: true,
      output: {
        format: 'guardrail-v1',
        diff: '',
        error: obj.error,
      },
    };
  }

  // Validate diff field
  if (typeof obj.diff !== 'string') {
    return {
      valid: false,
      retryPrompt: FORMAT_RETRY_PROMPT,
      error: 'Missing or invalid "diff" field. Must be a string.',
    };
  }

  if (obj.diff.trim().length === 0) {
    return {
      valid: false,
      retryPrompt: DIFF_FORMAT_RETRY_PROMPT,
      error: 'The "diff" field is empty.',
    };
  }

  if (!isValidDiffStructure(obj.diff)) {
    return {
      valid: false,
      retryPrompt: DIFF_FORMAT_RETRY_PROMPT,
      error: 'The "diff" field does not contain a valid unified diff structure.',
    };
  }

  // Validate optional fields
  const commands = validateStringArray(obj.commands, 'commands');
  if (commands.error) {
    return {
      valid: false,
      retryPrompt: FORMAT_RETRY_PROMPT,
      error: commands.error,
    };
  }

  const tests = validateStringArray(obj.tests, 'tests');
  if (tests.error) {
    return {
      valid: false,
      retryPrompt: FORMAT_RETRY_PROMPT,
      error: tests.error,
    };
  }

  if (obj.notes !== undefined && typeof obj.notes !== 'string') {
    return {
      valid: false,
      retryPrompt: FORMAT_RETRY_PROMPT,
      error: 'The "notes" field must be a string if provided.',
    };
  }

  // Build validated output
  const output: StrictAgentOutput = {
    format: 'guardrail-v1',
    diff: obj.diff,
  };

  if (commands.value && commands.value.length > 0) {
    output.commands = commands.value;
  }

  if (tests.value && tests.value.length > 0) {
    output.tests = tests.value;
  }

  if (typeof obj.notes === 'string' && obj.notes.length > 0) {
    output.notes = obj.notes;
  }

  return {
    valid: true,
    output,
  };
}

function validateStringArray(
  value: unknown,
  fieldName: string
): { value?: string[]; error?: string } {
  if (value === undefined || value === null) {
    return { value: undefined };
  }

  if (!Array.isArray(value)) {
    return { error: `The "${fieldName}" field must be an array if provided.` };
  }

  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      return { error: `The "${fieldName}" field must contain only strings. Item at index ${i} is not a string.` };
    }
  }

  return { value: value as string[] };
}
