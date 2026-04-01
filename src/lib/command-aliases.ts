/**
 * Command Aliases
 * 
 * Maps natural language to actual commands
 */

export const commandAliases: Record<string, string[]> = {
  analyze: [
    'analyze',
    'check',
    'review',
    'inspect',
    'examine',
    'look at',
    'what\'s wrong',
    'what\'s the problem',
    'find issues',
  ],
  polish: [
    'polish',
    'improve',
    'fix',
    'clean up',
    'refine',
    'make better',
    'enhance',
  ],
  'train-model': [
    'train',
    'learn',
    'teach',
    'build model',
    'train model',
  ],
  setup: [
    'setup',
    'install',
    'initialize',
    'init',
    'configure',
    'get started',
  ],
  'vibecoder-check': [
    'vibecoder',
    'what am i missing',
    'what did i forget',
    'check readiness',
    'can i ship',
    'am i ready',
    'what\'s missing',
  ],
  'install-platform': [
    'install platform',
    'add platform',
    'setup platform',
    'deploy to',
  ],
  help: [
    'help',
    'what can you do',
    'commands',
    'options',
    'how do i',
  ],
  status: [
    'status',
    'health',
    'how am i doing',
    'what\'s my score',
    'project status',
  ],
};

/**
 * Find command from natural language
 */
export function findCommand(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  for (const [command, aliases] of Object.entries(commandAliases)) {
    if (aliases.some(alias => normalized.includes(alias))) {
      return command;
    }
  }

  return null;
}

