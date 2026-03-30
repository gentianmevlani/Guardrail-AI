/**
 * Specialized Test Flows for Reality Mode
 * 
 * Each flow is designed for specific project types and user journeys.
 */

import { ProjectType, DetectedFeatures } from './project-detector';

export interface TestFlow {
  name: string;
  description: string;
  steps: TestStep[];
  requiredFeatures?: (keyof DetectedFeatures)[];
  projectTypes: ProjectType[];
}

export interface TestStep {
  action: 'navigate' | 'click' | 'fill' | 'wait' | 'assert' | 'screenshot' | 'scroll' | 'hover' | 'select' | 'upload';
  target?: string;
  value?: string;
  timeout?: number;
  optional?: boolean;
  description?: string;
}

export interface TestData {
  email: string;
  password: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  company: string;
  website: string;
  message: string;
  searchQuery: string;
  quantity: number;
}

// Default test data with realistic values
export const DEFAULT_TEST_DATA: TestData = {
  email: 'test-reality@guardrail.dev',
  password: 'TestPass123!@#',
  name: 'Reality Test User',
  phone: '+1 (555) 123-4567',
  address: '123 Test Street',
  city: 'San Francisco',
  state: 'CA',
  zip: '94102',
  country: 'United States',
  cardNumber: '4242424242424242',
  cardExpiry: '12/28',
  cardCvc: '123',
  company: 'guardrail Test Co',
  website: 'https://example.com',
  message: 'This is a test message from guardrail Reality Mode.',
  searchQuery: 'test product',
  quantity: 1
};

// Smart field detection and filling
export const FIELD_PATTERNS: Record<string, { selectors: string[]; testValue: keyof TestData | string }> = {
  email: {
    selectors: ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]', 'input[placeholder*="email"]'],
    testValue: 'email'
  },
  password: {
    selectors: ['input[type="password"]', 'input[name*="password"]', 'input[id*="password"]'],
    testValue: 'password'
  },
  name: {
    selectors: ['input[name*="name"]', 'input[id*="name"]', 'input[placeholder*="name"]', 'input[name="fullName"]'],
    testValue: 'name'
  },
  firstName: {
    selectors: ['input[name*="first"]', 'input[id*="first"]', 'input[name="firstName"]'],
    testValue: 'Reality'
  },
  lastName: {
    selectors: ['input[name*="last"]', 'input[id*="last"]', 'input[name="lastName"]'],
    testValue: 'Tester'
  },
  phone: {
    selectors: ['input[type="tel"]', 'input[name*="phone"]', 'input[id*="phone"]', 'input[name*="mobile"]'],
    testValue: 'phone'
  },
  address: {
    selectors: ['input[name*="address"]', 'input[id*="address"]', 'input[name*="street"]'],
    testValue: 'address'
  },
  city: {
    selectors: ['input[name*="city"]', 'input[id*="city"]'],
    testValue: 'city'
  },
  state: {
    selectors: ['input[name*="state"]', 'input[id*="state"]', 'select[name*="state"]'],
    testValue: 'state'
  },
  zip: {
    selectors: ['input[name*="zip"]', 'input[id*="zip"]', 'input[name*="postal"]'],
    testValue: 'zip'
  },
  country: {
    selectors: ['input[name*="country"]', 'select[name*="country"]'],
    testValue: 'country'
  },
  company: {
    selectors: ['input[name*="company"]', 'input[id*="company"]', 'input[name*="organization"]'],
    testValue: 'company'
  },
  website: {
    selectors: ['input[type="url"]', 'input[name*="website"]', 'input[name*="url"]'],
    testValue: 'website'
  },
  message: {
    selectors: ['textarea', 'textarea[name*="message"]', 'textarea[name*="comment"]'],
    testValue: 'message'
  },
  search: {
    selectors: ['input[type="search"]', 'input[name*="search"]', 'input[placeholder*="search"]'],
    testValue: 'searchQuery'
  },
  quantity: {
    selectors: ['input[type="number"]', 'input[name*="quantity"]', 'input[name*="qty"]'],
    testValue: '1'
  },
  cardNumber: {
    selectors: ['input[name*="card"]', 'input[data-stripe="number"]', '.card-number'],
    testValue: 'cardNumber'
  },
  cardExpiry: {
    selectors: ['input[name*="expir"]', 'input[data-stripe="exp"]', '.card-expiry'],
    testValue: 'cardExpiry'
  },
  cardCvc: {
    selectors: ['input[name*="cvc"]', 'input[name*="cvv"]', 'input[data-stripe="cvc"]'],
    testValue: 'cardCvc'
  }
};

// Authentication Flow
export const AUTH_FLOW: TestFlow = {
  name: 'Authentication',
  description: 'Test login, signup, and logout flows',
  projectTypes: ['saas', 'ecommerce', 'social', 'marketplace', 'booking', 'fintech', 'healthcare', 'education'],
  steps: [
    { action: 'navigate', target: '/', description: 'Go to homepage' },
    { action: 'click', target: 'button:has-text("Sign Up"), button:has-text("Register"), a:has-text("Sign Up")', description: 'Click signup button', optional: true },
    { action: 'wait', timeout: 2000 },
    { action: 'fill', target: 'input[type="email"], input[name="email"]', value: '{{email}}', description: 'Fill email' },
    { action: 'fill', target: 'input[name="name"], input[name="fullName"]', value: '{{name}}', optional: true },
    { action: 'fill', target: 'input[type="password"]', value: '{{password}}', description: 'Fill password' },
    { action: 'click', target: 'button[type="submit"], button:has-text("Sign Up"), button:has-text("Create")', description: 'Submit form' },
    { action: 'wait', timeout: 3000 },
    { action: 'screenshot', description: 'Capture result' },
    { action: 'assert', target: 'text=Dashboard, text=Welcome, text=Profile, [data-testid="dashboard"]', description: 'Verify login success', optional: true }
  ]
};

// E-commerce Cart Flow
export const ECOMMERCE_CART_FLOW: TestFlow = {
  name: 'E-commerce Cart',
  description: 'Test product browsing, cart, and checkout',
  projectTypes: ['ecommerce'],
  requiredFeatures: ['hasCart'],
  steps: [
    { action: 'navigate', target: '/', description: 'Go to homepage' },
    { action: 'click', target: 'a:has-text("Shop"), a:has-text("Products"), a:has-text("Store")', optional: true },
    { action: 'wait', timeout: 2000 },
    { action: 'click', target: '.product-card, .product-item, [data-testid="product"]', description: 'Click first product' },
    { action: 'wait', timeout: 1000 },
    { action: 'screenshot', description: 'Product page' },
    { action: 'click', target: 'button:has-text("Add to Cart"), button:has-text("Add to Bag"), .add-to-cart', description: 'Add to cart' },
    { action: 'wait', timeout: 1000 },
    { action: 'click', target: '.cart-icon, a:has-text("Cart"), [data-testid="cart"]', description: 'Open cart' },
    { action: 'wait', timeout: 1000 },
    { action: 'screenshot', description: 'Cart page' },
    { action: 'click', target: 'button:has-text("Checkout"), a:has-text("Checkout")', description: 'Go to checkout', optional: true },
    { action: 'wait', timeout: 2000 },
    { action: 'screenshot', description: 'Checkout page' }
  ]
};

// Dashboard Flow
export const DASHBOARD_FLOW: TestFlow = {
  name: 'Dashboard Navigation',
  description: 'Test dashboard features and navigation',
  projectTypes: ['saas', 'fintech', 'healthcare', 'education'],
  requiredFeatures: ['hasDashboard'],
  steps: [
    { action: 'navigate', target: '/dashboard', description: 'Go to dashboard' },
    { action: 'wait', timeout: 2000 },
    { action: 'screenshot', description: 'Dashboard overview' },
    { action: 'click', target: 'a:has-text("Settings"), button:has-text("Settings")', optional: true },
    { action: 'wait', timeout: 1000 },
    { action: 'screenshot', description: 'Settings page' },
    { action: 'click', target: 'a:has-text("Profile"), button:has-text("Profile")', optional: true },
    { action: 'wait', timeout: 1000 },
    { action: 'screenshot', description: 'Profile page' },
    { action: 'click', target: 'a:has-text("Analytics"), button:has-text("Analytics")', optional: true },
    { action: 'wait', timeout: 1000 },
    { action: 'screenshot', description: 'Analytics page' }
  ]
};

// Search Flow
export const SEARCH_FLOW: TestFlow = {
  name: 'Search Functionality',
  description: 'Test search and filtering',
  projectTypes: ['ecommerce', 'blog', 'marketplace', 'education'],
  requiredFeatures: ['hasSearch'],
  steps: [
    { action: 'navigate', target: '/', description: 'Go to homepage' },
    { action: 'click', target: 'input[type="search"], .search-input, [data-testid="search"]', description: 'Focus search' },
    { action: 'fill', target: 'input[type="search"], .search-input', value: '{{searchQuery}}', description: 'Enter search query' },
    { action: 'click', target: 'button[type="submit"], button:has-text("Search"), .search-button', optional: true },
    { action: 'wait', timeout: 2000 },
    { action: 'screenshot', description: 'Search results' },
    { action: 'assert', target: '.search-results, .results, [data-testid="results"]', description: 'Verify results shown', optional: true }
  ]
};

// Contact Form Flow
export const CONTACT_FLOW: TestFlow = {
  name: 'Contact Form',
  description: 'Test contact form submission',
  projectTypes: ['portfolio', 'saas', 'ecommerce'],
  steps: [
    { action: 'navigate', target: '/contact', description: 'Go to contact page' },
    { action: 'wait', timeout: 1000 },
    { action: 'fill', target: 'input[name*="name"]', value: '{{name}}', optional: true },
    { action: 'fill', target: 'input[type="email"]', value: '{{email}}' },
    { action: 'fill', target: 'textarea', value: '{{message}}' },
    { action: 'screenshot', description: 'Filled form' },
    { action: 'click', target: 'button[type="submit"], button:has-text("Send"), button:has-text("Submit")', description: 'Submit form' },
    { action: 'wait', timeout: 2000 },
    { action: 'screenshot', description: 'Form result' }
  ]
};

// Booking Flow
export const BOOKING_FLOW: TestFlow = {
  name: 'Booking/Scheduling',
  description: 'Test appointment booking flow',
  projectTypes: ['booking', 'healthcare'],
  steps: [
    { action: 'navigate', target: '/', description: 'Go to homepage' },
    { action: 'click', target: 'button:has-text("Book"), a:has-text("Schedule"), a:has-text("Appointment")', description: 'Start booking' },
    { action: 'wait', timeout: 2000 },
    { action: 'click', target: '.calendar-day, .available-slot, [data-available="true"]', description: 'Select date', optional: true },
    { action: 'wait', timeout: 1000 },
    { action: 'click', target: '.time-slot, button:has-text(":00"), button:has-text(":30")', description: 'Select time', optional: true },
    { action: 'screenshot', description: 'Booking selection' },
    { action: 'click', target: 'button:has-text("Confirm"), button:has-text("Book"), button[type="submit"]', description: 'Confirm booking', optional: true },
    { action: 'wait', timeout: 2000 },
    { action: 'screenshot', description: 'Booking result' }
  ]
};

// Social Feed Flow
export const SOCIAL_FLOW: TestFlow = {
  name: 'Social Feed',
  description: 'Test social features like feed, posts, likes',
  projectTypes: ['social'],
  steps: [
    { action: 'navigate', target: '/feed', description: 'Go to feed' },
    { action: 'wait', timeout: 2000 },
    { action: 'screenshot', description: 'Feed view' },
    { action: 'scroll', target: 'body', value: '500', description: 'Scroll feed' },
    { action: 'wait', timeout: 1000 },
    { action: 'click', target: '.like-button, button:has-text("Like"), [data-testid="like"]', description: 'Like a post', optional: true },
    { action: 'click', target: '.comment-button, button:has-text("Comment")', description: 'Open comments', optional: true },
    { action: 'screenshot', description: 'Interaction result' }
  ]
};

// File Upload Flow
export const UPLOAD_FLOW: TestFlow = {
  name: 'File Upload',
  description: 'Test file upload functionality',
  projectTypes: ['saas', 'social', 'marketplace'],
  requiredFeatures: ['hasFileUpload'],
  steps: [
    { action: 'navigate', target: '/', description: 'Go to homepage' },
    { action: 'click', target: 'button:has-text("Upload"), a:has-text("Upload"), [data-testid="upload"]', description: 'Open upload', optional: true },
    { action: 'wait', timeout: 1000 },
    { action: 'screenshot', description: 'Upload interface' }
  ]
};

// Accessibility Flow
export const ACCESSIBILITY_FLOW: TestFlow = {
  name: 'Accessibility',
  description: 'Test keyboard navigation and ARIA labels',
  projectTypes: ['saas', 'ecommerce', 'blog', 'portfolio', 'social', 'marketplace', 'booking', 'fintech', 'healthcare', 'education', 'api', 'unknown'],
  steps: [
    { action: 'navigate', target: '/', description: 'Go to homepage' },
    { action: 'wait', timeout: 1000 },
    { action: 'assert', target: '[role="navigation"], nav', description: 'Check navigation landmark', optional: true },
    { action: 'assert', target: '[role="main"], main', description: 'Check main landmark', optional: true },
    { action: 'assert', target: 'h1', description: 'Check heading structure', optional: true },
    { action: 'assert', target: 'img[alt]', description: 'Check image alt text', optional: true },
    { action: 'screenshot', description: 'Accessibility check' }
  ]
};

// Mobile Responsiveness Flow
export const MOBILE_FLOW: TestFlow = {
  name: 'Mobile Responsiveness',
  description: 'Test mobile viewport and touch interactions',
  projectTypes: ['saas', 'ecommerce', 'blog', 'portfolio', 'social', 'marketplace', 'booking', 'fintech', 'healthcare', 'education', 'api', 'unknown'],
  steps: [
    { action: 'navigate', target: '/', description: 'Go to homepage' },
    { action: 'wait', timeout: 1000 },
    { action: 'screenshot', description: 'Mobile view' },
    { action: 'click', target: '.hamburger, .menu-toggle, button[aria-label*="menu"]', description: 'Open mobile menu', optional: true },
    { action: 'wait', timeout: 500 },
    { action: 'screenshot', description: 'Mobile menu' }
  ]
};

// All available flows
export const ALL_FLOWS: TestFlow[] = [
  AUTH_FLOW,
  ECOMMERCE_CART_FLOW,
  DASHBOARD_FLOW,
  SEARCH_FLOW,
  CONTACT_FLOW,
  BOOKING_FLOW,
  SOCIAL_FLOW,
  UPLOAD_FLOW,
  ACCESSIBILITY_FLOW,
  MOBILE_FLOW
];

/**
 * Get applicable flows for a project type and features
 */
export function getApplicableFlows(projectType: ProjectType, features: DetectedFeatures): TestFlow[] {
  return ALL_FLOWS.filter(flow => {
    // Check if flow applies to this project type
    if (!flow.projectTypes.includes(projectType)) return false;
    
    // Check if required features are present
    if (flow.requiredFeatures) {
      for (const feature of flow.requiredFeatures) {
        if (!features[feature]) return false;
      }
    }
    
    return true;
  });
}

/**
 * Interpolate test data into step values
 */
export function interpolateTestData(value: string, testData: TestData): string {
  return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return (testData as any)[key] || match;
  });
}
