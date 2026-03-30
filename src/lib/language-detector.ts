/**
 * Language Detector
 * 
 * Detects programming languages and provides language-specific guardrails
 */

import * as fs from 'fs';
import * as path from 'path';
import { GuardrailRule } from './universal-guardrails';

export type Language = 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'java' | 'unknown';

export interface LanguageInfo {
  language: Language;
  extensions: string[];
  linter?: string;
  formatter?: string;
  typeChecker?: string;
  rules: GuardrailRule[];
}

class LanguageDetector {
  private languageRules: Map<Language, GuardrailRule[]> = new Map();

  constructor() {
    this.initializeLanguageRules();
  }

  /**
   * Detect language from file path
   */
  detectLanguage(file: string): Language {
    const ext = path.extname(file).toLowerCase();

    const extensionMap: Record<string, Language> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.rs': 'rust',
      '.go': 'go',
      '.java': 'java',
    };

    return extensionMap[ext] || 'unknown';
  }

  /**
   * Detect language from project
   */
  async detectProjectLanguage(projectPath: string): Promise<Language[]> {
    const languages = new Set<Language>();

    const packageJson = path.join(projectPath, 'package.json');
    const cargoToml = path.join(projectPath, 'Cargo.toml');
    const goMod = path.join(projectPath, 'go.mod');
    const requirementsTxt = path.join(projectPath, 'requirements.txt');
    const pomXml = path.join(projectPath, 'pom.xml');

    if (await this.pathExists(packageJson)) {
      const content = await fs.promises.readFile(packageJson, 'utf8');
      const pkg = JSON.parse(content);
      if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) {
        languages.add('typescript');
      } else {
        languages.add('javascript');
      }
    }

    if (await this.pathExists(cargoToml)) {
      languages.add('rust');
    }

    if (await this.pathExists(goMod)) {
      languages.add('go');
    }

    if (await this.pathExists(requirementsTxt)) {
      languages.add('python');
    }

    if (await this.pathExists(pomXml)) {
      languages.add('java');
    }

    return Array.from(languages);
  }

  /**
   * Get language-specific rules
   */
  getLanguageRules(language: Language): GuardrailRule[] {
    return this.languageRules.get(language) || [];
  }

  /**
   * Get language info
   */
  getLanguageInfo(language: Language): LanguageInfo | null {
    const infoMap: Record<Language, LanguageInfo> = {
      typescript: {
        language: 'typescript',
        extensions: ['.ts', '.tsx'],
        linter: 'eslint',
        formatter: 'prettier',
        typeChecker: 'typescript',
        rules: this.getLanguageRules('typescript'),
      },
      javascript: {
        language: 'javascript',
        extensions: ['.js', '.jsx'],
        linter: 'eslint',
        formatter: 'prettier',
        rules: this.getLanguageRules('javascript'),
      },
      python: {
        language: 'python',
        extensions: ['.py'],
        linter: 'pylint',
        formatter: 'black',
        typeChecker: 'mypy',
        rules: this.getLanguageRules('python'),
      },
      rust: {
        language: 'rust',
        extensions: ['.rs'],
        linter: 'clippy',
        formatter: 'rustfmt',
        typeChecker: 'rustc',
        rules: this.getLanguageRules('rust'),
      },
      go: {
        language: 'go',
        extensions: ['.go'],
        linter: 'golangci-lint',
        formatter: 'gofmt',
        rules: this.getLanguageRules('go'),
      },
      java: {
        language: 'java',
        extensions: ['.java'],
        linter: 'checkstyle',
        formatter: 'google-java-format',
        rules: this.getLanguageRules('java'),
      },
      unknown: {
        language: 'unknown',
        extensions: [],
        rules: [],
      },
    };

    return infoMap[language] || null;
  }

  /**
   * Initialize language-specific rules
   */
  private initializeLanguageRules(): void {
    // TypeScript rules (already in universal guardrails)
    this.languageRules.set('typescript', [
      {
        id: 'no-any-type',
        name: 'No Any Type',
        description: 'Prevent using "any" type in TypeScript',
        severity: 'warning',
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return true;
          return !/:\s*any\b/.test(content);
        },
      },
    ]);

    // Python rules
    this.languageRules.set('python', [
      {
        id: 'no-bare-except',
        name: 'No Bare Except',
        description: 'Avoid bare except clauses',
        severity: 'error',
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          if (!filePath.endsWith('.py')) return true;
          return !/except\s*:/g.test(content);
        },
      },
      {
        id: 'use-type-hints',
        name: 'Use Type Hints',
        description: 'Use type hints for function parameters and return types',
        severity: 'warning',
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          if (!filePath.endsWith('.py')) return true;
          // Simplified check - would need proper parsing
          return true;
        },
      },
    ]);

    // Rust rules
    this.languageRules.set('rust', [
      {
        id: 'no-unwrap',
        name: 'Avoid Unwrap',
        description: 'Prefer proper error handling over unwrap()',
        severity: 'warning',
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          if (!filePath.endsWith('.rs')) return true;
          return !/\.unwrap\(\)/g.test(content);
        },
      },
    ]);

    // Go rules
    this.languageRules.set('go', [
      {
        id: 'handle-errors',
        name: 'Handle Errors',
        description: 'Always handle errors, never ignore them',
        severity: 'error',
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          if (!filePath.endsWith('.go')) return true;
          // Check for ignored errors: _, err := ...
          return !/_,\s*err\s*:=\s*[^;]+;\s*$/gm.test(content);
        },
      },
    ]);

    // JavaScript rules (subset of TypeScript)
    this.languageRules.set('javascript', [
      {
        id: 'no-var',
        name: 'No Var',
        description: 'Use let or const instead of var',
        severity: 'error',
        platforms: ['all'],
        check: async (filePath: string, content: string) => {
          if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return true;
          return !/\bvar\s+/g.test(content);
        },
      },
    ]);
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const languageDetector = new LanguageDetector();

