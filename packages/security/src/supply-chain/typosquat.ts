/**
 * Typosquatting Detection
 *
 * Detects potential typosquatting attacks against popular packages
 */

/**
 * Top 100 most popular npm packages (simplified list)
 */
const POPULAR_PACKAGES = [
  'react', 'vue', 'angular', 'express', 'next', 'axios', 'lodash', 'webpack',
  'typescript', 'eslint', 'prettier', 'jest', 'mocha', 'chai', 'babel',
  'moment', 'dayjs', 'date-fns', 'redux', 'mobx', 'rxjs', 'socket.io',
  'fastify', 'koa', 'hapi', 'nestjs', 'prisma', 'mongoose', 'sequelize',
  'typeorm', 'knex', 'pg', 'mysql', 'redis', 'mongodb', 'sqlite3',
  'passport', 'jsonwebtoken', 'bcrypt', 'crypto-js', 'uuid', 'nanoid',
  'dotenv', 'config', 'yargs', 'commander', 'inquirer', 'chalk', 'ora',
  'debug', 'winston', 'pino', 'morgan', 'cors', 'helmet', 'compression',
  'multer', 'body-parser', 'cookie-parser', 'express-session', 'passport',
  'nodemailer', 'sendgrid', 'twilio', 'stripe', 'aws-sdk', 'google-cloud',
  'firebase', 'azure', 'docker', 'kubernetes', 'terraform', 'ansible',
  'jenkins', 'gitlab', 'github', 'bitbucket', 'jira', 'confluence',
  'slack', 'discord', 'telegram', 'whatsapp', 'sentry', 'datadog',
  'newrelic', 'prometheus', 'grafana', 'elasticsearch', 'kibana', 'logstash',
  'kafka', 'rabbitmq', 'celery', 'bull', 'agenda', 'cron', 'node-schedule',
];

export interface TyposquatResult {
  isTyposquat: boolean;
  suspiciousPackage: string;
  targetPackage?: string;
  similarity: number;
  patterns: string[];
}

export class TyposquatDetector {
  private popularPackages: Set<string>;

  constructor() {
    this.popularPackages = new Set(POPULAR_PACKAGES);
  }

  /**
   * Detect typosquatting
   */
  async detectTyposquatting(packageName: string): Promise<TyposquatResult> {
    const patterns: string[] = [];
    let targetPackage: string | undefined;
    let maxSimilarity = 0;

    // Check against popular packages
    for (const popular of this.popularPackages) {
      // Skip if exact match
      if (packageName === popular) {
        continue;
      }

      // Check various typosquatting techniques
      const techniques = [
        this.checkCharacterSwap(packageName, popular),
        this.checkMissingCharacter(packageName, popular),
        this.checkExtraCharacter(packageName, popular),
        this.checkHomoglyph(packageName, popular),
        this.checkCombosquatting(packageName, popular),
        this.checkLevenshtein(packageName, popular),
      ];

      for (const technique of techniques) {
        if (technique.isMatch) {
          patterns.push(technique.pattern);

          if (technique.similarity > maxSimilarity) {
            maxSimilarity = technique.similarity;
            targetPackage = popular;
          }
        }
      }
    }

    return {
      isTyposquat: patterns.length > 0,
      suspiciousPackage: packageName,
      targetPackage,
      similarity: maxSimilarity,
      patterns,
    };
  }

  /**
   * Check for character swap (e.g., raect vs react)
   */
  private checkCharacterSwap(pkg: string, popular: string): { isMatch: boolean; pattern: string; similarity: number } {
    if (Math.abs(pkg.length - popular.length) > 0) {
      return { isMatch: false, pattern: '', similarity: 0 };
    }

    // Try swapping adjacent characters
    for (let i = 0; i < popular.length - 1; i++) {
      const swapped = popular.substring(0, i) +
                     popular[i + 1] +
                     popular[i] +
                     popular.substring(i + 2);

      if (swapped === pkg) {
        return {
          isMatch: true,
          pattern: 'character_swap',
          similarity: 0.95,
        };
      }
    }

    return { isMatch: false, pattern: '', similarity: 0 };
  }

  /**
   * Check for missing character (e.g., reat vs react)
   */
  private checkMissingCharacter(pkg: string, popular: string): { isMatch: boolean; pattern: string; similarity: number } {
    if (pkg.length !== popular.length - 1) {
      return { isMatch: false, pattern: '', similarity: 0 };
    }

    // Try removing each character
    for (let i = 0; i < popular.length; i++) {
      const removed = popular.substring(0, i) + popular.substring(i + 1);

      if (removed === pkg) {
        return {
          isMatch: true,
          pattern: 'missing_character',
          similarity: 0.9,
        };
      }
    }

    return { isMatch: false, pattern: '', similarity: 0 };
  }

  /**
   * Check for extra character (e.g., reactt vs react)
   */
  private checkExtraCharacter(pkg: string, popular: string): { isMatch: boolean; pattern: string; similarity: number } {
    if (pkg.length !== popular.length + 1) {
      return { isMatch: false, pattern: '', similarity: 0 };
    }

    // Try removing each character from pkg
    for (let i = 0; i < pkg.length; i++) {
      const removed = pkg.substring(0, i) + pkg.substring(i + 1);

      if (removed === popular) {
        return {
          isMatch: true,
          pattern: 'extra_character',
          similarity: 0.9,
        };
      }
    }

    return { isMatch: false, pattern: '', similarity: 0 };
  }

  /**
   * Check for homoglyph substitution (e.g., react with Cyrillic 'а')
   */
  private checkHomoglyph(pkg: string, popular: string): { isMatch: boolean; pattern: string; similarity: number } {
    // Common homoglyphs
    const homoglyphs: Record<string, string[]> = {
      'a': ['а', 'ɑ', 'α'],  // Cyrillic/Greek a
      'e': ['е', ' е'],       // Cyrillic e
      'o': ['о', 'ο', '0'],  // Cyrillic/Greek o, zero
      'i': ['і', 'ı', 'l', '1'], // Cyrillic i, Turkish i, l, one
      'c': ['с', 'ϲ'],       // Cyrillic c
      'p': ['р'],            // Cyrillic p
      'x': ['х', 'χ'],       // Cyrillic/Greek x
    };

    // Normalize both strings
    const normalize = (str: string): string => {
      let normalized = str;
      for (const [latin, alternates] of Object.entries(homoglyphs)) {
        for (const alt of alternates) {
          normalized = normalized.replace(new RegExp(alt, 'g'), latin);
        }
      }
      return normalized;
    };

    const normalizedPkg = normalize(pkg);

    if (normalizedPkg === popular && normalizedPkg !== pkg) {
      return {
        isMatch: true,
        pattern: 'homoglyph',
        similarity: 0.95,
      };
    }

    return { isMatch: false, pattern: '', similarity: 0 };
  }

  /**
   * Check for combosquatting (e.g., react-native-safe vs react)
   */
  private checkCombosquatting(pkg: string, popular: string): { isMatch: boolean; pattern: string; similarity: number } {
    if (pkg.includes(popular) && pkg !== popular) {
      // Check if it's just adding common suffixes/prefixes
      const commonAdditions = ['-js', '-node', '-utils', '-core', '-plugin', '-webpack', '-babel'];

      for (const addition of commonAdditions) {
        if (pkg === popular + addition || pkg === addition + popular) {
          return {
            isMatch: true,
            pattern: 'combosquatting',
            similarity: 0.7,
          };
        }
      }
    }

    return { isMatch: false, pattern: '', similarity: 0 };
  }

  /**
   * Check Levenshtein distance
   */
  private checkLevenshtein(pkg: string, popular: string): { isMatch: boolean; pattern: string; similarity: number } {
    const distance = this.levenshteinDistance(pkg, popular);
    const maxLength = Math.max(pkg.length, popular.length);
    const similarity = 1 - (distance / maxLength);

    // Consider it suspicious if similarity > 0.8
    if (similarity >= 0.8 && similarity < 1.0) {
      return {
        isMatch: true,
        pattern: 'levenshtein_distance',
        similarity,
      };
    }

    return { isMatch: false, pattern: '', similarity: 0 };
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    // Initialize matrix with proper dimensions
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [];
      for (let j = 0; j <= a.length; j++) {
        matrix[i]![j] = 0;
      }
    }
    
    // Set first column
    for (let i = 0; i <= b.length; i++) {
      matrix[i]![0] = i;
    }

    // Set first row
    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1,     // insertion
            matrix[i - 1]![j]! + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length]![a.length]!;
  }

  /**
   * Get popular packages list
   */
  async getPopularPackages(): Promise<string[]> {
    return Array.from(this.popularPackages);
  }

  /**
   * Add custom popular package
   */
  addPopularPackage(packageName: string): void {
    this.popularPackages.add(packageName);
  }
}

// Export singleton
export const typosquatDetector = new TyposquatDetector();
