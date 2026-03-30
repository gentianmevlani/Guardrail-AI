# guardrail CLI Commands - Complete List

Complete list of all available CLI commands in guardrail CLI v2.5.0.

## All CLI Commands (19 Total)

### Authentication
1. **`auth`** - Authenticate with your guardrail API key
   - `--key <apiKey>` - Your API key from guardrail.dev
   - `--status` - Check authentication status
   - `--refresh` - Force revalidation of cached entitlements
   - `--logout` - Remove stored credentials

### Scanning Commands
2. **`scan`** - Run security scans on the codebase
3. **`scan:secrets`** - Scan for hardcoded secrets and credentials
4. **`scan:vulnerabilities`** - Scan dependencies for known vulnerabilities using OSV
5. **`scan:compliance`** - Run compliance assessment (Pro/Enterprise)

### SBOM
6. **`sbom:generate`** - Generate Software Bill of Materials (Pro/Enterprise)

### Code Quality
7. **`smells`** - Analyze code smells and technical debt (Pro feature enables advanced analysis)
8. **`fix`** - Fix issues with AI-powered analysis and guided suggestions (Starter+)
9. **`fix-rollback`** - Rollback fixes to a previous backup

### Deployment
10. **`ship`** - Ship Check - Plain English audit and readiness assessment (Starter+)
11. **`ship:pro`** - Pro Ship Check - Comprehensive scanning with all services (Pro $99/mo)

### Testing
12. **`reality`** - Reality Mode - Browser testing and fake data detection (Starter+)
13. **`reality:graph`** - Generate and analyze Reality Graph

### AI Features
14. **`autopilot`** - Autopilot batch remediation (Pro/Compliance)
15. **`autopatch:verify`** - Generate and verify a fix with proof gates
16. **`autopatch:merge`** - Merge a verified fix
17. **`receipt:verify`** - Verify Proof-of-Execution Receipt

### Setup
18. **`init`** - Initialize guardrail in a project with framework detection and templates
19. **`menu`** - Open interactive menu

### Cache (Subcommands)
20. **`cache:clear`** - Clear OSV vulnerability cache
21. **`cache:status`** - Show cache statistics

## Command Summary

**Total Unique Commands:** 19 main commands + 2 cache subcommands = **21 total commands**

### By Category

- **Authentication:** 1 command (auth)
- **Scanning:** 4 commands (scan, scan:secrets, scan:vulnerabilities, scan:compliance)
- **SBOM:** 1 command (sbom:generate)
- **Code Quality:** 3 commands (smells, fix, fix-rollback)
- **Deployment:** 2 commands (ship, ship:pro)
- **Testing:** 2 commands (reality, reality:graph)
- **AI Features:** 4 commands (autopilot, autopatch:verify, autopatch:merge, receipt:verify)
- **Setup:** 2 commands (init, menu)
- **Cache:** 2 subcommands (cache:clear, cache:status)

### By Tier

- **Free:** scan, scan:secrets, scan:vulnerabilities, auth, init, menu, cache:clear, cache:status
- **Starter+:** ship, reality, fix
- **Pro:** scan:compliance, sbom:generate, ship:pro, smells (advanced), autopilot
- **Enterprise:** All Pro features + additional compliance features

## Testing Notes

During manual testing, I tested:
- **14 help commands** (all commands with --help flag)
- **9 project tests** (3 commands × 3 projects: scan:secrets, scan:vulnerabilities, ship)

This equals **23 total test runs**, not 23 unique commands. The actual CLI has **21 total commands** (19 main + 2 cache subcommands).
