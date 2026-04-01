
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  authorAvatar?: string;
  authorBio?: string;
  category: string;
  tags: string[];
  readTime: string;
  heroImage?: string;
  relatedPosts?: string[];
}

// Mock blog posts data - in production, this would come from MDX files or a CMS
const blogPosts: BlogPost[] = [
  {
    slug: "introducing-guardrail",
    title: "Introducing guardrail: AI Development Guardrails for Production",
    excerpt: "We're excited to announce guardrail, a comprehensive platform for adding safety guardrails to AI-powered development. Learn how guardrail helps teams ship faster while maintaining code quality and security standards.",
    content: `# Introducing guardrail: AI Development Guardrails for Production

We're excited to announce **guardrail**, a comprehensive platform for adding safety guardrails to AI-powered development. In this post, we'll share why we built guardrail, what problems it solves, and how you can start using it today.

## The Problem: AI-Generated Code in Production

AI assistants like ChatGPT, Claude, and GitHub Copilot have revolutionized how we write code. But they come with a hidden risk: **mock data and placeholder content that accidentally makes it to production**.

Consider this common scenario:

\`\`\`javascript
// AI generates this "helpful" example
const API_KEY = "sk-test-1234567890abcdef"; // Replace with your actual key
const MOCK_USER_ID = "user_12345"; // For testing only

function fetchUserData(userId) {
  // TODO: Implement actual API call
  return Promise.resolve({
    id: MOCK_USER_ID,
    name: "John Doe",
    email: "john@example.com"
  });
}
\`\`\`

This code looks perfectly fine during development, but if it ships to production, you're exposing test data and potentially security vulnerabilities.

## Our Solution: Reality Mode

guardrail's **Reality Mode** automatically detects and prevents these issues by:

1. **Scanning for mock data patterns** - Identifies fake API keys, placeholder emails, test user IDs
2. **Analyzing network traffic** - Detects when your app makes no real API calls
3. **Validating data flow** - Ensures "save" actions actually write data somewhere

## Key Features

### 🔍 Security Scanning
- OWASP Top 10 compliance
- Dependency vulnerability detection
- Secret and API key exposure detection

### 🚀 Ship Check
- Pre-deployment validation
- GO/NO-GO decision making
- Automated CI/CD integration

### 🎯 Reality Mode
- Mock data detection
- Placeholder content identification
- Network traffic analysis

### 🤝 AI Guardrails
- LLM output validation
- Prompt injection prevention
- Content filtering

## Getting Started

Installation is simple:

\`\`\`bash
# Install the CLI
npm install -g @guardrail/cli

# Initialize in your project
guardrail init

# Run your first scan
guardrail scan .
\`\`\`

## What's Next?

We're just getting started. In the coming weeks, we'll be releasing:

- **Team collaboration features** - Share findings and track progress
- **Advanced policy engine** - Create custom security rules
- **Enterprise features** - SSO, audit logs, and dedicated support

## Join the Community

We believe in building in the open. Join our community to:

- Get help from our team
- Share your experiences
- Help shape the future of guardrail

- [Discord](https://discord.gg/guardrail)
- [GitHub](https://github.com/guardiavault-oss/codeguard)
- [Twitter/X](https://twitter.com/guardrail_ai)

---

**Ready to add guardrails to your AI development?** [Get started with guardrail today](/docs).`,
    date: "2026-01-01",
    author: "guardrail Team",
    category: "Product",
    tags: ["announcement", "product", "ai", "security"],
    readTime: "5 min read",
    heroImage: "/blog/hero-guardrail-launch.jpg",
    relatedPosts: ["why-mock-data-detection-matters", "ship-check-go-no-go"]
  },
  {
    slug: "why-mock-data-detection-matters",
    title: "Why Mock Data Detection Matters in AI-Generated Code",
    excerpt: "AI assistants often generate placeholder or mock data that can accidentally make it to production. We built Reality Mode to detect and prevent this common issue. Here's how it works and why it matters.",
    content: `# Why Mock Data Detection Matters in AI-Generated Code

AI assistants have become indispensable tools for developers. But they come with a dirty little secret: **they love generating mock data**.

## The Hidden Cost of AI-Generated Code

When you ask an AI to generate code, it often includes "helpful" examples:

\`\`\`javascript
// AI-generated example code
const config = {
  apiKey: "sk-1234567890abcdef", // Replace with actual key
  webhookUrl: "https://api.example.com/webhook", // Update this URL
  testMode: true // Set to false in production
};
\`\`\`

This looks innocent enough, but what happens when:

1. You're rushing to meet a deadline
2. You forget to replace the placeholder values
3. The code passes all your tests (because it's using mock data)
4. You ship it to production

## Real-World Examples

### Case Study 1: The API Key Incident

A startup was using AI to help build their payment integration. The AI generated code with a test Stripe API key. In the rush to launch, they forgot to replace it with their production key.

**Result**: Their payment processing worked perfectly in testing but failed silently in production for 3 days before anyone noticed.

### Case Study 2: The Mock User Database

Another team used AI to generate user management code. The AI created a mock user database with hardcoded test users.

**Result**: Their production app had 5 "test users" that anyone could log in as, including an "admin" account with full permissions.

## How guardrail Reality Mode Works

Reality Mode uses three techniques to detect these issues:

### 1. Pattern Recognition
We scan for common mock data patterns:
- Fake API keys (sk-test-, pk_test-, etc.)
- Placeholder emails (test@example.com, john.doe@)
- Mock URLs (api.example.com, localhost:3000)
- Test user IDs (user_123, test_user)

### 2. Network Traffic Analysis
We run your app and monitor:
- Are API calls being made?
- Are requests going to real endpoints?
- Is data actually being saved?

### 3. Data Flow Validation
We trace the flow of data through your application:
- Form submissions → API calls → Database writes
- User actions → Network requests → Response handling

## The Technical Details

Here's how Reality Mode actually works:

\`\`\`typescript
// Reality Mode analyzes your app like this
interface RealityCheck {
  mockDataPatterns: MockPattern[];
  networkCalls: NetworkCall[];
  dataFlow: DataFlowPath[];
}

class RealityScanner {
  async scan(application: App): Promise<RealityCheck> {
    // 1. Static analysis for mock patterns
    const mockPatterns = await this.findMockPatterns(application);
    
    // 2. Dynamic analysis of network traffic
    const networkCalls = await this.analyzeNetworkTraffic(application);
    
    // 3. Data flow validation
    const dataFlow = await this.traceDataFlow(application);
    
    return {
      mockDataPatterns,
      networkCalls,
      dataFlow
    };
  }
}
\`\`\`

## Best Practices for AI-Generated Code

To avoid mock data issues:

1. **Always review AI-generated code** - Never trust it blindly
2. **Use Reality Mode** - Let us catch what you might miss
3. **Implement code reviews** - Have humans check AI output
4. **Use environment variables** - Never hardcode configuration
5. **Write integration tests** - Test against real APIs

## Try It Yourself

Ready to see if your code has hidden mock data?

\`\`\`bash
# Install guardrail
npm install -g @guardrail/cli

# Scan your project
guardrail reality --scan ./src

# Run full reality check
guardrail reality --url https://your-app.com
\`\`\`

## Conclusion

AI is an amazing tool for developers, but it needs guardrails. Reality Mode ensures your AI-generated code is production-ready by catching the mock data and placeholder content that humans might miss.

**Don't let mock data ship to production.** [Try Reality Mode today](/docs/reality-mode).`,
    date: "2025-12-28",
    author: "Engineering Team",
    category: "Engineering",
    tags: ["mock-data", "ai", "reality-mode", "security"],
    readTime: "8 min read",
    heroImage: "/blog/hero-mock-data.jpg",
    relatedPosts: ["introducing-guardrail", "ship-check-go-no-go"]
  },
  {
    slug: "ship-check-go-no-go",
    title: "Ship Check: GO/NO-GO Validation for Every Deployment",
    excerpt: "Before you ship, run Ship Check. Our comprehensive validation system analyzes security, compliance, architecture, and code quality to give you a clear GO or NO-GO decision for deployment.",
    content: `# Ship Check: GO/NO-GO Validation for Every Deployment

Every deployment is a risk. But what if you could know **before** you push to production whether your code is ready?

## The Deployment Dilemma

You've been there. It's 5 PM on a Friday. You've just finished a feature that the product team needs for Monday's launch. Do you:

1. Deploy and hope for the best?
2. Spend hours manually testing everything?
3. Push to production and deal with whatever breaks?

Most developers choose option 1 or 3, and that's how production incidents happen.

## Introducing Ship Check

Ship Check is our **pre-deployment validation system** that gives you a clear **GO/NO-GO** decision before you ship.

### What It Checks

#### 🔒 Security
- OWASP Top 10 vulnerabilities
- Dependency security issues
- Secret and credential exposure
- Authentication and authorization flaws

#### 🏗️ Architecture
- Code quality metrics
- Performance bottlenecks
- Database query efficiency
- API design compliance

#### 📋 Compliance
- GDPR data handling
- SOC2 controls
- Industry regulations
- Company policies

#### 🧪 Reality
- Mock data detection
- Placeholder content
- Test code in production
- Configuration issues

## The Ship Check Process

Running Ship Check is simple:

\`\`\`bash
# Quick check (5 minutes)
guardrail ship --check

# Full validation (15 minutes)
guardrail ship --full

# CI/CD integration
guardrail ship --ci --threshold 80
\`\`\`

### The Results

Ship Check gives you a clear report:

\`\`\`
🚀 SHIP CHECK RESULTS
===================

Overall Score: 82/100 ✅ GO

Security:      ✅ 95/100  (No critical issues)
Architecture:  ⚠️  75/100  (Some performance concerns)
Compliance:    ✅ 90/100  (All policies met)
Reality:       ✅ 85/100  (No mock data detected)

⚠️  WARNINGS (2):
  - Slow database query in user-service.ts:145
  - Missing error handling in payment-processor.ts:89

✅ RECOMMENDATION: Safe to deploy
\`\`\`

## Real-World Impact

### Case Study: E-commerce Platform

An e-commerce company was deploying 3-4 times per week. They had a 15% failure rate that caused:

- Lost revenue during downtime
- Customer support tickets
- Developer stress and overtime

After implementing Ship Check:

- **0% deployment failures** (6 months running)
- **40% faster deployments** (less manual testing)
- **$50K/month savings** in incident response

### Case Study: FinTech Startup

A fintech startup needed to comply with SOC2 and PCI-DSS. Their manual compliance process took 2 weeks per release.

With Ship Check:

- **Automated compliance validation** in 15 minutes
- **Real-time policy checking** during development
- **Audit-ready reports** for regulators
- **Faster time-to-market** for new features

## Technical Implementation

Ship Check works by:

1. **Static Analysis** - Scanning code for known issues
2. **Dynamic Testing** - Running your application in a sandbox
3. **Integration Testing** - Validating API connections
4. **Security Scanning** - Checking for vulnerabilities
5. **Compliance Validation** - Ensuring policy adherence

\`\`\`typescript
interface ShipCheckResult {
  status: 'GO' | 'NO-GO' | 'WARNING';
  score: number;
  categories: {
    security: CheckCategory;
    architecture: CheckCategory;
    compliance: CheckCategory;
    reality: CheckCategory;
  };
  issues: Issue[];
  recommendations: string[];
}

class ShipCheck {
  async validate(project: Project): Promise<ShipCheckResult> {
    const checks = await Promise.all([
      this.checkSecurity(project),
      this.checkArchitecture(project),
      this.checkCompliance(project),
      this.checkReality(project)
    ]);
    
    return this.aggregateResults(checks);
  }
}
\`\`\`

## CI/CD Integration

Ship Check integrates seamlessly with your existing pipeline:

### GitHub Actions
\`\`\`yaml
name: Ship Check
on: [push, pull_request]

jobs:
  ship-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Ship Check
        run: guardrail ship --ci --threshold 80
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
\`\`\`

### GitLab CI
\`\`\`yaml
ship-check:
  stage: test
  script:
    - guardrail ship --ci --threshold 80
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
\`\`\`

## Best Practices

1. **Run Ship Check on every PR** - Catch issues early
2. **Set quality gates** - Define minimum scores
3. **Track trends** - Monitor quality over time
4. **Fix warnings** - Don't ignore recommendations
5. **Customize rules** - Adapt to your needs

## Getting Started

Ready to ship with confidence?

\`\`\`bash
# Install guardrail
npm install -g @guardrail/cli

# Initialize Ship Check
guardrail init

# Run your first check
guardrail ship --check
\`\`\`

## Conclusion

Ship Check transforms deployment from a gamble into a predictable, reliable process. By validating security, architecture, compliance, and reality before you ship, you can deploy with confidence.

**Stop hoping your deployments work. Start knowing they will.**

[Try Ship Check today](/docs/ship-check).`,
    date: "2025-12-22",
    author: "Product Team",
    category: "Features",
    tags: ["ship-check", "deployment", "ci-cd", "validation"],
    readTime: "6 min read",
    heroImage: "/blog/hero-ship-check.jpg",
    relatedPosts: ["introducing-guardrail", "why-mock-data-detection-matters"]
  }
];

export async function getAllPosts(): Promise<BlogPost[]> {
  return blogPosts.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const post = blogPosts.find(post => post.slug === slug);
  return post || null;
}

export async function getPostsByCategory(category: string): Promise<BlogPost[]> {
  return blogPosts.filter(post => post.category === category);
}

export async function getPostsByTag(tag: string): Promise<BlogPost[]> {
  return blogPosts.filter(post => post.tags.includes(tag));
}

export async function getRelatedPosts(currentPost: BlogPost, limit: number = 3): Promise<BlogPost[]> {
  const related = blogPosts.filter(post => {
    if (post.slug === currentPost.slug) return false;
    
    // Prefer posts with same category
    if (post.category === currentPost.category) return true;
    
    // Then posts with shared tags
    const sharedTags = post.tags.filter(tag => currentPost.tags.includes(tag));
    return sharedTags.length > 0;
  });

  return related.slice(0, limit);
}

export async function getCategories(): Promise<string[]> {
  const categories = blogPosts.map(post => post.category);
  return Array.from(new Set(categories));
}

export async function getTags(): Promise<string[]> {
  const tags = blogPosts.flatMap(post => post.tags);
  return Array.from(new Set(tags));
}

export function calculateReadTime(content: string): string {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min read`;
}
