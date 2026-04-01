/**
 * Windsurf Rules Generator
 * Generates .windsurf/rules/*.md files for Windsurf Cascade
 * Uses frontmatter with trigger: always | glob | manual
 */

/**
 * Generate Windsurf rules files
 */
function generateWindsurfRules(analysis) {
  const rules = {};
  const p = analysis.patterns || {};
  const m = analysis.monorepo || {};

  // Project context - always apply
  rules["project-context"] = `---
trigger: always
description: Project context and tech stack - auto-loaded for every conversation
---

# Project Context - ${analysis.name}

## Overview
- **Framework:** ${analysis.framework || "Unknown"}
- **Language:** ${analysis.language || "JavaScript"}
- **Architecture:** ${analysis.architecture}
${m.isMonorepo ? `- **Monorepo:** ${m.type} with ${m.workspaces?.length || 0} workspaces` : ""}

## Tech Stack
${analysis.hasNextjs ? "- Next.js" : ""}
${analysis.hasReact ? "- React" : ""}
${analysis.hasTypescript ? "- TypeScript" : ""}
${analysis.hasPrisma ? "- Prisma ORM" : ""}
${analysis.hasTailwind ? "- Tailwind CSS" : ""}
${p.stateManagement ? `- ${p.stateManagement}` : ""}
${p.validation ? `- ${p.validation}` : ""}
${p.authentication ? `- ${p.authentication}` : ""}

## Directory Structure
${analysis.directories.map(d => `- \`${d}/\``).join("\n")}

${m.isMonorepo && m.workspaces?.length > 0 ? `## Workspaces
${m.workspaces.slice(0, 10).map(w => `- \`${w.path}\` - ${w.name}`).join("\n")}
` : ""}

## Components (${analysis.components.length})
${analysis.components.slice(0, 25).map(c => `- ${c}`).join("\n") || "None detected"}

${p.hooks?.length > 0 ? `## Custom Hooks (${p.hooks.length})
${p.hooks.slice(0, 15).map(h => `- \`${h}\``).join("\n")}
` : ""}

## API Routes (${analysis.apiRoutes.length})
${analysis.apiRoutes.slice(0, 15).map(r => `- ${r}`).join("\n") || "None detected"}

${analysis.models.length > 0 ? `## Data Models
${analysis.models.map(m => `- ${m}`).join("\n")}
` : ""}

${analysis.envVars?.variables?.length > 0 ? `## Environment Variables
${analysis.envVars.variables.slice(0, 15).map(v => `- \`${v}\``).join("\n")}
` : ""}

---
*Context Enhanced by guardrail AI*
`;

  // Coding standards - always apply
  rules["coding-standards"] = `---
trigger: always
description: Coding standards and conventions - auto-loaded for every conversation
---

# Coding Standards

## File Naming
- Components: ${analysis.conventions.naming.components || "PascalCase"} (e.g., \`Button.tsx\`)
- Utilities: camelCase (e.g., \`formatDate.ts\`)
- Types: \`.types.ts\` or \`.d.ts\` suffix

## Import Order
1. React/Next.js imports
2. Third-party libraries
3. Internal components (\`@/components/\`)
4. Internal utilities (\`@/lib/\`, \`@/utils/\`)
5. Types
6. Styles

## Code Style
${analysis.hasTypescript ? "- TypeScript with strict mode enabled" : "- JavaScript with JSDoc comments"}
- Functional components with hooks
- Path aliases (\`@/\`) for imports
${analysis.hasTailwind ? "- Tailwind CSS for styling" : ""}
${p.stateManagement ? `- ${p.stateManagement} for state management` : ""}
${p.validation ? `- ${p.validation} for validation` : ""}

## Critical Rules

1. **No hardcoded secrets** - Use environment variables
2. **No \`any\` types** - Use proper TypeScript types
3. **No mock data in production** - Real API endpoints only
4. **Validate all inputs** - Never trust client data
5. **Use existing components** - Check before creating new ones
${p.hooks?.length ? `6. **Use existing hooks** - ${p.hooks.slice(0, 3).join(", ")}...` : ""}

${p.antiPatterns?.length > 0 ? `## ⚠️ Avoid These
${p.antiPatterns.map(ap => `- ${ap.message}: ${ap.suggestion}`).join("\n")}
` : ""}

## When Creating New Files
1. Check if similar file exists
2. Place in correct directory
3. Follow naming conventions
4. Add proper types
5. Use existing patterns
`;

  // API patterns - apply when working with API/data files
  if (analysis.apiRoutes.length > 0 || analysis.hasPrisma) {
    rules["api-patterns"] = `---
trigger: glob
description: API and data patterns - loaded when working with API or database files
globs: ["**/api/**", "**/routes/**", "**/db/**", "**/*schema*"]
---

# API & Data Patterns

${analysis.hasPrisma ? `## Database (Prisma)

### Available Models
${analysis.models.map(m => `- ${m}`).join("\n")}

### Usage
\`\`\`typescript
import { prisma } from '@/lib/prisma'

// Query
const users = await prisma.user.findMany()

// Create with validation
const user = await prisma.user.create({
  data: validatedInput
})
\`\`\`

### Rules
- Always import from \`@/lib/prisma\`
- Use transactions for multi-step operations
- Handle errors gracefully
- Never expose raw errors to client
` : ""}

${analysis.apiRoutes.length > 0 ? `## API Routes

### Existing Endpoints
${analysis.apiRoutes.slice(0, 20).map(r => `- \`${r}\``).join("\n")}

### API Response Pattern
\`\`\`typescript
// Success
return Response.json({ data, success: true })

// Error
return Response.json({ error: message }, { status: 400 })
\`\`\`

### Validation
${p.validation ? `Use ${p.validation} for input validation:
\`\`\`typescript
const schema = z.object({ name: z.string() })
const data = schema.parse(await req.json())
\`\`\`` : "Always validate input before processing"}
` : ""}

${p.dataFetching?.length ? `## Data Fetching: ${p.dataFetching.join(", ")}

${p.dataFetching.includes("TanStack Query") ? `### TanStack Query
\`\`\`typescript
const { data, isLoading } = useQuery({
  queryKey: ['resource'],
  queryFn: fetchResource,
})
\`\`\`` : ""}
${p.dataFetching.includes("SWR") ? `### SWR
\`\`\`typescript
const { data, error } = useSWR('/api/resource', fetcher)
\`\`\`` : ""}
` : ""}
`;
  }

  // Anti-hallucination rules for Windsurf - ALWAYS APPLY
  const ah = analysis.antiHallucination || {};
  
  rules["anti-hallucination"] = `---
trigger: always
description: CRITICAL anti-hallucination guardrails - auto-loaded for EVERY conversation to prevent AI mistakes
---

# 🛡️ Anti-Hallucination Guide

> **CRITICAL**: Read before making code changes

## ✅ This Project Uses
| Category | Technology |
|----------|------------|
| Framework | ${analysis.framework || "Unknown"} |
| Language | ${analysis.language || "JavaScript"} |
| State | ${ah.stateManagement || "N/A"} |
| ORM | ${ah.ormType || "N/A"} |
| UI | ${ah.uiLibrary?.name || "Custom"}${ah.uiLibrary?.styling ? ` + ${ah.uiLibrary.styling}` : ""} |
| Icons | ${ah.uiLibrary?.iconLib || "N/A"} |
| Forms | ${ah.uiLibrary?.forms || "N/A"} |
| Toast | ${ah.uiLibrary?.toast || "N/A"} |

## 🚫 FORBIDDEN Patterns
${ah.forbiddenPatterns?.slice(0, 10).map(p => `- ❌ **${p.name}** - ${p.reason}`).join("\n") || "None detected"}

## Database Schema
${ah.databaseSchema?.tables?.length > 0 ? `
**ORM**: ${ah.ormType || "Unknown"}
**Schema File**: \`${ah.databaseSchema.schemaFile}\`

### Tables (${ah.databaseSchema.tables.length})
${ah.databaseSchema.tables.map(t => `- \`${t}\``).join("\n")}

⚠️ **NEVER invent tables or columns not in schema**
` : "No schema detected"}

## API Routes
${ah.apiRouteFiles?.length > 0 ? `
**Total**: ${ah.apiRouteFiles.length} route files

### Route Files
${ah.apiRouteFiles.slice(0, 15).map(r => `- \`${r.basePath}\` → \`${r.file}\``).join("\n")}
${ah.apiRouteFiles.length > 15 ? `\n... and ${ah.apiRouteFiles.length - 15} more` : ""}

⚠️ **NEVER invent endpoints not in these files**
` : "No routes detected"}

## Custom Hooks
${ah.customHooks?.length > 0 ? `
${ah.customHooks.map(h => `- \`${h}\``).join("\n")}

⚠️ **Check existing hooks before creating new ones**
` : "None detected"}

## Common Mistakes to Avoid
1. Inventing database tables → Check \`${ah.databaseSchema?.schemaFile || "schema file"}\`
2. Wrong state management → Use ${ah.stateManagement || "project's solution"}
3. Wrong UI imports → Use ${ah.uiLibrary?.name || "project's UI library"}
4. Inventing API endpoints → Check routes directory
5. Wrong icon library → Use ${ah.uiLibrary?.iconLib || "project's icons"}

---
*Context Enhanced by guardrail AI*
`;

  return rules;
}

module.exports = {
  generateWindsurfRules,
};
