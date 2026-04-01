/**
 * AI Agent Fix Suggestions Engine
 * 
 * Analyzes issues found during testing and generates:
 * 1. Human-readable fix suggestions
 * 2. AI agent prompts for automated fixing
 */

export interface Issue {
  type: 'security' | 'performance' | 'accessibility' | 'auth' | 'api' | 'ui' | 'storage' | 'mobile';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location?: string;
  rawData?: any;
}

export interface FixSuggestion {
  issue: Issue;
  humanReadableFix: string;
  codeExample?: string;
  agentPrompt: string;
  estimatedEffort: 'trivial' | 'easy' | 'medium' | 'complex';
  resources?: string[];
}

export interface FixReport {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  suggestions: FixSuggestion[];
  prioritizedPrompts: string[];
  masterPrompt: string;
}

/**
 * Analyze test results and generate fix suggestions
 */
export function generateFixSuggestions(results: any): FixReport {
  const issues: Issue[] = [];
  const suggestions: FixSuggestion[] = [];

  // Analyze security headers
  if (results.securityHeaders) {
    const headers = results.securityHeaders;
    
    if (headers['x-frame-options'] === 'MISSING') {
      issues.push({
        type: 'security',
        severity: 'high',
        title: 'Missing X-Frame-Options Header',
        description: 'Your application is vulnerable to clickjacking attacks. Attackers can embed your site in an iframe to trick users.',
        rawData: headers
      });
    }

    if (headers['content-security-policy'] === 'MISSING') {
      issues.push({
        type: 'security',
        severity: 'high',
        title: 'Missing Content-Security-Policy Header',
        description: 'Without CSP, your application is more vulnerable to XSS attacks and data injection.',
        rawData: headers
      });
    }

    if (headers['strict-transport-security'] === 'MISSING') {
      issues.push({
        type: 'security',
        severity: 'medium',
        title: 'Missing HSTS Header',
        description: 'HTTPS is not enforced via HSTS, making users vulnerable to protocol downgrade attacks.',
        rawData: headers
      });
    }
  }

  // Analyze cookies
  if (results.cookies && results.cookies.length > 0) {
    const insecureCookies = results.cookies.filter((c: any) => !c.secure);
    if (insecureCookies.length > 0) {
      issues.push({
        type: 'security',
        severity: 'high',
        title: 'Insecure Cookies Detected',
        description: `${insecureCookies.length} cookies are missing the Secure flag, making them vulnerable to interception.`,
        rawData: insecureCookies
      });
    }

    const noHttpOnlyAuth = results.cookies.filter((c: any) => 
      !c.httpOnly && (c.name.includes('session') || c.name.includes('token') || c.name.includes('auth'))
    );
    if (noHttpOnlyAuth.length > 0) {
      issues.push({
        type: 'security',
        severity: 'critical',
        title: 'Auth Cookies Missing HttpOnly',
        description: 'Authentication cookies without HttpOnly flag can be stolen via XSS attacks.',
        rawData: noHttpOnlyAuth
      });
    }
  }

  // Analyze performance
  if (results.performance?.metrics) {
    const metrics = results.performance.metrics;
    
    if (metrics.pageLoadTime > 3000) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        title: 'Slow Page Load Time',
        description: `Page takes ${metrics.pageLoadTime}ms to load, which is above the recommended 3 seconds.`,
        rawData: metrics
      });
    }

    if (metrics.firstContentfulPaint > 2000) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        title: 'Slow First Contentful Paint',
        description: `FCP is ${metrics.firstContentfulPaint}ms, which affects perceived performance.`,
        rawData: metrics
      });
    }
  }

  // Analyze API errors
  if (results.apiAnalysis?.errors > 0) {
    issues.push({
      type: 'api',
      severity: 'high',
      title: 'API Errors Detected',
      description: `${results.apiAnalysis.errors} API calls returned error status codes.`,
      rawData: results.apiCalls?.filter((c: any) => c.status >= 400)
    });
  }

  // Analyze auth flow issues
  const authSteps = results.steps?.filter((s: any) => 
    s.action?.target?.toLowerCase().includes('login') || 
    s.action?.target?.toLowerCase().includes('signup')
  );
  const failedAuth = authSteps?.filter((s: any) => !s.success);
  if (failedAuth?.length > 0) {
    issues.push({
      type: 'auth',
      severity: 'critical',
      title: 'Authentication Flow Issues',
      description: 'Login or signup flows are not working correctly.',
      rawData: failedAuth
    });
  }

  // Analyze mobile issues
  const mobileSteps = results.steps?.filter((s: any) => s.action?.type === 'viewport');
  const failedMobile = mobileSteps?.filter((s: any) => !s.success);
  if (failedMobile?.length > 0) {
    issues.push({
      type: 'mobile',
      severity: 'medium',
      title: 'Mobile Responsiveness Issues',
      description: 'Page has horizontal scroll or layout issues on mobile viewports.',
      rawData: failedMobile
    });
  }

  // Analyze console errors
  if (results.errors?.length > 10) {
    issues.push({
      type: 'ui',
      severity: 'high',
      title: 'Excessive Console Errors',
      description: `${results.errors.length} JavaScript errors detected. This indicates frontend instability.`,
      rawData: results.errors.slice(0, 10)
    });
  }

  // Generate fix suggestions for each issue
  for (const issue of issues) {
    suggestions.push(generateFixForIssue(issue));
  }

  // Generate summary
  const summary = {
    total: issues.length,
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length
  };

  // Generate prioritized prompts
  const prioritizedPrompts = suggestions
    .sort((a, b) => severityOrder(a.issue.severity) - severityOrder(b.issue.severity))
    .map(s => s.agentPrompt);

  // Generate master prompt
  const masterPrompt = generateMasterPrompt(suggestions, results);

  return {
    summary,
    suggestions,
    prioritizedPrompts,
    masterPrompt
  };
}

function severityOrder(severity: string): number {
  switch (severity) {
    case 'critical': return 0;
    case 'high': return 1;
    case 'medium': return 2;
    case 'low': return 3;
    default: return 4;
  }
}

/**
 * Generate fix suggestion for a specific issue
 */
function generateFixForIssue(issue: Issue): FixSuggestion {
  switch (issue.type) {
    case 'security':
      return generateSecurityFix(issue);
    case 'performance':
      return generatePerformanceFix(issue);
    case 'auth':
      return generateAuthFix(issue);
    case 'api':
      return generateAPIFix(issue);
    case 'mobile':
      return generateMobileFix(issue);
    case 'ui':
      return generateUIFix(issue);
    default:
      return generateGenericFix(issue);
  }
}

function generateSecurityFix(issue: Issue): FixSuggestion {
  if (issue.title.includes('X-Frame-Options')) {
    return {
      issue,
      humanReadableFix: `Add the X-Frame-Options header to prevent clickjacking. Set it to 'DENY' or 'SAMEORIGIN' depending on your iframe requirements.`,
      codeExample: `// Next.js - next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

// Express.js middleware
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});`,
      agentPrompt: `Fix the missing X-Frame-Options security header in my web application. 

The issue: My application is vulnerable to clickjacking attacks because it doesn't have X-Frame-Options set.

What I need you to do:
1. Find where HTTP headers are configured in my application (look for next.config.js, middleware, or server configuration)
2. Add the X-Frame-Options header with value 'DENY' (or 'SAMEORIGIN' if iframes are needed)
3. Also consider adding the modern Content-Security-Policy frame-ancestors directive

Please implement this fix and show me the exact code changes needed.`,
      estimatedEffort: 'easy',
      resources: [
        'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options',
        'https://owasp.org/www-community/attacks/Clickjacking'
      ]
    };
  }

  if (issue.title.includes('Content-Security-Policy')) {
    return {
      issue,
      humanReadableFix: `Add a Content-Security-Policy header to prevent XSS and data injection attacks. Start with a restrictive policy and loosen as needed.`,
      codeExample: `// Next.js - next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.your-domain.com;"
          },
        ],
      },
    ];
  },
};`,
      agentPrompt: `Add a Content-Security-Policy (CSP) header to my web application.

The issue: My application lacks CSP, making it vulnerable to XSS attacks and unauthorized script execution.

What I need you to do:
1. Analyze my application to understand what external resources it loads (scripts, styles, fonts, images, API calls)
2. Create an appropriate CSP that allows these legitimate resources while blocking malicious ones
3. Add the CSP header to my application's configuration
4. Test that the application still works with the new CSP

Start with a moderately restrictive policy. Include 'unsafe-inline' for styles if needed, but try to avoid 'unsafe-eval' if possible.

Please implement this fix and explain each directive you're using.`,
      estimatedEffort: 'medium',
      resources: [
        'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
        'https://csp-evaluator.withgoogle.com/'
      ]
    };
  }

  if (issue.title.includes('HSTS')) {
    return {
      issue,
      humanReadableFix: `Enable HTTP Strict Transport Security (HSTS) to ensure all connections use HTTPS.`,
      codeExample: `// Add this header to your responses
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

// Next.js - next.config.js
headers: [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]`,
      agentPrompt: `Add HSTS (HTTP Strict Transport Security) header to my web application.

The issue: My application doesn't enforce HTTPS via HSTS, allowing potential protocol downgrade attacks.

What I need you to do:
1. Add the Strict-Transport-Security header with max-age=31536000 (1 year)
2. Include the includeSubDomains directive if all subdomains support HTTPS
3. Consider adding the preload directive if you want to submit to the HSTS preload list

Please implement this fix in my application's configuration.`,
      estimatedEffort: 'trivial',
      resources: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security']
    };
  }

  if (issue.title.includes('Cookie')) {
    return {
      issue,
      humanReadableFix: `Update cookie settings to include Secure, HttpOnly, and SameSite attributes for security.`,
      codeExample: `// Set secure cookies
res.cookie('session', token, {
  httpOnly: true,      // Prevents XSS access
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 3600000      // 1 hour
});`,
      agentPrompt: `Fix insecure cookie configuration in my web application.

The issue: Cookies are missing security attributes (Secure, HttpOnly, SameSite), making them vulnerable to attacks.

What I need you to do:
1. Find where cookies are set in my application (look for res.cookie, document.cookie, Set-Cookie headers)
2. Add the following attributes to all cookies:
   - Secure: true (only send over HTTPS)
   - HttpOnly: true (for session/auth cookies, prevents JavaScript access)
   - SameSite: 'strict' or 'lax' (prevents CSRF)
3. Ensure session cookies have appropriate expiration

Please find all cookie-setting code and update it with proper security attributes.`,
      estimatedEffort: 'easy',
      resources: ['https://owasp.org/www-community/controls/SecureCookieAttribute']
    };
  }

  return generateGenericFix(issue);
}

function generatePerformanceFix(issue: Issue): FixSuggestion {
  if (issue.title.includes('Page Load')) {
    return {
      issue,
      humanReadableFix: `Improve page load time by optimizing images, reducing JavaScript bundle size, implementing code splitting, and using CDN for static assets.`,
      codeExample: `// Next.js - Enable automatic code splitting and image optimization
import Image from 'next/image';
import dynamic from 'next/dynamic';

// Lazy load heavy components
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false
});

// Optimize images
<Image src="/hero.jpg" width={800} height={600} priority />`,
      agentPrompt: `Optimize my web application's page load time. Current load time is over 3 seconds.

What I need you to do:
1. Analyze my bundle size using 'npm run build' or similar
2. Identify large dependencies that can be lazy loaded or replaced
3. Implement code splitting for routes and heavy components
4. Optimize images (use next/image, compress, use WebP format)
5. Check for render-blocking resources and defer/async them
6. Consider implementing a loading skeleton or progressive rendering

Specific optimizations to apply:
- Use dynamic imports for components not needed on initial load
- Compress and optimize all images
- Enable gzip/brotli compression on the server
- Add preconnect hints for external domains
- Consider using a CDN for static assets

Please analyze my codebase and implement these optimizations.`,
      estimatedEffort: 'complex',
      resources: [
        'https://web.dev/performance/',
        'https://nextjs.org/docs/pages/building-your-application/optimizing'
      ]
    };
  }

  if (issue.title.includes('First Contentful Paint')) {
    return {
      issue,
      humanReadableFix: `Improve FCP by reducing render-blocking resources, inlining critical CSS, and prioritizing above-the-fold content.`,
      codeExample: `// Inline critical CSS
<style dangerouslySetInnerHTML={{ __html: criticalCSS }} />

// Preload important resources
<link rel="preload" href="/fonts/main.woff2" as="font" crossOrigin="" />

// Use font-display: swap
@font-face {
  font-family: 'CustomFont';
  font-display: swap;
  src: url('/fonts/main.woff2') format('woff2');
}`,
      agentPrompt: `Improve my application's First Contentful Paint (FCP) time. Current FCP is over 2 seconds.

What I need you to do:
1. Identify render-blocking CSS and JavaScript
2. Inline critical CSS needed for above-the-fold content
3. Defer non-critical CSS and JavaScript
4. Optimize font loading with font-display: swap
5. Add preload hints for critical resources
6. Consider server-side rendering for initial content

Please analyze my application and implement these FCP optimizations.`,
      estimatedEffort: 'medium',
      resources: ['https://web.dev/fcp/']
    };
  }

  return generateGenericFix(issue);
}

function generateAuthFix(issue: Issue): FixSuggestion {
  return {
    issue,
    humanReadableFix: `Fix authentication flow by ensuring forms submit correctly, validation messages display, and users are properly redirected after login/signup.`,
    codeExample: `// Example auth form with proper handling
async function handleLogin(e) {
  e.preventDefault();
  setLoading(true);
  setError(null);
  
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Login failed');
    }
    
    // Redirect to dashboard
    router.push('/dashboard');
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}`,
    agentPrompt: `Fix the authentication flow in my web application. The login/signup process is not working correctly.

What I need you to do:
1. Check the login form submission logic and ensure it calls the correct API endpoint
2. Verify the API endpoint exists and returns proper responses
3. Ensure error messages are displayed to users when auth fails
4. Verify successful auth redirects users to the dashboard
5. Check that auth tokens/sessions are properly stored
6. Ensure protected routes check for authentication

Debug steps:
- Check browser console for errors during form submission
- Verify API responses in Network tab
- Check if cookies/tokens are being set after successful auth
- Verify middleware/guards are working correctly

Please analyze my auth implementation and fix any issues found.`,
    estimatedEffort: 'medium',
    resources: [
      'https://nextjs.org/docs/authentication',
      'https://next-auth.js.org/'
    ]
  };
}

function generateAPIFix(issue: Issue): FixSuggestion {
  return {
    issue,
    humanReadableFix: `Fix API errors by ensuring endpoints exist, return correct status codes, handle errors gracefully, and validate input data.`,
    codeExample: `// Proper API error handling
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validate input
    if (!body.email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }
    
    // Process request
    const result = await processData(body);
    return Response.json(result, { status: 200 });
    
  } catch (error) {
    console.error('API Error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}`,
    agentPrompt: `Fix API errors in my web application. Multiple API calls are returning error status codes.

Errors detected:
${issue.rawData ? JSON.stringify(issue.rawData.slice(0, 5), null, 2) : 'See test results for details'}

What I need you to do:
1. Identify which API endpoints are failing
2. Check if the endpoints exist and are correctly defined
3. Verify request/response formats match what frontend expects
4. Add proper error handling to prevent 500 errors
5. Ensure authentication tokens are being sent with requests
6. Add input validation to return helpful 400 errors

Please analyze my API routes and fix the issues causing errors.`,
    estimatedEffort: 'medium',
    resources: ['https://nextjs.org/docs/app/building-your-application/routing/route-handlers']
  };
}

function generateMobileFix(issue: Issue): FixSuggestion {
  return {
    issue,
    humanReadableFix: `Fix mobile responsiveness by using responsive CSS, avoiding fixed widths, and testing on multiple viewport sizes.`,
    codeExample: `/* Use responsive design patterns */
.container {
  width: 100%;
  max-width: 1200px;
  padding: 0 1rem;
  margin: 0 auto;
}

/* Use flexible images */
img {
  max-width: 100%;
  height: auto;
}

/* Use CSS Grid/Flexbox for layouts */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

/* Responsive typography */
h1 {
  font-size: clamp(1.5rem, 4vw, 3rem);
}`,
    agentPrompt: `Fix mobile responsiveness issues in my web application. The page has horizontal scroll on mobile devices.

What I need you to do:
1. Find elements that are wider than the viewport (causing horizontal scroll)
2. Replace fixed pixel widths with relative units (%, vw, rem)
3. Add proper viewport meta tag if missing
4. Use CSS flexbox/grid for flexible layouts
5. Ensure images have max-width: 100%
6. Check for elements with overflow that should be hidden or scrollable

Common fixes needed:
- Replace 'width: 500px' with 'max-width: 100%'
- Add 'overflow-x: hidden' to body if needed
- Use responsive padding/margins
- Hide or stack horizontal elements on mobile

Please analyze my CSS and fix the responsive layout issues.`,
    estimatedEffort: 'medium',
    resources: ['https://web.dev/responsive-web-design-basics/']
  };
}

function generateUIFix(issue: Issue): FixSuggestion {
  return {
    issue,
    humanReadableFix: `Fix JavaScript errors by checking for null references, adding error boundaries, and ensuring components handle edge cases.`,
    codeExample: `// Add error boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }
    return this.props.children;
  }
}

// Use optional chaining
const value = data?.user?.name ?? 'Unknown';`,
    agentPrompt: `Fix excessive JavaScript errors in my web application. There are ${issue.rawData?.length || 'many'} console errors.

Sample errors:
${issue.rawData ? issue.rawData.slice(0, 5).join('\n') : 'See test results for details'}

What I need you to do:
1. Identify the root causes of these errors
2. Add null checks and optional chaining where data might be undefined
3. Add error boundaries to catch and handle React errors gracefully
4. Ensure async operations have proper error handling
5. Fix any typos or incorrect imports
6. Add loading states to prevent rendering before data is ready

Please analyze my code and fix these JavaScript errors.`,
    estimatedEffort: 'medium',
    resources: ['https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary']
  };
}

function generateGenericFix(issue: Issue): FixSuggestion {
  return {
    issue,
    humanReadableFix: `Review and fix this issue based on best practices for ${issue.type}.`,
    agentPrompt: `Fix the following issue in my web application:

Issue: ${issue.title}
Type: ${issue.type}
Severity: ${issue.severity}
Description: ${issue.description}

Please analyze my codebase to find and fix this issue.`,
    estimatedEffort: 'medium'
  };
}

/**
 * Generate a master prompt that addresses all issues
 */
function generateMasterPrompt(suggestions: FixSuggestion[], results: any): string {
  const critical = suggestions.filter(s => s.issue.severity === 'critical');
  const high = suggestions.filter(s => s.issue.severity === 'high');
  const medium = suggestions.filter(s => s.issue.severity === 'medium');

  let prompt = `# Web Application Fix Request

I ran an automated AI testing agent on my web application and found several issues that need to be fixed. Please help me address these issues in order of priority.

## Application Details
- URL: ${results.url}
- Test Duration: ${(results.duration / 1000).toFixed(1)}s
- Overall Score: ${results.score}/100

## Issues Summary
- Critical: ${critical.length}
- High: ${high.length}
- Medium: ${medium.length}

`;

  if (critical.length > 0) {
    prompt += `## 🔴 CRITICAL ISSUES (Fix Immediately)\n\n`;
    critical.forEach((s, i) => {
      prompt += `### ${i + 1}. ${s.issue.title}\n${s.issue.description}\n\n**How to fix:**\n${s.humanReadableFix}\n\n`;
    });
  }

  if (high.length > 0) {
    prompt += `## 🟠 HIGH PRIORITY ISSUES\n\n`;
    high.forEach((s, i) => {
      prompt += `### ${i + 1}. ${s.issue.title}\n${s.issue.description}\n\n**How to fix:**\n${s.humanReadableFix}\n\n`;
    });
  }

  if (medium.length > 0) {
    prompt += `## 🟡 MEDIUM PRIORITY ISSUES\n\n`;
    medium.forEach((s, i) => {
      prompt += `### ${i + 1}. ${s.issue.title}\n${s.issue.description}\n\n**How to fix:**\n${s.humanReadableFix}\n\n`;
    });
  }

  prompt += `## Instructions for AI Agent

Please fix these issues in the following order:
1. Fix all CRITICAL issues first
2. Then fix HIGH priority issues
3. Then fix MEDIUM priority issues

For each fix:
- Explain what you're changing and why
- Show the code before and after
- Test that the fix doesn't break other functionality

Let's start with the first critical issue.`;

  return prompt;
}

export { generateFixForIssue, generateMasterPrompt };
