/**
 * Vibecoder Detector
 * 
 * Detects what AI app builders forget - the gap between
 * "looks good" and "actually works in production"
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MissingFeature {
  category: 'critical' | 'essential' | 'important' | 'polish';
  feature: string;
  description: string;
  whyItMatters: string;
  impact: 'blocks-shipping' | 'poor-ux' | 'security-risk' | 'scalability-issue';
  templates: string[];
  priority: number;
}

export interface VibecoderReport {
  projectPath: string;
  score: number; // 0-100
  canShip: boolean;
  missingCritical: MissingFeature[];
  missingEssential: MissingFeature[];
  missingImportant: MissingFeature[];
  missingPolish: MissingFeature[];
  recommendations: string[];
  estimatedTimeToShip: string;
}

class VibecoderDetector {
  /**
   * Analyze project for what AI app builders forget
   */
  async analyze(projectPath: string): Promise<VibecoderReport> {
    const missing: MissingFeature[] = [];

    // Critical - blocks shipping
    missing.push(...await this.checkCriticalFeatures(projectPath));
    
    // Essential - poor UX without
    missing.push(...await this.checkEssentialFeatures(projectPath));
    
    // Important - scalability/security
    missing.push(...await this.checkImportantFeatures(projectPath));
    
    // Polish - nice to have
    missing.push(...await this.checkPolishFeatures(projectPath));

    // Categorize
    const missingCritical = missing.filter(m => m.category === 'critical');
    const missingEssential = missing.filter(m => m.category === 'essential');
    const missingImportant = missing.filter(m => m.category === 'important');
    const missingPolish = missing.filter(m => m.category === 'polish');

    // Calculate score
    const score = this.calculateScore(missing);
    const canShip = missingCritical.length === 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(missing);
    const estimatedTimeToShip = this.estimateTimeToShip(missing);

    return {
      projectPath,
      score,
      canShip,
      missingCritical,
      missingEssential,
      missingImportant,
      missingPolish,
      recommendations,
      estimatedTimeToShip,
    };
  }

  /**
   * Check critical features (blocks shipping)
   */
  private async checkCriticalFeatures(projectPath: string): Promise<MissingFeature[]> {
    const missing: MissingFeature[] = [];

    // Authentication
    const hasAuth = await this.findFile(projectPath, /auth|login|signin|signup/i);
    if (!hasAuth) {
      missing.push({
        category: 'critical',
        feature: 'User Authentication',
        description: 'No authentication system found. Users can\'t sign up or log in.',
        whyItMatters: 'Most apps need user accounts. Without auth, you can\'t track users, personalize content, or protect data.',
        impact: 'blocks-shipping',
        templates: ['auth-middleware', 'auth-routes', 'auth-components'],
        priority: 10,
      });
    }

    // Database/Data persistence
    const hasDatabase = await this.findFile(projectPath, /database|db|prisma|mongoose|sequelize/i);
    if (!hasDatabase) {
      missing.push({
        category: 'critical',
        feature: 'Data Persistence',
        description: 'No database or data storage found. Data is lost on refresh.',
        whyItMatters: 'Without a database, user data, content, and state are lost. The app can\'t function as a real product.',
        impact: 'blocks-shipping',
        templates: ['database-setup', 'database-models', 'database-migrations'],
        priority: 10,
      });
    }

    // Environment variables
    const hasEnvExample = await this.pathExists(path.join(projectPath, '.env.example'));
    if (!hasEnvExample) {
      missing.push({
        category: 'critical',
        feature: 'Environment Configuration',
        description: 'No .env.example file. Developers don\'t know what environment variables are needed.',
        whyItMatters: 'Without env config, the app can\'t be deployed or run by other developers.',
        impact: 'blocks-shipping',
        templates: ['env-example'],
        priority: 9,
      });
    }

    // Error handling
    const hasErrorHandling = await this.findFile(projectPath, /error.*boundary|error.*handler|try.*catch/i);
    if (!hasErrorHandling) {
      missing.push({
        category: 'critical',
        feature: 'Error Handling',
        description: 'No error handling found. App crashes on any error.',
        whyItMatters: 'Errors happen. Without handling, users see white screens and the app is unusable.',
        impact: 'blocks-shipping',
        templates: ['error-boundary', 'error-handler'],
        priority: 10,
      });
    }

    // API endpoints (if has API)
    const hasAPI = await this.findFile(projectPath, /api|routes|endpoints/i);
    if (hasAPI) {
      const hasHealthCheck = await this.findFile(projectPath, /health|healthcheck/i);
      if (!hasHealthCheck) {
        missing.push({
          category: 'critical',
          feature: 'Health Check Endpoint',
          description: 'No /health endpoint. Deployment systems can\'t verify the app is running.',
          whyItMatters: 'Deployment platforms need health checks to know if your app is alive. Without it, deployments fail.',
          impact: 'blocks-shipping',
          templates: ['health-check'],
          priority: 9,
        });
      }
    }

    return missing;
  }

  /**
   * Check essential features (poor UX without)
   */
  private async checkEssentialFeatures(projectPath: string): Promise<MissingFeature[]> {
    const missing: MissingFeature[] = [];

    // Loading states
    const hasLoading = await this.findFile(projectPath, /loading|spinner|skeleton/i);
    if (!hasLoading) {
      missing.push({
        category: 'essential',
        feature: 'Loading States',
        description: 'No loading indicators. Users don\'t know if the app is working.',
        whyItMatters: 'Users need feedback during async operations. Without loading states, they think the app is broken.',
        impact: 'poor-ux',
        templates: ['loading-state'],
        priority: 8,
      });
    }

    // Empty states
    const hasEmptyState = await this.findFile(projectPath, /empty.*state|no.*data/i);
    if (!hasEmptyState) {
      missing.push({
        category: 'essential',
        feature: 'Empty States',
        description: 'No empty state UI. Lists with no data show nothing.',
        whyItMatters: 'Empty states guide users on what to do next. Without them, users are confused.',
        impact: 'poor-ux',
        templates: ['empty-state'],
        priority: 7,
      });
    }

    // Form validation
    const hasForms = await this.findFile(projectPath, /form|input|textarea/i);
    if (hasForms) {
      const hasValidation = await this.findFile(projectPath, /validation|validate|zod|yup/i);
      if (!hasValidation) {
        missing.push({
          category: 'essential',
          feature: 'Form Validation',
          description: 'Forms exist but no validation. Invalid data can be submitted.',
          whyItMatters: 'Users make mistakes. Validation prevents errors and improves UX.',
          impact: 'poor-ux',
          templates: ['form-validation'],
          priority: 8,
        });
      }
    }

    // Success feedback
    const hasSuccessFeedback = await this.findFile(projectPath, /toast|notification|success|message/i);
    if (!hasSuccessFeedback) {
      missing.push({
        category: 'essential',
        feature: 'Success Feedback',
        description: 'No success messages. Users don\'t know if actions worked.',
        whyItMatters: 'Users need confirmation that actions succeeded. Without feedback, they\'re unsure.',
        impact: 'poor-ux',
        templates: ['toast-notifications'],
        priority: 7,
      });
    }

    // Password reset (if has auth)
    const hasAuth = await this.findFile(projectPath, /auth|login/i);
    if (hasAuth) {
      const hasPasswordReset = await this.findFile(projectPath, /password.*reset|forgot.*password/i);
      if (!hasPasswordReset) {
        missing.push({
          category: 'essential',
          feature: 'Password Reset',
          description: 'No password reset flow. Users can\'t recover accounts.',
          whyItMatters: 'Users forget passwords. Without reset, they\'re locked out forever.',
          impact: 'poor-ux',
          templates: ['password-reset'],
          priority: 8,
        });
      }
    }

    // Email verification (if has auth)
    if (hasAuth) {
      const hasEmailVerification = await this.findFile(projectPath, /email.*verif|verify.*email/i);
      if (!hasEmailVerification) {
        missing.push({
          category: 'essential',
          feature: 'Email Verification',
          description: 'No email verification. Fake accounts can be created.',
          whyItMatters: 'Email verification prevents spam and ensures valid users.',
          impact: 'poor-ux',
          templates: ['email-verification'],
          priority: 7,
        });
      }
    }

    // Search functionality (if has lists)
    const hasLists = await this.findFile(projectPath, /list|items|products|posts/i);
    if (hasLists) {
      const hasSearch = await this.findFile(projectPath, /search|filter|query/i);
      if (!hasSearch) {
        missing.push({
          category: 'essential',
          feature: 'Search Functionality',
          description: 'Lists exist but no search. Users can\'t find what they need.',
          whyItMatters: 'As data grows, users need search to find items. Without it, the app becomes unusable.',
          impact: 'poor-ux',
          templates: ['search-functionality'],
          priority: 7,
        });
      }
    }

    // Pagination (if has lists)
    if (hasLists) {
      const hasPagination = await this.findFile(projectPath, /pagination|page|limit|offset/i);
      if (!hasPagination) {
        missing.push({
          category: 'essential',
          feature: 'Pagination',
          description: 'Lists exist but no pagination. All data loads at once.',
          whyItMatters: 'Large lists slow down the app. Pagination improves performance and UX.',
          impact: 'poor-ux',
          templates: ['pagination'],
          priority: 6,
        });
      }
    }

    return missing;
  }

  /**
   * Check important features (scalability/security)
   */
  private async checkImportantFeatures(projectPath: string): Promise<MissingFeature[]> {
    const missing: MissingFeature[] = [];

    // Rate limiting
    const hasAPI = await this.findFile(projectPath, /api|routes/i);
    if (hasAPI) {
      const hasRateLimit = await this.findFile(projectPath, /rate.*limit|throttle/i);
      if (!hasRateLimit) {
        missing.push({
          category: 'important',
          feature: 'Rate Limiting',
          description: 'No rate limiting. API is vulnerable to abuse.',
          whyItMatters: 'Without rate limiting, bots can overwhelm your API and cause downtime.',
          impact: 'scalability-issue',
          templates: ['rate-limiting'],
          priority: 8,
        });
      }
    }

    // CORS
    if (hasAPI) {
      const hasCORS = await this.findFile(projectPath, /cors/i);
      if (!hasCORS) {
        missing.push({
          category: 'important',
          feature: 'CORS Configuration',
          description: 'No CORS config. Frontend can\'t connect to API.',
          whyItMatters: 'Browsers block cross-origin requests. Without CORS, frontend can\'t call API.',
          impact: 'blocks-shipping',
          templates: ['cors-config'],
          priority: 9,
        });
      }
    }

    // Input sanitization
    const hasUserInput = await this.findFile(projectPath, /form|input|textarea/i);
    if (hasUserInput) {
      const hasSanitization = await this.findFile(projectPath, /sanitize|escape|xss/i);
      if (!hasSanitization) {
        missing.push({
          category: 'important',
          feature: 'Input Sanitization',
          description: 'No input sanitization. Vulnerable to XSS attacks.',
          whyItMatters: 'Malicious users can inject scripts. This is a security risk.',
          impact: 'security-risk',
          templates: ['input-sanitization'],
          priority: 9,
        });
      }
    }

    // Session management (if has auth)
    const hasAuth = await this.findFile(projectPath, /auth|login/i);
    if (hasAuth) {
      const hasSession = await this.findFile(projectPath, /session|cookie|jwt/i);
      if (!hasSession) {
        missing.push({
          category: 'important',
          feature: 'Session Management',
          description: 'No session management. Users logged out on refresh.',
          whyItMatters: 'Users expect to stay logged in. Without sessions, terrible UX.',
          impact: 'poor-ux',
          templates: ['session-management'],
          priority: 8,
        });
      }
    }

    // File upload handling (if has uploads)
    const hasUploads = await this.findFile(projectPath, /upload|file|image|multipart/i);
    if (hasUploads) {
      const hasUploadHandler = await this.findFile(projectPath, /multer|upload.*handler|file.*upload/i);
      if (!hasUploadHandler) {
        missing.push({
          category: 'important',
          feature: 'File Upload Handling',
          description: 'File uploads referenced but no handler. Uploads will fail.',
          whyItMatters: 'File uploads need proper handling for security and performance.',
          impact: 'blocks-shipping',
          templates: ['file-upload'],
          priority: 8,
        });
      }
    }

    // Payment processing (if has payments)
    const hasPayments = await this.findFile(projectPath, /payment|stripe|checkout|subscription/i);
    if (hasPayments) {
      const hasPaymentHandler = await this.findFile(projectPath, /payment.*handler|stripe.*webhook|payment.*process/i);
      if (!hasPaymentHandler) {
        missing.push({
          category: 'important',
          feature: 'Payment Processing',
          description: 'Payment UI exists but no backend processing. Payments won\'t work.',
          whyItMatters: 'Payments need webhook handling, idempotency, and error recovery.',
          impact: 'blocks-shipping',
          templates: ['payment-processing', 'stripe-webhooks'],
          priority: 10,
        });
      }
    }

    // Email service (if sends emails)
    const hasEmail = await this.findFile(projectPath, /email|sendmail|nodemailer|resend/i);
    if (hasEmail) {
      const hasEmailService = await this.findFile(projectPath, /email.*service|email.*config|smtp/i);
      if (!hasEmailService) {
        missing.push({
          category: 'important',
          feature: 'Email Service Configuration',
          description: 'Email sending referenced but no service configured.',
          whyItMatters: 'Emails won\'t send without proper SMTP/service configuration.',
          impact: 'blocks-shipping',
          templates: ['email-service'],
          priority: 8,
        });
      }
    }

    return missing;
  }

  /**
   * Check polish features
   */
  private async checkPolishFeatures(projectPath: string): Promise<MissingFeature[]> {
    const missing: MissingFeature[] = [];

    // Analytics
    const hasAnalytics = await this.findFile(projectPath, /analytics|track|mixpanel|amplitude/i);
    if (!hasAnalytics) {
      missing.push({
        category: 'polish',
        feature: 'Analytics',
        description: 'No analytics. Can\'t track user behavior or business metrics.',
        whyItMatters: 'Analytics help you understand users and improve the product.',
        impact: 'poor-ux',
        templates: ['analytics-setup'],
        priority: 5,
      });
    }

    // Onboarding flow
    const hasOnboarding = await this.findFile(projectPath, /onboarding|tutorial|welcome|getting.*started/i);
    if (!hasOnboarding) {
      missing.push({
        category: 'polish',
        feature: 'Onboarding Flow',
        description: 'No onboarding. New users don\'t know how to use the app.',
        whyItMatters: 'Onboarding improves user retention and reduces confusion.',
        impact: 'poor-ux',
        templates: ['onboarding-flow'],
        priority: 6,
      });
    }

    // Settings page
    const hasSettings = await this.findFile(projectPath, /settings|preferences|profile.*settings/i);
    if (!hasSettings) {
      missing.push({
        category: 'polish',
        feature: 'Settings Page',
        description: 'No settings page. Users can\'t customize their experience.',
        whyItMatters: 'Users expect to customize apps. Settings improve retention.',
        impact: 'poor-ux',
        templates: ['settings-page'],
        priority: 5,
      });
    }

    // Help/Support
    const hasHelp = await this.findFile(projectPath, /help|support|faq|documentation/i);
    if (!hasHelp) {
      missing.push({
        category: 'polish',
        feature: 'Help & Support',
        description: 'No help section. Users can\'t get assistance.',
        whyItMatters: 'Help reduces support burden and improves user satisfaction.',
        impact: 'poor-ux',
        templates: ['help-support'],
        priority: 5,
      });
    }

    return missing;
  }

  /**
   * Calculate shipping readiness score
   */
  private calculateScore(missing: MissingFeature[]): number {
    let score = 100;

    for (const feature of missing) {
      switch (feature.category) {
        case 'critical':
          score -= 15;
          break;
        case 'essential':
          score -= 8;
          break;
        case 'important':
          score -= 5;
          break;
        case 'polish':
          score -= 2;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(missing: MissingFeature[]): string[] {
    const recommendations: string[] = [];

    const critical = missing.filter(m => m.category === 'critical');
    if (critical.length > 0) {
      recommendations.push(`🚨 ${critical.length} critical feature(s) missing - these block shipping!`);
    }

    const essential = missing.filter(m => m.category === 'essential');
    if (essential.length > 0) {
      recommendations.push(`⚠️ ${essential.length} essential feature(s) missing - poor UX without these`);
    }

    // Group by impact
    const blocksShipping = missing.filter(m => m.impact === 'blocks-shipping');
    if (blocksShipping.length > 0) {
      recommendations.push(`🔴 ${blocksShipping.length} feature(s) that block shipping - fix these first!`);
    }

    return recommendations;
  }

  /**
   * Estimate time to ship
   */
  private estimateTimeToShip(missing: MissingFeature[]): string {
    const critical = missing.filter(m => m.category === 'critical');
    const essential = missing.filter(m => m.category === 'essential');

    if (critical.length === 0 && essential.length === 0) {
      return 'Ready to ship!';
    }

    const totalHours = (critical.length * 8) + (essential.length * 4);
    
    if (totalHours < 8) return 'Less than a day';
    if (totalHours < 40) return `${Math.ceil(totalHours / 8)} days`;
    return `${Math.ceil(totalHours / 40)} weeks`;
  }

  // Helper methods
  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private async findFile(dir: string, pattern: RegExp): Promise<boolean> {
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          if (await this.findFile(fullPath, pattern)) return true;
        } else if (item.isFile() && pattern.test(item.name)) {
          return true;
        }
      }
    } catch (error) {
      // Failed to access file - continue with other files
    }
    return false;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name);
  }
}

export const vibecoderDetector = new VibecoderDetector();

