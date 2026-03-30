# Next.js Example with guardrail

This example demonstrates how to integrate guardrail into a Next.js application.

## Quick Start

```bash
# Install dependencies
npm install

# Run guardrail scan
npx guardrail scan

# Start development
npm run dev
```

## What This Example Shows

1. **Basic Integration** - How to add guardrail to a Next.js project
2. **CI Configuration** - GitHub Actions workflow for guardrail gate
3. **Configuration** - Sample `guardrail.config.json` for Next.js

## Project Structure

```
nextjs-app/
├── src/
│   ├── app/           # Next.js app router
│   └── components/    # React components
├── .github/
│   └── workflows/     # CI configuration
├── guardrail.config.json
└── package.json
```

## Configuration

See `guardrail.config.json` for the recommended configuration:

```json
{
  "version": "2.0.0",
  "checks": ["integrity", "security", "hygiene"],
  "policy": {
    "failOn": ["critical", "high"]
  },
  "ignore": {
    "paths": [".next", "node_modules"]
  }
}
```

## CI Integration

The `.github/workflows/guardrail.yml` file shows how to:

- Run guardrail on every PR
- Upload SARIF results to GitHub Security
- Block merges on policy violations

## Learn More

- [guardrail Documentation](https://guardrail.dev/docs)
- [Next.js Documentation](https://nextjs.org/docs)
