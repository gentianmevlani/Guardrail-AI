# guardrail Examples

This directory contains example projects demonstrating how to integrate guardrail into different types of applications.

## Available Examples

| Example                      | Framework  | Description                          |
| ---------------------------- | ---------- | ------------------------------------ |
| [nextjs-app](./nextjs-app)   | Next.js 14 | Full-stack React app with App Router |
| [express-api](./express-api) | Express.js | REST API with auth middleware        |

## Quick Start

Each example is a standalone project. To try one:

```bash
cd examples/nextjs-app  # or express-api
npm install
npx guardrail scan
```

## What Each Example Demonstrates

### Next.js App

- Basic guardrail integration
- GitHub Actions CI workflow
- Configuration for React/Next.js projects
- SARIF integration for GitHub Security

### Express API

- API route verification
- Auth middleware detection
- Environment variable validation
- Custom rule configuration

## Running Examples

### Prerequisites

- Node.js 20+
- npm or pnpm

### Steps

1. **Navigate to example:**

   ```bash
   cd examples/nextjs-app
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Run guardrail scan:**

   ```bash
   npx guardrail scan
   ```

4. **View results:**
   ```bash
   cat .guardrail/summary.md
   # or open .guardrail/report.html in browser
   ```

## Creating Your Own

Use these examples as starting points for your own projects:

1. Copy the `guardrail.config.json` file
2. Copy the `.github/workflows/guardrail.yml` file
3. Customize for your project structure

## Configuration Reference

All examples use a similar configuration structure:

```json
{
  "version": "2.0.0",
  "checks": ["integrity", "security", "hygiene"],
  "policy": {
    "failOn": ["critical", "high"]
  },
  "ignore": {
    "paths": ["node_modules", "dist"]
  }
}
```

See the [Configuration Documentation](https://guardrail.dev/docs/config) for all options.

## Contributing Examples

Want to add an example for another framework? We welcome contributions!

1. Create a new directory: `examples/your-framework`
2. Include: README.md, package.json, guardrail.config.json
3. Add a GitHub Actions workflow
4. Submit a PR

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.
