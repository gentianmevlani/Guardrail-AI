# guardrail AI - Installation Guide

## Quick Installation

### Option 1: Direct CLI Install (Recommended)

```bash
# Install globally from npm
npm install -g guardrail-cli-tool

# Or install from local build
npm install -g ./guardrail-monorepo-1.0.0.tgz
```

### Option 2: Manual Setup

```bash
# Clone the repository
git clone https://github.com/guardiavault-oss/guardrail.git
cd guardrail

# Install dependencies
pnpm install

# Build the project
npm run build

# Install CLI globally
npm install -g .
```

## Usage

### Install Guardrails on Any Project

```bash
# Navigate to your project
cd /path/to/your/project

# Install guardrail guardrails
guardrail install

# Or run the interactive wizard
guardrail wizard
```

### Available Commands

```bash
guardrail install [target-dir]    # Install guardrails to project
guardrail wizard                  # Interactive setup wizard
guardrail vibe                    # Run vibe check on project
guardrail fix                     # Auto-fix missing features
guardrail badge                   # Generate health badges
guardrail design                  # Check design system compliance
guardrail predeploy               # Pre-deployment validation
guardrail hook                    # Install Git pre-push hook
```

## What Gets Installed

When you run `guardrail install` on your project, it adds:

- **ESLint Configuration** - Custom rules for AI-generated code
- **TypeScript Config** - Strict type checking
- **Prettier Config** - Consistent formatting
- **Git Hooks** - Pre-commit validation
- **API Validator** - Prevents mock data usage
- **Security Scripts** - Automated security checks
- **Quality Scripts** - Code quality validation

## Example: Protecting a New Repository

```bash
# 1. Create or navigate to your project
cd my-awesome-project

# 2. Initialize if needed
npm init -y

# 3. Install guardrail
guardrail install

# 4. Follow the prompts to configure
#    - Select your project type
#    - Choose security level
#    - Set up API endpoints

# 5. Start coding with AI guardrails!
```

## Features Added to Your Project

### 🔒 Security Guardrails
- Prevents API endpoint misuse
- Blocks mock data in production
- Validates external API calls
- Security vulnerability scanning

### 🎯 Code Quality
- ESLint rules for AI code
- TypeScript strict mode
- Automated formatting
- Pre-commit hooks

### 📊 Monitoring
- Code quality metrics
- Security scanning reports
- AI usage analytics
- Health badges generation

## Integration with IDEs

### VS Code
```bash
# Install recommended extensions
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
```

### Cursor/Windsurf
The `.cursorrules` file provides AI-specific guidelines that work automatically with these IDEs.

## Configuration

After installation, customize these files:

- `.cursorrules` - AI coding guidelines
- `eslint.config.js` - Linting rules
- `tsconfig.json` - TypeScript settings
- `src/config/api-endpoints.ts` - API validation

## Support

- **Documentation**: `docs/` directory
- **Issues**: GitHub Issues
- **Community**: Discord/Slack (links in README)

---

**Ready to secure your AI-assisted development workflow! 🚀**
