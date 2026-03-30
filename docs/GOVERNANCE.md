# Governance

This document describes the governance model for the guardrail project.

## Overview

guardrail is an open source project that welcomes contributions from anyone. The project is maintained by a core team with input from the community.

## Roles

### Users

Anyone who uses guardrail. Users can:

- Use guardrail in their projects
- Report bugs and request features
- Participate in discussions
- Share their experiences

### Contributors

Anyone who contributes to guardrail. Contributors can:

- Submit pull requests
- Review code
- Improve documentation
- Help other users
- Triage issues

### Maintainers

Trusted contributors with write access. Maintainers can:

- Merge pull requests
- Manage issues and labels
- Release new versions
- Guide project direction

### Core Team

The core team makes final decisions on project direction:

- Set roadmap priorities
- Make breaking change decisions
- Manage security issues
- Handle governance matters

## Decision Making

### Day-to-Day Decisions

Most decisions are made through GitHub:

- **Issues** - Bug reports and feature requests
- **Pull Requests** - Code changes with review
- **Discussions** - Longer conversations

### Significant Decisions

For significant changes (breaking changes, new features, governance):

1. **Proposal** - Open an issue or discussion
2. **Discussion** - Community feedback period (minimum 1 week)
3. **Decision** - Core team makes final call
4. **Communication** - Decision announced publicly

### Conflict Resolution

If consensus cannot be reached:

1. Discussion continues in the issue/PR
2. Core team members discuss privately
3. Final decision by project lead
4. Decision is documented

## Code of Conduct

All participants must follow our [Code of Conduct](CODE_OF_CONDUCT.md).

Violations can be reported to: conduct@guardrail.dev

## Becoming a Maintainer

Maintainers are selected based on:

- **Sustained contributions** over time
- **Quality of work** (code, reviews, docs)
- **Community involvement** (helping others)
- **Alignment** with project values

To be considered:

1. Be an active contributor for 3+ months
2. Have multiple merged PRs
3. Demonstrate understanding of the codebase
4. Be nominated by existing maintainer

## Releases

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **Major** (x.0.0) - Breaking changes
- **Minor** (0.x.0) - New features
- **Patch** (0.0.x) - Bug fixes

### Release Process

1. Maintainer creates release branch
2. Changelog updated
3. Version bumped
4. Release created on GitHub
5. Package published to npm

## Security

Security issues are handled privately:

1. Report to security@guardrail.dev
2. Core team assesses impact
3. Fix developed privately
4. Coordinated disclosure
5. Public announcement

See [SECURITY.md](SECURITY.md) for details.

## Changes to Governance

This governance model can be changed through:

1. Proposal via GitHub issue
2. Community discussion (minimum 2 weeks)
3. Core team approval
4. Documentation update

## Contact

- **General:** team@guardrail.dev
- **Security:** security@guardrail.dev
- **Conduct:** conduct@guardrail.dev
