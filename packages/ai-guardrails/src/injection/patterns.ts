/**
 * Prompt Injection Detection Patterns
 *
 * Defines patterns for detecting various types of prompt injection attempts
 */

export interface InjectionPattern {
  type: string;
  category: 'direct' | 'indirect' | 'jailbreak' | 'exfiltration' | 'obfuscation';
  patterns: RegExp[];
  keywords: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export const INJECTION_PATTERNS: InjectionPattern[] = [
  // Direct Instruction Override
  {
    type: 'instruction_override',
    category: 'direct',
    patterns: [
      /ignore (previous|all|above|prior) (instructions?|prompts?|commands?)/i,
      /disregard (previous|all|above|prior) (instructions?|prompts?|commands?)/i,
      /forget (everything|all|previous|above)/i,
      /new (instructions?|task|role|persona):/i,
      /system:\s*you are now/i,
      /\/system\s+(override|reset|new)/i,
      /SYSTEM:\s*you are now/i,
    ],
    keywords: [
      'ignore previous',
      'ignore all',
      'disregard instructions',
      'forget everything',
      'new instructions',
      'system override',
    ],
    severity: 'critical',
    description: 'Attempts to override system instructions',
  },

  // Role Hijacking
  {
    type: 'role_hijacking',
    category: 'direct',
    patterns: [
      /you are (now|actually) (a|an) (admin|root|superuser|god mode)/i,
      /act as (if you were|though you are) (admin|unrestricted)/i,
      /pretend (you are|to be) (unrestricted|unlimited|god)/i,
      /sudo mode/i,
      /developer mode/i,
      /jailbreak mode/i,
    ],
    keywords: [
      'you are now admin',
      'act as admin',
      'pretend you are',
      'sudo mode',
      'developer mode',
      'jailbreak',
      'god mode',
    ],
    severity: 'critical',
    description: 'Attempts to elevate privileges or change AI role',
  },

  // Data Exfiltration
  {
    type: 'data_exfiltration',
    category: 'exfiltration',
    patterns: [
      /print (your|the) (system|initial|original) (prompt|instructions?)/i,
      /reveal (your|the) (system|initial|original) (prompt|instructions?)/i,
      /show me (your|the) (system|prompt|instructions?)/i,
      /what (are|were) your (original|initial) (instructions?|prompt)/i,
      /echo \$\{?[A-Z_]+\}?/,
      /output (all|your) (configuration|settings?|secrets?)/i,
    ],
    keywords: [
      'print system prompt',
      'reveal instructions',
      'show me your prompt',
      'original instructions',
      'echo $',
      'output secrets',
    ],
    severity: 'high',
    description: 'Attempts to extract system prompts or configuration',
  },

  // Jailbreak Attempts
  {
    type: 'jailbreak',
    category: 'jailbreak',
    patterns: [
      /DAN mode/i,
      /do anything now/i,
      /opposite mode/i,
      /evil mode/i,
      /unfiltered (mode|responses?)/i,
      /without (any |ethical )?restrictions?/i,
      /bypass (safety|ethical) (guidelines?|constraints?)/i,
    ],
    keywords: [
      'DAN',
      'do anything now',
      'opposite mode',
      'evil mode',
      'unfiltered',
      'without restrictions',
      'bypass safety',
    ],
    severity: 'critical',
    description: 'Known jailbreak techniques',
  },

  // Encoding Evasion
  {
    type: 'encoding_evasion',
    category: 'obfuscation',
    patterns: [
      /\\x[0-9a-f]{2}/i,
      /\\u[0-9a-f]{4}/i,
      /base64[,:]?\s*[A-Za-z0-9+/=]{20,}/i,
      /rot13/i,
      /&#x?[0-9a-f]+;/i,
    ],
    keywords: ['base64', 'rot13', 'hex', 'unicode', 'encoded'],
    severity: 'medium',
    description: 'Attempts to hide malicious content through encoding',
  },

  // System Command Injection
  {
    type: 'command_injection',
    category: 'direct',
    patterns: [
      /execute (system |shell )?command:?/i,
      /run (system |shell )?command:?/i,
      /\$\(.*\)/,
      /`.*`/,
      /eval\(/i,
      /exec\(/i,
    ],
    keywords: [
      'execute command',
      'run command',
      'system command',
      'shell command',
      'eval(',
      'exec(',
    ],
    severity: 'critical',
    description: 'Attempts to execute system commands',
  },

  // Delimiter Manipulation
  {
    type: 'delimiter_manipulation',
    category: 'obfuscation',
    patterns: [
      /---BEGIN SYSTEM---/i,
      /---END USER---/i,
      /\[SYSTEM\]/i,
      /\[\/SYSTEM\]/i,
      /<\|endoftext\|>/i,
      /<\|im_start\|>/i,
    ],
    keywords: [
      'BEGIN SYSTEM',
      'END USER',
      '[SYSTEM]',
      'endoftext',
      'im_start',
      'im_end',
    ],
    severity: 'high',
    description: 'Attempts to manipulate prompt delimiters',
  },

  // Indirect Injection (Hidden in Data)
  {
    type: 'indirect_injection',
    category: 'indirect',
    patterns: [
      /<!--.*?ignore.*?-->/is,
      /\/\*.*?ignore.*?\*\//is,
      /\bhidden\s+instruction:?/i,
      /\bsecret\s+command:?/i,
    ],
    keywords: [
      'hidden instruction',
      'secret command',
      'hidden in comment',
      'ignore in data',
    ],
    severity: 'medium',
    description: 'Instructions hidden in comments or data',
  },

  // Prompt Leaking
  {
    type: 'prompt_leak',
    category: 'exfiltration',
    patterns: [
      /repeat (the |your )(above|previous|first) (message|text|instruction)/i,
      /what did i (say|tell you|ask) (first|initially|before)/i,
      /summarize (our|this) conversation/i,
    ],
    keywords: [
      'repeat above',
      'what did i say',
      'summarize conversation',
      'first message',
    ],
    severity: 'medium',
    description: 'Attempts to leak previous prompts',
  },

  // Token Manipulation
  {
    type: 'token_manipulation',
    category: 'obfuscation',
    patterns: [
      /\s{10,}/,
      /(.)\1{20,}/,
      /[\u200b-\u200d\ufeff]/,
    ],
    keywords: ['excessive whitespace', 'repeated characters', 'zero-width'],
    severity: 'low',
    description: 'Unusual token patterns that might hide malicious content',
  },
];

/**
 * Semantic patterns for embedding-based detection
 */
export const SEMANTIC_TRIGGERS = [
  'bypass security measures',
  'ignore safety protocols',
  'reveal confidential information',
  'execute unauthorized commands',
  'override system behavior',
  'pretend you have different capabilities',
  'act against your instructions',
  'violate your guidelines',
];
