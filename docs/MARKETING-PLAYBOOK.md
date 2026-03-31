# guardrail Marketing Playbook

## Step-by-Step Guide to Launching Ads and Growing Users

---

## Table of Contents

1. [Week 1: Foundation](#week-1-foundation)
2. [Google Ads Setup](#google-ads-setup)
3. [Meta Ads Setup](#meta-ads-setup)
4. [SEO Implementation](#seo-implementation)
5. [AI Platform Optimization](#ai-platform-optimization)
6. [Content Marketing](#content-marketing)
7. [Budget & Timeline](#budget--timeline)
8. [Tracking & Analytics](#tracking--analytics)

---

## Week 1: Foundation

### Day 1: Verify Landing Pages

- [ ] Confirm all 15 SEO pages are live on `guardrailai.dev`
- [ ] Test each page loads without errors
- [ ] Verify sitemap.xml is accessible at `guardrailai.dev/sitemap.xml`
- [ ] Submit sitemap to Google Search Console

### Day 2: Set Up Analytics

- [ ] Install Google Analytics 4 on all pages
- [ ] Set up conversion tracking (signups, demo requests)
- [ ] Install Meta Pixel for retargeting
- [ ] Create UTM parameters for tracking

### Day 3: Prepare Assets

- [ ] Create landing page screenshots for ads
- [ ] Prepare ad copy variants (3-5 per ad group)
- [ ] Set up Google Tag Manager container
- [ ] Create Google Ads account (if not exists)

### Day 4-5: GitHub Demo Repo

- [ ] Publish `guardrail-demo-mockproof` as a public GitHub repo
- [ ] Add topics: `mock-data`, `ci-cd`, `testing`, `production`
- [ ] Write a README that teaches the problem
- [ ] Link to glossary pages in README

### Day 6-7: Content Seeding

- [ ] Post 2 neutral Dev.to articles (no selling)
- [ ] Answer 3 StackOverflow-style questions
- [ ] Post 1 helpful GitHub Discussion
- [ ] Update LinkedIn with product announcement

---

## Google Ads Setup

### Step 1: Create Campaign

1. Go to Google Ads → Campaigns → New Campaign
2. Select **Search** campaign type
3. Choose **Website visits** objective
4. Set campaign name: `MockProof_Search`

### Step 2: Campaign Settings

- **Locations**: Worldwide, English-speaking countries
- **Languages**: English
- **Budget**: $40/day (start low, scale winners)
- **Bidding**: Manual CPC (start at $1.20)
- **Networks**: Search only (disable Display/YouTube)
- **Start date**: Today
- **End date**: None

### Step 3: Ad Groups

#### Ad Group 1: Mock Data

**Keywords (Exact + Phrase match only)**:

- "mock data in production"
- "fake api response production"
- "test data leaked to production"
- "leftover mock code production"

**Ad Copy**:

```
Headline 1: CI Passed. Production Failed?
Headline 2: Detect Mock & Fake Code Before Deploy
Description: Find leftover mocks, fake APIs, and AI hallucinations before they hit production. One command. CI-safe.
Final URL: https://guardrailai.dev/guides/stop-mock-data-production
```

#### Ad Group 2: CI Failure

**Keywords**:

- "ci passed but prod failed"
- "ci didnt catch bug"
- "production bug despite passing tests"

**Ad Copy**:

```
Headline 1: CI Passed. Production Failed?
Headline 2: Detect Mock & Fake Code Before Deploy
Description: Find leftover mocks, fake APIs, and AI hallucinations before they hit production. One command. CI-safe.
Final URL: https://guardrailai.dev/guides/ci-passed-production-bug
```

#### Ad Group 3: AI Code

**Keywords**:

- "ai generated code bugs"
- "llm hallucinated code"
- "copilot broke production"

**Ad Copy**:

```
Headline 1: AI Hallucinations in Production?
Headline 2: Detect Fake AI-Generated Code
Description: AI code looks valid but fails at runtime. Detect fabricated APIs and placeholders before deploy.
Final URL: https://guardrailai.dev/guides/ai-hallucinated-code-detection
```

### Step 4: Negative Keywords (CRITICAL)

Add these immediately to avoid wasted spend:

```
free
tutorial
course
jobs
salary
pdf
example only
college
bootcamp
how to write
learn to code
```

### Step 5: Conversion Tracking

1. Go to Tools & Settings → Conversions
2. Create conversion action: "Sign up"
3. Set value: $50 (estimated LCV)
4. Count: One per click
5. Add conversion tracking code to signup page

---

## Meta Ads Setup

### Step 1: Create Meta Business Suite Account

1. Go to business.facebook.com
2. Create business account
3. Add payment method

### Step 2: Install Meta Pixel

1. Go to Events Manager → Pixels
2. Create pixel: `Guardrail_Web`
3. Add pixel code to all pages
4. Test pixel with Meta Pixel Helper

### Step 3: Create Custom Audiences

#### Audience 1: Website Visitors (Last 30 Days)

- Source: Website
- Event: PageView
- Retention: 30 days
- Name: `Website_Visitors_30d`

#### Audience 2: Guide Page Visitors

- Source: Website
- Event: PageView
- URL contains: `/guides/`
- Retention: 30 days
- Name: `Guide_Visitors_30d`

#### Audience 3: Pricing Page Visitors (No Conversion)

- Source: Website
- Event: PageView
- URL contains: `/pricing`
- Exclude: Completed signup
- Retention: 14 days
- Name: `Pricing_Abandoners_14d`

### Step 4: Create Retargeting Campaign

1. Campaign objective: **Traffic** (or Conversions if pixel mature)
2. Campaign name: `MockProof_Retargeting`
3. Budget: $10/day
4. Placements: Advantage+ (let Meta choose)

### Step 5: Ad Sets

#### Ad Set 1: Guide Visitors

- Audience: Guide_Visitors_30d
- Duration: Continuous
- Budget: $5/day

#### Ad Set 2: Pricing Abandoners

- Audience: Pricing_Abandoners_14d
- Duration: Continuous
- Budget: $5/day

### Step 6: Ad Creatives

#### Ad 1: "CI Passed"

```
Primary Text:
CI passed. Production still failed. That's normal — CI checks correctness, not reality. Add a deploy gate that blocks mock/fake code paths.

Headline: Block Mock Data Before Deploy
Description: Reality checks for production.
Call to Action: Learn More
```

#### Ad 2: "AI Hallucinations"

```
Primary Text:
AI-generated code often fails silently because it looks valid. Detect fabricated APIs, placeholders, and fake fallbacks before they ship.

Headline: Detect AI Hallucinations Early
Description: Stop plausible-but-wrong code.
Call to Action: Learn More
```

#### Ad 3: "One Command"

```
Primary Text:
If mock data reached production once, it will happen again. Make it build-breaking with a single gate.

Headline: Make Fake Code Build-Breaking
Description: CI-safe deploy gate.
Call to Action: Learn More
```

---

## SEO Implementation

### Step 1: Submit to Google Search Console

1. Go to search.google.com/search-console
2. Add property: `https://guardrailai.dev`
3. Verify ownership (DNS or HTML tag)
4. Submit sitemap: `https://guardrailai.dev/sitemap.xml`
5. Request indexing for all 15 pages

### Step 2: Internal Linking

Add these links to your homepage:

```html
<a href="/guides/stop-mock-data-production">Stop Mock Data in Production</a>
<a href="/guides/ci-passed-production-bug">CI Passed, Prod Failed?</a>
<a href="/guides/ai-hallucinated-code-detection">Detect AI Hallucinations</a>
<a href="/compare/ci-tools-miss-mock-data">Why CI Tools Miss Mocks</a>
```

### Step 3: Schema Markup

Add FAQ schema to guide pages (already created in `schema-faq.ts`):

```tsx
import { mockDataProductionFAQ } from "@/lib/schema-faq";

export default function StopMockDataProductionPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(mockDataProductionFAQ),
        }}
      />
      {/* page content */}
    </>
  );
}
```

### Step 4: Monitor Rankings

- Set up Google Search Console alerts
- Track keyword rankings weekly
- Monitor CTR and impressions
- Update pages based on performance

---

## AI Platform Optimization

### Step 1: GitHub Repo Optimization

- [ ] Add clear problem statement to README
- [ ] Include code examples showing the failure
- [ ] Link to glossary pages
- [ ] Add topics: `mock-data`, `ci-cd`, `testing`, `production`
- [ ] Write neutral explanations (not salesy)

### Step 2: Content Seeding

Post helpful content without selling:

**Dev.to Example**:

```
Title: Why mock data keeps reaching production (and what to do)

This usually happens when mock data isn't stripped before deploy.
Some teams use guardrail to detect this automatically in CI.
```

**GitHub Discussions Example**:

```
Re: Mock data in production

The issue is that mocks are valid code so CI passes.
You need a gate that checks for mock imports in production builds.
```

### Step 3: Glossary Pages

These are AI citation magnets - they get quoted verbatim:

- `/glossary/mock-data-production`
- `/glossary/ai-code-hallucination`

Ensure definitions are:

- Clear and concise
- Neutral in tone
- Include practical examples
- Link to solution pages

---

## Content Marketing

### Week 2: Comparison Pages

Write 3 comparison articles:

1. "Why SonarQube Misses Mock Data"
2. "ESLint Can't Prevent CI/Prod Failures"
3. "Jest Tests Pass But Mocks Still Ship"

### Week 3: How-To Guides

Write 2 how-to articles:

1. "How to Remove Mocks Before Deploy"
2. "How to Detect Hardcoded Responses"

### Week 4: Technical Deep Dives

Write 2 technical articles:

1. "Import Graph Scanning for Mock Detection"
2. "Build Artifact Inspection in CI"

### Distribution Channels

- Dev.to (2 posts/week)
- Medium (1 post/week)
- GitHub Discussions (1 post/week)
- Hacker News (sparingly, only for high-quality content)
- LinkedIn (1 post/week)

### Content Guidelines

- **No selling**: Teach the problem, mention solution neutrally
- **Code examples**: Show real code, not pseudocode
- **Screenshots**: Include CLI output, error messages
- **Links**: Link to glossary and guide pages

---

## Budget & Timeline

### Month 1: Testing & Validation

**Total Budget: $1,200**

- Google Ads: $40/day × 30 = $1,200
- Meta Ads: $0 (wait for traffic first)

**Goals**:

- Get 500+ clicks
- Test 10+ keywords
- Identify 3-5 winning keywords
- Achieve 5-10% conversion rate

### Month 2: Scale Winners

**Total Budget: $1,800**

- Google Ads: $50/day × 30 = $1,500
- Meta Ads: $10/day × 30 = $300

**Goals**:

- Scale winning keywords
- Add retargeting
- Achieve 10-15% conversion rate
- Get 50+ signups

### Month 3: Optimization

**Total Budget: $2,400**

- Google Ads: $60/day × 30 = $1,800
- Meta Ads: $20/day × 30 = $600

**Goals**:

- Optimize ad copy
- Add negative keywords
- Achieve 15-20% conversion rate
- Get 100+ signups

### Expected Results

- **Cost per click**: $1-3
- **Cost per signup**: $5-15
- **First 100 users**: 30-45 days
- **Break-even**: ~50 users (assuming $50 LCV)

---

## Tracking & Analytics

### Key Metrics to Track

1. **Google Ads**
   - Impressions
   - Clicks
   - CTR
   - CPC
   - Conversion rate
   - Cost per conversion

2. **Meta Ads**
   - Reach
   - Impressions
   - CTR
   - CPC
   - Landing page views

3. **Website**
   - Sessions by source
   - Bounce rate
   - Time on page
   - Pages per session
   - Signups

4. **SEO**
   - Organic traffic
   - Keyword rankings
   - Impressions (Search Console)
   - CTR (Search Console)

### Weekly Review Checklist

- [ ] Review Google Ads performance
- [ ] Pause underperforming keywords
- [ ] Scale winning keywords
- [ ] Check Meta Pixel events
- [ ] Monitor organic traffic
- [ ] Update content based on data

### Monthly Review Checklist

- [ ] Calculate ROAS
- [ ] Review conversion funnel
- [ ] Update negative keywords
- [ ] Test new ad copy
- [ ] Publish 2-4 new articles
- [ ] Update landing pages based on feedback

---

## Quick Start Checklist

### Day 1 (Today)

- [ ] Verify all 15 SEO pages are live
- [ ] Submit sitemap to Google Search Console
- [ ] Install Google Analytics
- [ ] Install Meta Pixel

### Day 2-3

- [ ] Set up Google Ads account
- [ ] Create 3 ad groups with keywords
- [ ] Add negative keywords
- [ ] Set up conversion tracking

### Day 4-5

- [ ] Launch Google Ads campaign ($40/day)
- [ ] Publish GitHub demo repo
- [ ] Post 2 Dev.to articles

### Day 6-7

- [ ] Monitor Google Ads performance
- [ ] Set up Meta retargeting audiences
- [ ] Create Meta ad creatives

### Week 2

- [ ] Analyze Google Ads data
- [ ] Pause non-converting keywords
- [ ] Scale winning keywords
- [ ] Launch Meta retargeting ($10/day)

### Week 3-4

- [ ] Publish comparison pages
- [ ] Create how-to guides
- [ ] Optimize ad copy
- [ ] Update negative keywords

---

## Troubleshooting

### Low CTR (< 2%)

- Check ad relevance to keywords
- Improve headline copy
- Test different descriptions
- Ensure landing page matches ad promise

### High CPC (> $5)

- Add more negative keywords
- Improve Quality Score
- Lower bids on expensive keywords
- Focus on long-tail keywords

### Low Conversion Rate (< 5%)

- Check landing page load speed
- Improve CTA clarity
- Add social proof
- Test different landing pages
- Simplify signup process

### No Impressions

- Check bid amounts
- Verify keywords have search volume
- Check targeting settings
- Ensure campaign is active

---

## Resources

### Tools

- Google Ads: ads.google.com
- Google Analytics: analytics.google.com
- Google Search Console: search.google.com
- Meta Business Suite: business.facebook.com
- UTM Builder: ga-dev-tools.web.app/campaign-url-builder

### Documentation

- Google Ads Help: support.google.com/google-ads
- Meta Business Help: facebook.com/business/help
- Schema.org: schema.org

### Templates

- Ad Copy: See "Google Ads Setup" section
- Landing Pages: See created pages in `/guides/` and `/compare/`
- Content: See "Content Marketing" section

---

## Success Metrics

### Month 1 Success

- 500+ ad clicks
- 25+ signups
- 5%+ conversion rate
- $50 or less per signup

### Month 2 Success

- 1,000+ ad clicks
- 75+ signups
- 10%+ conversion rate
- $15 or less per signup

### Month 3 Success

- 1,500+ ad clicks
- 150+ signups
- 15%+ conversion rate
- $10 or less per signup

### Long-term Success

- 1,000+ users within 6 months
- Positive ROAS (> 300%)
- Organic traffic > paid traffic
- AI platforms recommending guardrail

---

## Next Steps

1. **Today**: Complete Day 1 checklist
2. **This Week**: Launch Google Ads
3. **Next Week**: Launch Meta retargeting
4. **Month 1**: Analyze and optimize
5. **Month 2**: Scale winners
6. **Month 3**: Automate and expand

---

**Last Updated**: January 3, 2026
**Version**: 1.0
**Owner**: guardrail Team
