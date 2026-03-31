# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing us at:

**security@guardrailai.dev**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Security Features

guardrail includes several built-in security features:

### Secret Detection
- Scans for hardcoded API keys, tokens, and credentials
- Entropy-based detection for high-entropy strings
- Git history scanning for leaked secrets
- Pre-commit hooks to prevent secret commits

### Dependency Scanning
- OSV vulnerability database integration
- Real-time CVE detection
- SBOM generation for supply chain security
- License compliance checking

### Code Security
- Static analysis for common vulnerabilities
- Authentication enforcement validation
- Input validation checks
- SQL injection detection

## Security Best Practices

When using guardrail:

1. **Never commit `.env` files** - Use `.env.example` templates instead
2. **Use API key authentication** - Always authenticate with `guardrail auth --key YOUR_KEY`
3. **Enable pre-commit hooks** - Run `guardrail init --hooks` to catch issues before commit
4. **Review SARIF output** - Use `--format sarif` for detailed security reports
5. **Keep CLI updated** - Run `npm update -g guardrail-cli-tool` regularly

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find similar problems
3. Prepare fixes for all supported versions
4. Release new security patch versions ASAP

## Security Credits

We appreciate the security research community's efforts in responsibly disclosing vulnerabilities.

Security researchers who report valid vulnerabilities will be:
- Acknowledged in our release notes (if desired)
- Listed in our security credits
- Eligible for our bug bounty program (coming soon)

## Contact

For security concerns, contact: **security@guardrailai.dev**

For general questions: **support@guardrailai.dev**
