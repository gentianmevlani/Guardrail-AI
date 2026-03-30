# AI AGENT FILE ORGANIZATION RULES

## Overview

These rules ensure AI agents create files in the correct locations. Include this at the START of any prompt to prevent files being dumped in root directory.

---

## MASTER RULES PROMPT

Copy and paste this at the beginning of any prompt:

```
## CRITICAL: FILE ORGANIZATION RULES

Before creating ANY file, you MUST follow these rules:

### RULE 1: NEVER CREATE FILES IN ROOT

❌ NEVER create files in:
- /
- ./
- Root directory
- Project root

✅ ALWAYS create files in:
- /src/ subdirectories
- /docs/ for documentation
- /scripts/ for scripts
- /config/ for configuration
- Appropriate feature directories

### RULE 2: FILE TYPE LOCATIONS

| File Type | Location | Example |
|-----------|----------|---------|
| React components | `/src/components/` or `/src/features/[name]/components/` | `/src/components/ui/Button.tsx` |
| Pages/Routes | `/src/app/` | `/src/app/dashboard/page.tsx` |
| API routes | `/src/app/api/` | `/src/app/api/users/route.ts` |
| Hooks | `/src/hooks/` or `/src/features/[name]/hooks/` | `/src/hooks/useAuth.ts` |
| Utilities | `/src/lib/` or `/src/utils/` | `/src/lib/utils.ts` |
| Types | `/src/types/` or `/src/features/[name]/types/` | `/src/types/user.types.ts` |
| Styles | `/src/styles/` | `/src/styles/globals.css` |
| Constants | `/src/constants/` or `/src/config/` | `/src/constants/routes.ts` |
| Services | `/src/services/` or `/src/features/[name]/services/` | `/src/services/api.ts` |
| Context/Providers | `/src/providers/` or `/src/components/providers/` | `/src/providers/AuthProvider.tsx` |
| Documentation | `/docs/` | `/docs/API.md` |
| Scripts | `/scripts/` | `/scripts/seed.ts` |
| Tests | `/src/__tests__/` or alongside files as `*.test.ts` | `/src/__tests__/Button.test.tsx` |
| Config files | Project root (only these!) | `tailwind.config.ts`, `next.config.js` |

### RULE 3: FEATURE-BASED ORGANIZATION

If a file belongs to a specific feature, put it in that feature's directory:

```
/src/features/[feature-name]/
├── /components    # Feature-specific components
├── /hooks         # Feature-specific hooks
├── /services      # Feature-specific API calls
├── /types         # Feature-specific types
├── /utils         # Feature-specific utilities
└── index.ts       # Public exports
```

### RULE 4: SHARED VS FEATURE-SPECIFIC

- If used by MULTIPLE features → put in `/src/[category]/`
- If used by ONE feature only → put in `/src/features/[name]/[category]/`

### RULE 5: ALWAYS STATE THE FULL PATH

When creating a file, ALWAYS specify the full path:

✅ CORRECT:
"Creating file: `/src/components/ui/Button.tsx`"

❌ WRONG:
"Creating Button.tsx"
"Creating file: Button.tsx"

### RULE 6: DOCUMENTATION LOCATION

| Doc Type | Location |
|----------|----------|
| README | `/README.md` (root - only exception) |
| API docs | `/docs/api/` |
| Setup guides | `/docs/guides/` |
| Architecture | `/docs/architecture/` |
| Component docs | `/docs/components/` |
| Feature docs | `/docs/features/` |

### RULE 7: ASK IF UNSURE

If you're unsure where a file should go, ASK before creating it.

### RULE 8: CREATE DIRECTORIES FIRST

When creating files in new directories:
1. Mention you're creating the directory
2. Then create the file

---

## ALLOWED ROOT FILES (ONLY THESE)

These are the ONLY files allowed in project root:
- `package.json`
- `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`
- `tsconfig.json`
- `tailwind.config.ts` / `tailwind.config.js`
- `next.config.js` / `next.config.mjs`
- `postcss.config.js`
- `.env` / `.env.local` / `.env.example`
- `.gitignore`
- `.eslintrc.js` / `eslint.config.js`
- `.prettierrc`
- `README.md`
- `LICENSE`
- `docker-compose.yml`
- `Dockerfile`

EVERYTHING ELSE goes in a subdirectory!
```

---

## DIRECTORY STRUCTURE REFERENCE

Include this in prompts when you need the agent to understand your project structure:

```
## PROJECT STRUCTURE

This project uses the following structure:

```
/
├── /docs                    # Documentation
│   ├── /api                 # API documentation
│   ├── /guides              # Setup/usage guides
│   └── /architecture        # Architecture docs
│
├── /scripts                 # Build/dev scripts
│   ├── seed.ts
│   └── migrate.ts
│
├── /public                  # Static assets
│   └── /images
│
├── /src
│   ├── /app                 # Next.js App Router
│   │   ├── /api             # API routes
│   │   ├── /(routes)        # Page routes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── /components          # Shared components
│   │   ├── /ui              # Base UI components
│   │   ├── /layout          # Layout components
│   │   ├── /forms           # Form components
│   │   └── /providers       # Context providers
│   │
│   ├── /features            # Feature modules
│   │   └── /[feature-name]
│   │       ├── /components
│   │       ├── /hooks
│   │       ├── /services
│   │       ├── /types
│   │       └── index.ts
│   │
│   ├── /hooks               # Shared hooks
│   │
│   ├── /lib                 # Utilities
│   │   ├── utils.ts
│   │   ├── cn.ts
│   │   └── api.ts
│   │
│   ├── /services            # Shared services
│   │
│   ├── /stores              # Global state
│   │
│   ├── /styles              # Global styles
│   │   ├── globals.css
│   │   └── tokens.css
│   │
│   ├── /types               # Shared types
│   │
│   └── /config              # App configuration
│
├── /prisma                  # Database schema
│   └── schema.prisma
│
└── [config files]           # Root config only
```

When creating files, use this structure. Ask if you're unsure where something goes.
```

---

## QUICK PROMPTS FOR SPECIFIC TASKS

### Creating a New Component

```
Create a new [ComponentName] component.

Location: /src/components/ui/[ComponentName].tsx

Requirements:
- [requirements]

Remember: Create the file in /src/components/ui/, NOT in root.
```

### Creating a New Feature

```
Create a new feature module for [FeatureName].

Location: /src/features/[feature-name]/

Create these files:
- /src/features/[feature-name]/components/[Component].tsx
- /src/features/[feature-name]/hooks/use[Hook].ts
- /src/features/[feature-name]/services/[feature].service.ts
- /src/features/[feature-name]/types/[feature].types.ts
- /src/features/[feature-name]/index.ts

Remember: All files go in /src/features/[feature-name]/, NOT in root.
```

### Creating Documentation

```
Create documentation for [Topic].

Location: /docs/[category]/[topic].md

NOT in root directory.
```

### Creating a New API Route

```
Create an API route for [Resource].

Location: /src/app/api/[resource]/route.ts

If it needs [id], also create:
/src/app/api/[resource]/[id]/route.ts

Remember: API routes go in /src/app/api/, NOT in root.
```

---

## ENFORCEMENT CHECKLIST

Before responding, the AI agent should verify:

- [ ] No files being created in root directory (except allowed config files)
- [ ] Full path specified for every file
- [ ] File type matches its directory
- [ ] Feature-specific files are in feature directory
- [ ] Shared files are in shared directories
- [ ] Documentation is in /docs/
- [ ] Scripts are in /scripts/

---

## EXAMPLE: CORRECT VS INCORRECT

### ❌ INCORRECT (Agent dumping files in root):

```
Creating files:
- UserProfile.tsx
- useUser.ts
- user.types.ts
- API.md
```

### ✅ CORRECT (Proper locations):

```
Creating files:
- /src/features/user/components/UserProfile.tsx
- /src/features/user/hooks/useUser.ts
- /src/features/user/types/user.types.ts
- /docs/api/user-api.md
```

---

## PREPEND TO ALL PROMPTS

Add this single line to the start of every prompt:

```
IMPORTANT: Create all files in appropriate /src/ subdirectories. Never create files in root directory except standard config files. Always specify full file paths.
```
