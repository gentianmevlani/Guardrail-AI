/**
 * GitHub Copilot Instructions Generator
 * Generates .github/copilot-instructions.md
 */

/**
 * Generate Copilot instructions
 */
function generateCopilotInstructions(analysis) {
  const p = analysis.patterns || {};
  const m = analysis.monorepo || {};

  return `# GitHub Copilot Instructions - ${analysis.name}

## Project Overview

This is a **${analysis.framework || "JavaScript"}** project using **${analysis.language || "JavaScript"}**.
Architecture: ${analysis.architecture}
${m.isMonorepo ? `Monorepo: ${m.type} with ${m.workspaces?.length || 0} workspaces` : ""}

## Tech Stack

${analysis.hasNextjs ? "- Next.js (App Router)" : ""}
${analysis.hasReact ? "- React" : ""}
${analysis.hasTypescript ? "- TypeScript (strict mode)" : ""}
${analysis.hasPrisma ? "- Prisma ORM" : ""}
${analysis.hasTailwind ? "- Tailwind CSS" : ""}
${p.stateManagement ? `- State Management: ${p.stateManagement}` : ""}
${p.validation ? `- Validation: ${p.validation}` : ""}
${p.authentication ? `- Authentication: ${p.authentication}` : ""}
${p.dataFetching?.length ? `- Data Fetching: ${p.dataFetching.join(", ")}` : ""}
${p.testing?.length ? `- Testing: ${p.testing.join(", ")}` : ""}

## Project Structure

\`\`\`
${analysis.directories.map(d => `${d}/`).join("\n")}
\`\`\`

${m.isMonorepo && m.workspaces?.length > 0 ? `## Workspaces

${m.workspaces.slice(0, 8).map(w => `- \`${w.path}\` - ${w.name}`).join("\n")}
` : ""}

## Existing Components

When generating UI code, prefer using these existing components:
${analysis.components.slice(0, 25).map(c => `- ${c}`).join("\n") || "None detected"}

${p.hooks?.length > 0 ? `## Custom Hooks

Use these existing hooks instead of creating new ones:
${p.hooks.slice(0, 15).map(h => `- \`${h}\``).join("\n")}
` : ""}

## API Routes

${analysis.apiRoutes.slice(0, 15).map(r => `- ${r}`).join("\n") || "None detected"}

${analysis.models.length > 0 ? `## Data Models (Prisma)

${analysis.models.map(m => `- ${m}`).join("\n")}
` : ""}

${analysis.envVars?.variables?.length > 0 ? `## Environment Variables

Required variables:
${analysis.envVars.variables.slice(0, 15).map(v => `- \`${v}\``).join("\n")}
` : ""}

## Code Conventions

### File Naming
- Components: ${analysis.conventions.naming.components || "PascalCase"} (e.g., \`Button.tsx\`)
- Utilities: camelCase (e.g., \`formatDate.ts\`)
- Types: PascalCase with \`.types.ts\` suffix

### Import Aliases
- Use \`@/\` for src imports (e.g., \`@/components/Button\`)
- Never use deep relative imports like \`../../../\`

### TypeScript
${analysis.hasTypescript ? `- Enable strict mode
- No \`any\` types - use \`unknown\` or proper types
- Define interfaces for all props and API responses` : "- Use JSDoc comments for type hints"}

## Critical Rules

1. **Security**: Never hardcode API keys, secrets, or credentials
2. **Types**: ${analysis.hasTypescript ? "No `any` types allowed" : "Use JSDoc for type hints"}
3. **Components**: Check existing components before creating new ones
4. **Hooks**: Use existing custom hooks when available
5. **Validation**: ${p.validation ? `Always validate input with ${p.validation}` : "Always validate user input"}
6. **Styling**: ${analysis.hasTailwind ? "Use Tailwind CSS classes" : "Follow existing styling patterns"}
7. **State**: ${p.stateManagement ? `Use ${p.stateManagement} for global state` : "Keep state minimal and local"}

${p.antiPatterns?.length > 0 ? `## Anti-Patterns to Avoid

${p.antiPatterns.map(ap => `- ❌ ${ap.message} → ${ap.suggestion}`).join("\n")}
` : ""}

## When Writing Code

1. Follow existing patterns in the codebase
2. Use TypeScript strict types
3. Add proper error handling
4. Use existing utilities and helpers
5. Keep functions small and focused
6. Write self-documenting code

---

*Context Enhanced by guardrail AI*
`;
}

module.exports = {
  generateCopilotInstructions,
};
