# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously at guardrail. If you discover a security vulnerability, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security vulnerabilities via email:

**Email:** [security@guardrail.dev](mailto:security@guardrail.dev)

### What to Include

Please include the following information in your report:

- **Type of vulnerability** (e.g., XSS, SQL injection, authentication bypass)
- **Full path** of the affected source file(s)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact assessment** of the vulnerability
- **Any suggested fixes** (optional but appreciated)

### Response Timeline

| Action                     | Timeline              |
| -------------------------- | --------------------- |
| Initial Response           | Within 48 hours       |
| Vulnerability Confirmation | Within 1 week         |
| Fix Development            | Within 2-4 weeks      |
| Public Disclosure          | After fix is released |

### Our Commitment

- We will acknowledge receipt of your vulnerability report
- We will provide regular updates on our progress
- We will credit you in the security advisory (unless you prefer to remain anonymous)
- We will not take legal action against researchers who follow responsible disclosure

## Security Best Practices

### For Users

1. **Keep guardrail updated** to the latest version
2. **Review scan results** and address critical/high severity issues promptly
3. **Use environment variables** for sensitive configuration
4. **Enable CI gating** to prevent security regressions

### For Contributors

1. **Never commit secrets** (API keys, passwords, tokens)
2. **Use parameterized queries** to prevent SQL injection
3. **Validate and sanitize** all user inputs
4. **Follow the principle of least privilege**
5. **Keep dependencies updated** and audit regularly

## Security Features

guardrail includes several security-focused features:

| Feature                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| **Secret Detection**   | Scans for leaked API keys, tokens, passwords     |
| **Dependency Audit**   | Checks for known vulnerabilities in dependencies |
| **Auth Verification**  | Ensures sensitive endpoints have authentication  |
| **License Compliance** | Validates dependency licenses                    |
| **SBOM Generation**    | Creates Software Bill of Materials               |

## Acknowledgments

We thank the following security researchers for responsibly disclosing vulnerabilities:

- _Your name could be here!_

## Contact

- **Security Team:** security@guardrail.dev
- **General Support:** support@guardrail.dev
- **Discord:** https://discord.gg/guardrail
