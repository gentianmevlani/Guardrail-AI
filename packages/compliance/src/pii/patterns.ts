export interface PIIPattern {
  category: 'email' | 'phone' | 'ssn' | 'credit-card' | 'ip-address' | 'name-field' | 'address' | 'dob' | 'health' | 'financial';
  description: string;
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
  examples: string[];
}

/**
 * PII Detection Patterns
 */
export const PII_PATTERNS: PIIPattern[] = [
  // Email Addresses
  {
    category: 'email',
    description: 'Email address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'medium',
    examples: ['user@example.com', 'john.doe@company.co.uk']
  },

  // Phone Numbers
  {
    category: 'phone',
    description: 'US Phone number',
    pattern: /\b(\+1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    severity: 'medium',
    examples: ['+1-555-123-4567', '(555) 123-4567', '555-123-4567']
  },

  // Social Security Numbers
  {
    category: 'ssn',
    description: 'US Social Security Number',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    severity: 'high',
    examples: ['123-45-6789']
  },

  // Credit Card Numbers (Luhn algorithm pattern)
  {
    category: 'credit-card',
    description: 'Credit card number',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    severity: 'high',
    examples: ['4532-1234-5678-9010', '5425 2334 3010 9903']
  },

  // IP Addresses
  {
    category: 'ip-address',
    description: 'IPv4 address',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    severity: 'low',
    examples: ['192.168.1.1', '10.0.0.1']
  }
];

/**
 * Field name patterns that suggest PII
 */
export const PII_FIELD_PATTERNS = [
  // Name fields
  { pattern: /\b(first_?name|last_?name|full_?name|given_?name|family_?name)\b/i, category: 'name-field', severity: 'medium' as const },
  { pattern: /\b(name)\b/i, category: 'name-field', severity: 'low' as const },

  // Email fields
  { pattern: /\b(email|e_?mail|email_?address)\b/i, category: 'email', severity: 'medium' as const },

  // Phone fields
  { pattern: /\b(phone|telephone|mobile|cell_?phone)\b/i, category: 'phone', severity: 'medium' as const },

  // Address fields
  { pattern: /\b(address|street|city|state|zip|postal_?code|country)\b/i, category: 'address', severity: 'medium' as const },
  { pattern: /\b(billing_?address|shipping_?address|home_?address)\b/i, category: 'address', severity: 'high' as const },

  // Date of Birth
  { pattern: /\b(dob|date_?of_?birth|birth_?date|birthday)\b/i, category: 'dob', severity: 'high' as const },

  // Social Security
  { pattern: /\b(ssn|social_?security|national_?id)\b/i, category: 'ssn', severity: 'high' as const },

  // Financial
  { pattern: /\b(credit_?card|card_?number|cvv|cvc|account_?number|routing_?number|iban)\b/i, category: 'financial', severity: 'high' as const },
  { pattern: /\b(salary|income|tax_?id|ein)\b/i, category: 'financial', severity: 'high' as const },

  // Health
  { pattern: /\b(medical_?record|patient_?id|diagnosis|prescription|health_?insurance)\b/i, category: 'health', severity: 'high' as const },
  { pattern: /\b(blood_?type|allergies|medication)\b/i, category: 'health', severity: 'high' as const },

  // Authentication
  { pattern: /\b(password|passwd|pwd|secret|token|api_?key)\b/i, category: 'financial', severity: 'high' as const }
];

/**
 * Test values that should be excluded
 */
export const PII_TEST_VALUES = [
  'test@example.com',
  'user@example.com',
  'admin@example.com',
  'noreply@example.com',
  '555-0100', // Reserved for testing
  '555-0199',
  '000-00-0000', // Invalid SSN
  '123-45-6789', // Well-known fake SSN
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  'example.com',
  'test.com'
];

/**
 * Context indicators that suggest non-PII usage
 */
export const NON_PII_CONTEXT_INDICATORS = [
  'example',
  'test',
  'demo',
  'sample',
  'placeholder',
  'fake',
  'mock',
  'dummy',
  'template',
  'default'
];
