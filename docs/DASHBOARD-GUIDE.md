# guardrail Dashboard Guide

This document describes the guardrail web dashboard structure, layout, and each page's functionality.

---

## Dashboard Layout

The dashboard uses a **sidebar + header + main content** layout:

### Sidebar (Left Navigation)
- **Dark theme** with black background (`bg-black`) and zinc borders
- **guardrail logo** at the top with brand name
- **Navigation items** with icons from Lucide React
- **System status indicator** at the bottom showing "System Secure" with last scan time

### Header (Top Bar)
- **Search bar** - Search for vulnerabilities across the codebase
- **Notifications dropdown** - Real-time security alerts with:
  - Unread count badge
  - Alert types: error (red), warning (amber), success (green), info (blue)
  - Mark as read functionality
  - Time-relative formatting (e.g., "2m ago")
- **Profile dropdown** - Quick access to profile, settings, and logout

---

## Dashboard Pages

### 1. Overview (Dashboard) `/dashboard`
**Icon:** LayoutDashboard | **Purpose:** Main command center

**Features:**
- **Stats Grid** (4 cards):
  - **Total Protected** - Number of repositories under monitoring
  - **Auto-Fixes** - Issues resolved automatically by AI
  - **Compliance** - Combined SOC2 & ISO 27001 readiness percentage
  - **Active Alerts** - Critical issues requiring attention

- **Health Graph** - Visual security health over time
- **Live Activity Feed** - Real-time security events and automated actions
- **Recent Projects** - Repositories under active monitoring with scan status
- **System Status** - API latency, context window usage, memory metrics

**Paywall:** Requires paid subscription to access (redirects to pricing if unpaid)

---

### 2. Ship Check `/ship`
**Icon:** Rocket | **Badge:** "New" | **Purpose:** Pre-deployment validation suite

**Tagline:** "Stop shipping pretend features"

**Tabs:**
1. **Overview** - Summary of all checks with pass/fail/warning status
2. **MockProof** - Import graph analysis from production entrypoints
   - Detects banned imports in production code
   - Shows violation chains with file paths
   - Verdict: PASS or FAIL
3. **Reality Mode** - Runtime fake detection
   - Spins up the app and intercepts network calls
   - Catches fake APIs, demo data, placeholder content
4. **Ship Badge** - Shareable proof of production readiness
   - Visual badge with score ring (0-100)
   - Embed code for README files
   - Verdict: 🚀 SHIP IT, ⚠️ REVIEW, or ⛔ NO SHIP

**Actions:**
- Run Ship Check (one-click full scan)
- Export Report
- History tracking

---

### 3. Security `/security`
**Icon:** Shield | **Purpose:** Security orchestrator & unified scanning

**Features:**
- **Deploy Verdict Banner** - SHIP (green), NO_SHIP (red), or UNKNOWN
- **Security Score** - 0-100 based on risk assessment

- **Severity Stats** (4 cards):
  - Critical (red) - Immediate action required
  - High (orange) - Fix before shipping
  - Medium (yellow) - Review recommended
  - Total Findings (blue)

**Tabs:**
1. **Overview** - Three scanner cards:
   - **Policy Engine** - Mock data, localhost URLs, banned patterns
   - **Secret Scanner** - API keys, tokens, passwords detection
   - **Supply Chain** - Dependency vulnerabilities & licenses

2. **Policy Checks** - Table of policy violations with:
   - Pattern, file, line number, code snippet

3. **Secrets** - Detected credentials with:
   - Type, severity, file, line, redacted value

4. **Supply Chain** - Dependency vulnerability analysis

**Actions:** Run Full Scan (4-step progress: Policy → Secrets → Ship → Full)

---

### 4. Guardrails `/guardrails`
**Icon:** Wand2 | **Purpose:** AI-powered code validation rules

**Features:**
- **Quick Stats** (4 cards): Active Rules, Blocked Today, Validations, Streak

- **Preset Guardrails** - Toggle-able rule sets:
  | Preset | Category | Rules |
  |--------|----------|-------|
  | Security Essentials | security | 8 |
  | Prompt Injection Defense | ai-safety | 5 |
  | Hallucination Detection | ai-safety | 4 |
  | Code Quality Gate | quality | 12 |
  | Secrets & Credentials | security | 6 |
  | OWASP Top 10 | compliance | 10 |

- **Test Sandbox** - Paste code to test against active guardrails
- **Live Validation Stream** - Real-time 6-stage pipeline visualization
- **Validation Results** - AI-powered analysis with explanations
- **Custom Guardrails** - Natural language rule creation (no regex required)

---

### 5. Activity `/activity`
**Icon:** Activity | **Purpose:** Audit log and event history

**Features:**
- **Recent Events** - Timeline of system actions with:
  - Status indicators (success/error)
  - Action name and details
  - User attribution
  - Timestamp

- **Filters Panel**:
  - Security Scans
  - System Errors
  - User Actions

**Requires:** GitHub connection to see activity

---

### 6. Compliance `/compliance`
**Icon:** FileText | **Purpose:** Compliance frameworks and gap analysis

**Features:**
- **Framework Cards**:
  1. **SOC 2 Type II** - Security, Availability, Confidentiality
     - Control coverage percentage
     - Passing vs needs-attention controls
     - Gap analysis button
  
  2. **ISO 27001** - Information Security Management
     - Control coverage percentage
     - Passing vs in-progress controls
     - Audit trail button

- **Generated Reports** - Downloadable compliance reports
  - Report name, type, date
  - Download button

**Requires:** GitHub connection for analysis

---

### 7. Showcase `/showcase`
**Icon:** Sparkles | **Purpose:** Demo of AI guardrails capabilities

**Features:**
- **Hero Section** - Gradient banner with tagline
- **Security Score Ring** - Animated real-time health indicator with:
  - Score (0-100)
  - Trend comparison
  - Streak counter

- **Live Validation Stream** - 6-stage pipeline demo
- **AI Explainability** - Detailed explanations of why things are flagged
- **Natural Language Rules** - Plain English rule configuration
- **Achievements Grid** - Gamification with badges:
  - First Scan, Guardian, Streak Master, etc.
  - Progress tracking
  - Unlock dates

---

### 8. Integrations `/integrations`
**Icon:** Key | **Purpose:** MCP plugin setup and IDE connections

**Sections:**

1. **API Key Management**
   - Generate/regenerate/revoke API key
   - Show/hide toggle
   - Copy to clipboard

2. **CLI Setup**
   - Installation commands (macOS/Linux/Windows)
   - Authentication with API key
   - Quick commands: `scan`, `guard`, `fix`

3. **One-Click IDE Installation**
   | IDE | Status | Config Path |
   |-----|--------|-------------|
   | Cursor | Recommended | ~/.cursor/mcp.json |
   | Windsurf | Recommended | ~/.windsurf/mcp_config.json |
   | VS Code | Available | ~/.vscode/mcp-servers.json |

4. **Manual Configuration** - JSON config template with copy button

5. **Quick Start Guide** - 3-step setup flow

6. **Feature Cards**:
   - Real-time Security
   - Auto-Fix Suggestions
   - Context-Aware Analysis

---

### 9. Pricing `/pricing`
**Icon:** CreditCard | **Purpose:** Subscription tiers

**Tiers:**

| Plan | Price | Key Features |
|------|-------|--------------|
| **Free** | $0/mo | MockProof, 1 project, 100 validations |
| **Starter** ⭐ | $19/mo | Reality Mode, Ship Badge, 3 projects, 1K validations |
| **Pro** | $49/mo | AI Code Reviewer, Predictive Quality, 10 projects, 10K validations |
| **Enterprise** | $199/mo | Compliance, SSO, Audit Logs, 50+ projects, Unlimited |

**Features:**
- Annual/monthly toggle (17% annual discount)
- Stripe checkout integration
- FAQ section

---

### 10. Profile `/profile`
**Icon:** User | **Purpose:** User account settings

**Sections:**

1. **Profile Card** (left column)
   - Avatar with upload button
   - Display name and email
   - Role badge (Admin/Member)
   - Join date

2. **Personal Information**
   - Editable display name
   - Read-only email

3. **Email Notifications**
   - Verified status indicator
   - Send test email button
   - Security alerts toggle

4. **Slack Integration**
   - Webhook URL configuration
   - Connect/disconnect buttons
   - Notification toggle

---

### 11. Settings `/settings`
**Icon:** Settings | **Purpose:** GitHub integration and AI configuration

**Sections:**

1. **GitHub Integration**
   - Connection status badge
   - Connected account info with username
   - Repository count
   - Sync repos button
   - Disconnect button
   - Repository list with:
     - Private/public indicator
     - Language badge
     - Scan status
     - External link

2. **AI Guardrails Configuration**
   - **Auto-Fix PRs** - Auto-open PRs for high-severity issues
   - **Block Vulnerable Commits** - Prevent merging vulnerable code
   - **Stylistic Enforcement** - Enforce code style rules

---

### 12. Billing `/billing`
**Icon:** CreditCard | **Purpose:** Subscription management

**Features:**
- **Plan Cards** - Same tiers as pricing page
  - Current plan highlighted with badge
  - Upgrade/downgrade buttons

- **Payment Method Section**
  - Card brand and last 4 digits
  - Expiry date
  - Default indicator
  - Update button
  - Add payment method (if none)

---

## Visual Design System

### Colors
- **Background:** Black (`bg-black`) with zinc overlays
- **Primary:** Blue-600 (`#2563eb`) - buttons, links, highlights
- **Success:** Emerald-500 (`#10b981`) - passed, connected
- **Warning:** Amber-500 (`#f59e0b`) - warnings, attention
- **Error:** Red-500 (`#ef4444`) - failures, critical
- **Text:** White for headings, zinc-400 for body, zinc-500 for muted

### Components
- **Cards:** `bg-black/40 border-zinc-800 backdrop-blur-sm`
- **Buttons:** Blue-600 with glow effect for primary actions
- **Badges:** Outline style with color-coded borders
- **Tables:** Zinc-800 borders, hover states

### Effects
- **Glow:** `shadow-[0_0_15px_-3px_rgba(37,99,235,0.5)]` for primary CTAs
- **Backdrop blur:** Glass-morphism on cards
- **Animations:** Framer Motion for page transitions and loading states

---

*Context Enhanced by guardrail AI*
