# Manual CLI Command Testing

Run each command manually to verify functionality:

## Basic Commands
```bash
cd packages/cli
node dist/index.js --version
node dist/index.js --help
```

## Auth Commands
```bash
node dist/index.js auth --status
node dist/index.js auth --help
```

## Scan Commands
```bash
node dist/index.js scan --help
node dist/index.js scan:secrets --help
node dist/index.js scan:vulnerabilities --help
node dist/index.js scan:compliance --help
```

## SBOM Commands
```bash
node dist/index.js sbom:generate --help
```

## Fix Commands
```bash
node dist/index.js fix --help
node dist/index.js fix-rollback --help
```

## Ship Commands
```bash
node dist/index.js ship --help
node dist/index.js ship:pro --help
```

## Reality Commands
```bash
node dist/index.js reality --help
node dist/index.js reality:graph --help
```

## Autopilot Commands
```bash
node dist/index.js autopilot --help
```

## Autopatch Commands
```bash
node dist/index.js autopatch:verify --help
node dist/index.js autopatch:merge --help
```

## Receipt Commands
```bash
node dist/index.js receipt:verify --help
```

## Init Commands
```bash
node dist/index.js init --help
```

## Cache Commands
```bash
node dist/index.js cache:clear --help
node dist/index.js cache:status --help
```

## Menu Command
```bash
node dist/index.js menu --help
```

## Smells Command
```bash
node dist/index.js smells --help
```
