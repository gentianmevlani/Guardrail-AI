/**
 * Project Type Detector for Reality Mode
 * 
 * Automatically detects what kind of project the user has and
 * configures appropriate test flows.
 */

export type ProjectType = 
  | 'saas'           // SaaS applications with dashboards, subscriptions
  | 'ecommerce'      // E-commerce with products, cart, checkout
  | 'blog'           // Blog/CMS with articles, comments
  | 'portfolio'      // Portfolio/landing pages
  | 'api'            // API-first applications
  | 'social'         // Social networks with feeds, profiles
  | 'marketplace'    // Two-sided marketplaces
  | 'booking'        // Booking/scheduling apps
  | 'fintech'        // Financial applications
  | 'healthcare'     // Healthcare/medical apps
  | 'education'      // Learning management systems
  | 'unknown';

export interface ProjectSignature {
  type: ProjectType;
  confidence: number;
  indicators: string[];
  recommendedFlows: string[];
}

export interface DetectionResult {
  primaryType: ProjectType;
  secondaryTypes: ProjectType[];
  signatures: ProjectSignature[];
  features: DetectedFeatures;
}

export interface DetectedFeatures {
  hasAuth: boolean;
  authTypes: ('email' | 'oauth' | 'magic-link' | 'sso' | 'phone')[];
  hasPayments: boolean;
  paymentProviders: string[];
  hasDashboard: boolean;
  hasCart: boolean;
  hasSearch: boolean;
  hasUserProfiles: boolean;
  hasNotifications: boolean;
  hasFileUpload: boolean;
  hasRealtime: boolean;
  hasAPI: boolean;
  apiType: 'rest' | 'graphql' | 'trpc' | 'unknown';
  frameworks: string[];
  uiLibraries: string[];
}

// Patterns to detect project types
const PROJECT_PATTERNS: Record<ProjectType, { selectors: string[]; keywords: string[]; weight: number }> = {
  saas: {
    selectors: [
      '[data-testid*="dashboard"]', '.dashboard', '#dashboard',
      '[data-testid*="subscription"]', '.pricing-table', '.plan-card',
      '.workspace', '.team-settings', '.billing', '.usage-stats'
    ],
    keywords: ['dashboard', 'subscription', 'plan', 'workspace', 'team', 'billing', 'usage', 'analytics', 'settings'],
    weight: 1.0
  },
  ecommerce: {
    selectors: [
      '.cart', '#cart', '[data-testid*="cart"]', '.shopping-cart',
      '.product-card', '.product-grid', '.add-to-cart',
      '.checkout', '.order-summary', '.wishlist', '.product-price'
    ],
    keywords: ['cart', 'checkout', 'product', 'price', 'add to cart', 'buy now', 'shop', 'order', 'shipping'],
    weight: 1.0
  },
  blog: {
    selectors: [
      'article', '.post', '.blog-post', '.article-content',
      '.comments', '.author', '.published-date', '.category',
      '.tags', '.read-more', '.blog-grid'
    ],
    keywords: ['article', 'post', 'blog', 'author', 'published', 'read more', 'comments', 'category'],
    weight: 0.9
  },
  portfolio: {
    selectors: [
      '.hero', '.about-me', '.projects', '.contact-form',
      '.skills', '.experience', '.testimonials', '.portfolio-grid'
    ],
    keywords: ['portfolio', 'projects', 'about me', 'contact', 'skills', 'experience', 'hire me'],
    weight: 0.8
  },
  api: {
    selectors: [
      '.api-docs', '.swagger', '.endpoint', '.api-key',
      '.documentation', 'pre code', '.code-block'
    ],
    keywords: ['api', 'endpoint', 'documentation', 'swagger', 'graphql', 'rest', 'webhook'],
    weight: 0.9
  },
  social: {
    selectors: [
      '.feed', '.timeline', '.post-composer', '.like-button',
      '.follow-button', '.profile-card', '.notifications', '.messages'
    ],
    keywords: ['feed', 'follow', 'like', 'share', 'post', 'profile', 'friends', 'message'],
    weight: 1.0
  },
  marketplace: {
    selectors: [
      '.listing', '.seller-profile', '.buyer-profile', '.reviews',
      '.ratings', '.bid', '.offer', '.category-filter'
    ],
    keywords: ['listing', 'seller', 'buyer', 'review', 'rating', 'bid', 'offer', 'marketplace'],
    weight: 1.0
  },
  booking: {
    selectors: [
      '.calendar', '.date-picker', '.time-slots', '.booking-form',
      '.availability', '.appointment', '.reservation'
    ],
    keywords: ['book', 'schedule', 'appointment', 'reservation', 'availability', 'calendar', 'time slot'],
    weight: 1.0
  },
  fintech: {
    selectors: [
      '.balance', '.transaction', '.transfer', '.payment-method',
      '.account-summary', '.investment', '.portfolio-value'
    ],
    keywords: ['balance', 'transaction', 'transfer', 'payment', 'account', 'investment', 'portfolio'],
    weight: 1.0
  },
  healthcare: {
    selectors: [
      '.patient', '.appointment', '.prescription', '.medical-record',
      '.doctor', '.health-data', '.symptoms'
    ],
    keywords: ['patient', 'doctor', 'appointment', 'prescription', 'medical', 'health', 'symptoms'],
    weight: 1.0
  },
  education: {
    selectors: [
      '.course', '.lesson', '.quiz', '.progress-bar',
      '.certificate', '.enrollment', '.instructor'
    ],
    keywords: ['course', 'lesson', 'quiz', 'learn', 'certificate', 'enroll', 'instructor', 'student'],
    weight: 1.0
  },
  unknown: {
    selectors: [],
    keywords: [],
    weight: 0
  }
};

// Auth pattern detection
const AUTH_PATTERNS = {
  email: {
    selectors: ['input[type="email"]', 'input[name="email"]', '#email'],
    keywords: ['email', 'password', 'sign in', 'log in', 'register']
  },
  oauth: {
    selectors: [
      'button:has-text("Google")', 'button:has-text("GitHub")', 
      'button:has-text("Facebook")', 'button:has-text("Apple")',
      '[data-provider]', '.oauth-button', '.social-login'
    ],
    keywords: ['continue with', 'sign in with', 'google', 'github', 'facebook']
  },
  magicLink: {
    selectors: ['button:has-text("magic link")', 'button:has-text("email link")'],
    keywords: ['magic link', 'passwordless', 'email link']
  },
  sso: {
    selectors: ['button:has-text("SSO")', 'button:has-text("SAML")'],
    keywords: ['sso', 'saml', 'enterprise login', 'company login']
  },
  phone: {
    selectors: ['input[type="tel"]', 'input[name="phone"]'],
    keywords: ['phone', 'sms', 'otp', 'verification code']
  }
};

// Payment provider detection
const PAYMENT_PATTERNS = {
  stripe: {
    selectors: ['.stripe-element', '[data-stripe]', '.StripeElement'],
    keywords: ['stripe', 'card element']
  },
  paypal: {
    selectors: ['[data-paypal]', '.paypal-button', '#paypal-button'],
    keywords: ['paypal']
  },
  square: {
    selectors: ['[data-square]', '.sq-payment-form'],
    keywords: ['square']
  },
  braintree: {
    selectors: ['[data-braintree]', '.braintree-hosted-field'],
    keywords: ['braintree']
  }
};

// Framework detection
const FRAMEWORK_PATTERNS = {
  nextjs: { indicators: ['__NEXT_DATA__', '_next/static'] },
  react: { indicators: ['__REACT_DEVTOOLS_GLOBAL_HOOK__', 'data-reactroot'] },
  vue: { indicators: ['__VUE__', 'data-v-'] },
  angular: { indicators: ['ng-version', 'ng-app'] },
  svelte: { indicators: ['__svelte'] },
  nuxt: { indicators: ['__NUXT__'] },
  remix: { indicators: ['__remixContext'] },
  astro: { indicators: ['astro-island'] }
};

/**
 * Detect project type from page content
 */
export async function detectProjectType(page: any): Promise<DetectionResult> {
  const signatures: ProjectSignature[] = [];
  const features = await detectFeatures(page);
  
  // Get page content for analysis
  const pageContent = await page.evaluate(() => {
    return {
      html: document.body.innerHTML.toLowerCase(),
      text: document.body.innerText.toLowerCase(),
      selectors: Array.from(document.querySelectorAll('*')).map(el => ({
        tag: el.tagName.toLowerCase(),
        classes: Array.from(el.classList),
        id: el.id,
        testId: el.getAttribute('data-testid')
      }))
    };
  });
  
  // Score each project type
  for (const [type, patterns] of Object.entries(PROJECT_PATTERNS)) {
    if (type === 'unknown') continue;
    
    const indicators: string[] = [];
    let score = 0;
    
    // Check selectors
    for (const selector of patterns.selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          indicators.push(`Found: ${selector}`);
          score += 10;
        }
      } catch (e) {
        // Element not found - continue checking other selectors
      }
    }
    
    // Check keywords in page text
    for (const keyword of patterns.keywords) {
      if (pageContent.text.includes(keyword)) {
        indicators.push(`Keyword: ${keyword}`);
        score += 5;
      }
    }
    
    // Apply weight
    score *= patterns.weight;
    
    if (score > 0) {
      signatures.push({
        type: type as ProjectType,
        confidence: Math.min(score / 100, 1),
        indicators,
        recommendedFlows: getRecommendedFlows(type as ProjectType)
      });
    }
  }
  
  // Sort by confidence
  signatures.sort((a, b) => b.confidence - a.confidence);
  
  const primaryType = signatures[0]?.type || 'unknown';
  const secondaryTypes = signatures.slice(1, 3).map(s => s.type);
  
  return {
    primaryType,
    secondaryTypes,
    signatures,
    features
  };
}

/**
 * Detect features present in the application
 */
async function detectFeatures(page: any): Promise<DetectedFeatures> {
  const features: DetectedFeatures = {
    hasAuth: false,
    authTypes: [],
    hasPayments: false,
    paymentProviders: [],
    hasDashboard: false,
    hasCart: false,
    hasSearch: false,
    hasUserProfiles: false,
    hasNotifications: false,
    hasFileUpload: false,
    hasRealtime: false,
    hasAPI: false,
    apiType: 'unknown',
    frameworks: [],
    uiLibraries: []
  };
  
  // Detect auth types
  for (const [authType, patterns] of Object.entries(AUTH_PATTERNS)) {
    for (const selector of patterns.selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          features.hasAuth = true;
          features.authTypes.push(authType as any);
          break;
        }
      } catch (e) {
        // Element not found - continue checking other auth patterns
      }
    }
  }
  
  // Detect payment providers
  for (const [provider, patterns] of Object.entries(PAYMENT_PATTERNS)) {
    for (const selector of patterns.selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          features.hasPayments = true;
          features.paymentProviders.push(provider);
          break;
        }
      } catch (e) {
        // Element not found - continue checking other payment patterns
      }
    }
  }
  
  // Detect common features
  const featureSelectors = {
    hasDashboard: ['.dashboard', '#dashboard', '[data-testid*="dashboard"]'],
    hasCart: ['.cart', '#cart', '[data-testid*="cart"]'],
    hasSearch: ['input[type="search"]', '.search-input', '[data-testid*="search"]'],
    hasUserProfiles: ['.profile', '.user-profile', '[data-testid*="profile"]'],
    hasNotifications: ['.notifications', '.notification-bell', '[data-testid*="notification"]'],
    hasFileUpload: ['input[type="file"]', '.file-upload', '[data-testid*="upload"]']
  };
  
  for (const [feature, selectors] of Object.entries(featureSelectors)) {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          (features as any)[feature] = true;
          break;
        }
      } catch (e) {
        // Element not found - continue checking other feature selectors
      }
    }
  }
  
  // Detect frameworks
  const frameworkResult = await page.evaluate(() => {
    const detected: string[] = [];
    if ((window as any).__NEXT_DATA__) detected.push('nextjs');
    if ((window as any).__NUXT__) detected.push('nuxt');
    if ((window as any).__VUE__) detected.push('vue');
    if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) detected.push('react');
    if (document.querySelector('[ng-version]')) detected.push('angular');
    if ((window as any).__svelte) detected.push('svelte');
    if ((window as any).__remixContext) detected.push('remix');
    return detected;
  });
  features.frameworks = frameworkResult;
  
  // Detect API type
  const apiResult = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src || s.textContent || '');
    const hasGraphQL = scripts.some(s => s.includes('graphql') || s.includes('apollo'));
    const hasTRPC = scripts.some(s => s.includes('trpc'));
    if (hasGraphQL) return 'graphql';
    if (hasTRPC) return 'trpc';
    return 'rest';
  });
  features.apiType = apiResult;
  features.hasAPI = true;
  
  return features;
}

/**
 * Get recommended test flows for a project type
 */
function getRecommendedFlows(type: ProjectType): string[] {
  const flows: Record<ProjectType, string[]> = {
    saas: ['auth', 'dashboard', 'settings', 'billing', 'team-management'],
    ecommerce: ['auth', 'product-browse', 'cart', 'checkout', 'order-history'],
    blog: ['navigation', 'article-view', 'comments', 'search', 'categories'],
    portfolio: ['navigation', 'project-view', 'contact-form'],
    api: ['documentation', 'api-key', 'endpoints'],
    social: ['auth', 'feed', 'profile', 'messaging', 'notifications'],
    marketplace: ['auth', 'listing-browse', 'listing-create', 'messaging', 'reviews'],
    booking: ['auth', 'availability', 'booking', 'calendar', 'notifications'],
    fintech: ['auth', 'dashboard', 'transactions', 'transfers', 'settings'],
    healthcare: ['auth', 'appointments', 'records', 'prescriptions'],
    education: ['auth', 'courses', 'lessons', 'quizzes', 'progress'],
    unknown: ['auth', 'navigation', 'forms']
  };
  
  return flows[type] || flows.unknown;
}

export { PROJECT_PATTERNS, AUTH_PATTERNS, PAYMENT_PATTERNS, FRAMEWORK_PATTERNS };
