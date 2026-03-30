# 🚀 guardrail CLI v2.5.0 - Quick Start Guide

## ⚡ Installation

```bash
# Install globally
npm install -g guardrail-cli-tool@latest

# Or use npx (no installation required)
npx guardrail-cli-tool@latest --help
```

## 🎯 First Steps

### 1. **Open the Interactive Menu**
```bash
guardrail menu
```
Use arrow keys (↑↓) to navigate, Enter to select, Escape to exit.

### 2. **Authenticate**
```bash
guardrail auth --key YOUR_API_KEY
```
Get your API key from [guardrail.dev](https://guardrail.dev)

### 3. **Scan Your Project**
```bash
# Quick scan
guardrail scan:secrets

# Comprehensive scan
guardrail scan --type all --format table
```

## 🔥 New Features in v2.5.0

### **🎮 Interactive Menu**
- Arrow key navigation (no more numbers!)
- Visual selection indicators
- All commands accessible from one place

### **🎭 Reality Mode with Auto-Install**
```bash
guardrail reality --url https://your-site.com --flow user-journey
```
Automatically installs Playwright if needed!

### **📦 Ship Check**
```bash
guardrail ship --path ./your-project
```
Plain English audit and deployment readiness.

## 📋 Common Workflows

### **Daily Security Scan**
```bash
guardrail menu
# Select "🔍 Scan Project" → "Full Scan"
```

### **Before Deployment**
```bash
guardrail ship --path ./project
guardrail reality --url https://staging.yoursite.com
```

### **Project Setup**
```bash
guardrail init --path ./new-project --template startup
guardrail menu
# Select "⚙️ Configuration" → "Generate CI/CD"
```

## 🛠️ Advanced Usage

### **Custom Scanning**
```bash
# Secrets only
guardrail scan:secrets --path ./src --format json

# Vulnerabilities with OSV
guardrail scan:vulnerabilities --path ./project --fail-on-critical

# Compliance (SOC2, ISO27001, etc.)
guardrail scan:compliance --framework SOC2 --path ./project
```

### **Reality Mode Flows**
```bash
# User journey testing
guardrail reality --url https://app.example.com --flow user-journey

# E-commerce checkout
guardrail reality --url https://shop.example.com --flow checkout --evidence

# Authentication flow
guardrail reality --url https://auth.example.com --flow auth
```

### **AI-Powered Fixes**
```bash
# Fix issues automatically
guardrail fix --path ./project --auto

# Review fixes before applying
guardrail fix --path ./project --review

# Rollback if needed
guardrail fix-rollback --backup-id abc123
```

## 📊 Output Formats

### **Table (Default)**
```bash
guardrail scan:secrets --format table
```
Human-readable colored output

### **JSON**
```bash
guardrail scan:secrets --format json --output results.json
```
Machine-readable for CI/CD

### **SARIF**
```bash
guardrail scan:secrets --format sarif --output results.sarif
```
GitHub Code Scanning integration

### **Markdown**
```bash
guardrail scan:secrets --format markdown --output report.md
```
Documentation and reports

## 🔧 Configuration

### **Project Configuration**
```bash
guardrail init --path ./project --template enterprise
```
Creates `.guardrail/config.json` with project settings.

### **CI/CD Integration**
```bash
guardrail init --ci github --format sarif
```
Generates GitHub Actions workflow.

### **Environment Variables**
```bash
export GUARDRAIL_API_KEY="your-api-key"
export GUARDRAIL_CACHE_DIR="/tmp/guardrail-cache"
```

## 🎯 Tips & Tricks

### **1. Use the Menu!**
The interactive menu is the easiest way to explore all features.

### **2. Cache Management**
```bash
# Check cache status
guardrail cache:status

# Clear cache (if issues)
guardrail cache:clear
```

### **3. Batch Operations**
```bash
# Scan multiple projects
for dir in projects/*/; do
  guardrail scan --path "$dir" --format json --output "$dir/results.json"
done
```

### **4. Integration with IDE**
Most IDEs support CLI integration:
- **VS Code**: Command Palette → "guardrail: Scan Project"
- **JetBrains**: Tools → guardrail → Scan Current File

## 🚨 Common Issues

### **"Playwright not found"**
Reality Mode auto-installs Playwright. If it fails:
```bash
npm install playwright @playwright/test
npx playwright install
```

### **"API key invalid"**
Check your key format:
```bash
guardrail auth --status
```

### **"Permission denied"**
Ensure proper file permissions:
```bash
chmod +x $(which guardrail)
```

## 📞 Need Help?

### **Built-in Help**
```bash
guardrail --help
guardrail <command> --help
```

### **Interactive Help**
```bash
guardrail menu
# Select "❓ Help & Documentation"
```

### **Community**
- GitHub: [guardiavault-oss/codeguard](https://github.com/guardiavault-oss/codeguard)
- Discord: [guardrail Community](https://discord.gg/guardrail)
- Email: team@guardrail.dev

---

## 🎉 Ready to Go!

You're all set with guardrail CLI v2.5.0! Here's a recommended first workflow:

```bash
# 1. Open the menu
guardrail menu

# 2. Authenticate (if not already)
# Select "🔐 Authentication"

# 3. Scan your current project
# Select "🔍 Scan Project" → "Quick Scan"

# 4. Try Reality Mode
# Select "🚀 Reality Mode"

# 5. Run Ship Check
# Select "📦 Ship Check"

Welcome to the future of security scanning! 🚀✨
