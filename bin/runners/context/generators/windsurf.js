/**
 * Windsurf Rules Generator
 * Generates .windsurf/rules/*.md files for Windsurf Cascade
 */

/**
 * Generate Windsurf rules files
 */
function generateWindsurfRules(analysis) {
  const rules = {};
  const p = analysis.patterns || {};
  const m = analysis.monorepo || {};

  // Project context
  rules["project-context"] = `# Project Context - ${analysis.name}

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

  // Coding standards
  rules["coding-standards"] = `# Coding Standards

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

  // API patterns
  if (analysis.apiRoutes.length > 0 || analysis.hasPrisma) {
    rules["api-patterns"] = `# API & Data Patterns

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

  return rules;
}

module.exports = {
  generateWindsurfRules,
};
