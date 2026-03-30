# guardrail Phase 1: Core Infrastructure & AI Guardrails

## Overview

Phase 1 establishes the core infrastructure for guardrail, an AI-native code security and guardrail platform, with a focus on AI Agent Guardrails (Features 9-12).

## Architecture

### Monorepo Structure

```
guardrail/
├── apps/
│   └── api/                    # Fastify API server
├── packages/
│   ├── core/                   # Shared types and utilities
│   ├── ai-guardrails/          # AI guardrails features
│   └── database/               # Prisma schema and client
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── turbo.json
└── package.json
```

### Tech Stack

- **Runtime**: Node.js 20+ with TypeScript 5.3+
- **API Framework**: Fastify 4.x
- **Database**: PostgreSQL 15 with Prisma ORM
- **Cache**: Redis 7
- **Testing**: Vitest
- **Monorepo**: Turborepo

## Features Implemented

### 1. AI Agent Behavior Sandbox (`packages/ai-guardrails/src/sandbox/`)

Comprehensive sandboxing for AI agent actions:

- **Permission Manager**: Register agents and manage filesystem, network, shell, and resource permissions
- **Action Interceptor**: Evaluate and approve/block agent actions before execution
- **Resource Governor**: Track and enforce resource usage limits (memory, CPU, tokens, time)
- **Checkpoint Manager**: Create snapshots and rollback functionality for risky operations
- **Permission Templates**: Pre-configured templates for common agent types (code reviewer, fixer, test generator)

### 2. Prompt Injection Detection (`packages/ai-guardrails/src/injection/`)

Multi-layered defense against prompt injection attacks:

- **Pattern Detection**: 10+ categories of injection patterns (instruction override, role hijacking, jailbreaks, etc.)
- **Lexical Scanning**: Regex-based pattern matching
- **Semantic Analysis**: Concept-level threat detection
- **Encoding Detection**: Identifies obfuscation attempts (base64, hex, etc.)
- **Indirect Injection**: Detects hidden instructions in comments and data sources
- **Secure Input Processor**: Sanitizes and validates all AI inputs

### 3. AI Output Validation Pipeline (`packages/ai-guardrails/src/validation/`)

Six-stage validation for AI-generated code:

1. **Syntax Validation**: Checks for balanced braces, quotes, parentheses
2. **Import Verification**: Validates packages exist in registries (npm, PyPI, crates.io)
3. **Hallucination Detection**: Identifies non-existent packages and APIs
4. **Intent Alignment**: Ensures code matches user request
5. **Quality Gate**: Detects code smells and quality issues
6. **Security Scan**: Identifies security vulnerabilities (eval, XSS, injection risks)

### 4. AI Action Audit Trail (`packages/ai-guardrails/src/audit/`)

Tamper-proof audit logging:

- **Audit Logger**: Blockchain-style hash chain for tamper detection
- **Query Service**: Flexible querying of audit events
- **Reporter**: Generate compliance, security, and attribution reports
- **Export**: CSV and JSON export functionality
- **Chain Verification**: Validate audit trail integrity

## API Endpoints

### Agent Management

- `POST /api/agents` - Register new agent
- `GET /api/agents/:id` - Get agent details
- `PUT /api/agents/:id/permissions` - Update permissions
- `POST /api/agents/:id/suspend` - Suspend agent
- `POST /api/agents/:id/reactivate` - Reactivate agent
- `GET /api/agents/:id/actions` - Query agent actions

### Sandbox

- `POST /api/sandbox/intercept` - Intercept and evaluate action
- `POST /api/sandbox/checkpoint` - Create checkpoint
- `POST /api/sandbox/rollback` - Rollback to checkpoint
- `GET /api/sandbox/checkpoints/:agentId/:taskId` - Get checkpoints

### Injection Detection

- `POST /api/injection/scan` - Scan for prompt injection
- `POST /api/injection/batch` - Batch scan multiple inputs

### Output Validation

- `POST /api/validation/validate` - Validate AI output
- `GET /api/validation/:id` - Get validation result

### Audit Trail

- `GET /api/audit/query` - Query audit trail
- `GET /api/audit/timeline/:taskId` - Get task timeline
- `GET /api/audit/attribution` - Get AI vs human stats
- `POST /api/audit/report` - Generate compliance report
- `GET /api/audit/export/csv` - Export to CSV
- `GET /api/audit/export/json` - Export to JSON

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15
- Redis 7

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up database:

```bash
npm run db:generate
npm run db:push
```

4. Start development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Using Docker

```bash
cd docker
docker-compose up
```

## Database Schema

The Prisma schema includes models for:

- **Agent**: AI agent registration and metadata
- **AgentPermission**: Filesystem, network, shell, and resource permissions
- **AgentAction**: Audit trail of all agent actions
- **AgentCheckpoint**: Snapshots for rollback functionality
- **InjectionScan**: Prompt injection scan results
- **OutputValidation**: Code validation results

## Testing

```bash
npm run test
```

## Building for Production

```bash
npm run build
```

## Environment Variables

See `.env.example` for all required environment variables.

## Next Steps

Phase 2 will implement the Security Layer (Features 13-16):
- Secrets Detection
- Supply Chain Security
- License Compliance
- Attack Surface Analysis

## License

MIT
