# 🚀 guardrail Quick Start Guide

Welcome to guardrail! This guide will get you up and running in minutes.

## 📋 Prerequisites

- Node.js 18+ 
- Your project codebase
- API key from [guardrail.dev](https://guardrail.dev)

## ⚡ 5-Minute Setup

### 1. Install guardrail
```bash
# Global installation (recommended)
npm install -g guardrail

# Or use with npx
npx guardrail --help
```

### 2. Authenticate
```bash
# Get your API key from https://guardrail.dev
guardrail auth --key gr_starter_your_api_key_here
```

### 3. Run Your First Scan
```bash
# Basic scan (Free tier)
guardrail scan --path ./your-project
```

That's it! You're now protected against AI-generated code issues.

## 🎯 Choose Your Tier

### 🆓 Free Tier - Perfect for Testing
```bash
# Basic security scanning
guardrail scan --path ./project
guardrail scan:secrets --path ./project
```

### 🚀 Starter Tier - Ship with Confidence
```bash
# Ship readiness checks
guardrail ship --path ./project
guardrail reality --url http://localhost:3000
guardrail fix --path ./project
```

### 💼 Pro Tier - Advanced Analysis
```bash
# Code quality and technical debt
guardrail smells --pro --path ./project
guardrail autopilot --mode plan --path ./project
```

### 🏢 Enterprise Tier - Compliance Ready
```bash
# Enterprise compliance
guardrail scan:compliance --framework soc2 --path ./project
guardrail sbom:generate --path ./project
```

## 🔧 Common Workflows

### CI/CD Integration
```yaml
# .github/workflows/guardrail.yml
name: guardrail Security Check
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run guardrail
        run: |
          guardrail auth --key ${{ secrets.GUARDRAIL_API_KEY }}
          guardrail ship --path .
```

### Local Development
```bash
# Quick check before commit
guardrail scan --path .

# Full ship readiness
guardrail ship --path . --mockproof

# Reality testing (run your app first)
guardrail reality --url http://localhost:3000
```

### Fix Issues
```bash
# Get fix suggestions
guardrail fix --path ./project --dry-run

# Apply fixes (Starter+)
guardrail fix --path ./project --type guided
```

## 📊 Understanding Results

### Ship Check Output
```
🚢 SHIP CHECK
Status: READY ✅
Score: 92/100
Issues: 0 found

✅ Your app is ready for production!
```

### Reality Mode Output
```
🌐 REALITY MODE
Status: PASSED ✅
Score: 95/100
Issues: 0 fake API calls detected

✅ Your app uses real data!
```

### Code Smells Output
```
👃 CODE SMELL ANALYSIS
Total Smells: 3
Technical Debt: 4 hours (AI-adjusted: 1 hour)

🔧 High Priority:
- Complex function in auth.ts
- Duplicate code in utils.js
- Missing error handling
```

## 🎯 Pro Tips

### 1. Start with Free Tier
Test guardrail on your project with the free tier to see what issues it finds.

### 2. Use Ship Checks Before Deploy
Always run `guardrail ship` before deploying to production.

### 3. Enable Reality Mode
Run `guardrail reality` to catch fake data that tests miss.

### 4. Fix Issues Systematically
Use `guardrail fix --dry-run` to preview fixes before applying.

### 5. Monitor Technical Debt
Run `guardrail smells --pro` weekly to track code quality.

## 🔒 Security Best Practices

### API Keys
- Never commit API keys to git
- Use environment variables in CI/CD
- Rotate keys regularly

### Team Usage
```bash
# Team authentication (Enterprise)
guardrail auth --key gr_ent_company_key_here

# Check team status
guardrail team:status
```

### Audit Trail
```bash
# View recent scans (Enterprise)
guardrail audit:recent --team my-team

# Export compliance report
guardrail scan:compliance --framework soc2 --export pdf
```

## 🆘 Getting Help

### Command Help
```bash
guardrail --help
guardrail ship --help
guardrail scan --help
```

### Debug Mode
```bash
GUARDRAIL_DEBUG=true guardrail scan --path ./project
```

### Support
- 📖 [Documentation](https://guardrail.dev/docs)
- 💬 [Discord Community](https://discord.gg/guardrail)
- 📧 [Support](mailto:support@guardrail.dev)

## 🎉 You're Ready!

You've successfully set up guardrail! Your code is now protected from:
- ✅ Leaked secrets and credentials
- ✅ Mock data in production
- ✅ API endpoint drift
- ✅ Security vulnerabilities
- ✅ Code quality issues

Happy coding! 🚀
