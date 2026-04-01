/**
 * Claude Desktop Config Generator
 * Generates .claude/mcp-config.json and .claude/project-context.md
 */

/**
 * Generate Claude Desktop MCP config and instructions
 */
function generateClaudeConfig(analysis, projectPath) {
  const p = analysis.patterns || {};
  const m = analysis.monorepo || {};

  const config = {
    mcpServers: {
      guardrail: {
        command: "npx",
        args: ["-y", "@guardrail/mcp-server"],
        env: {
          GUARDRAIL_PROJECT_PATH: projectPath,
        },
      },
    },
  };

  const instructions = `# Claude Desktop - Project Context

## Project: ${analysis.name}

### Quick Reference

| Property | Value |
|----------|-------|
| Framework | ${analysis.framework || "Unknown"} |
| Language | ${analysis.language || "JavaScript"} |
| Architecture | ${analysis.architecture} |
${m.isMonorepo ? `| Monorepo | ${m.type} (${m.workspaces?.length || 0} workspaces) |` : ""}

### Tech Stack

${analysis.hasNextjs ? "- **Next.js** - React framework" : ""}
${analysis.hasReact ? "- **React** - UI library" : ""}
${analysis.hasTypescript ? "- **TypeScript** - Type safety" : ""}
${analysis.hasPrisma ? "- **Prisma** - Database ORM" : ""}
${analysis.hasTailwind ? "- **Tailwind CSS** - Styling" : ""}
${p.stateManagement ? `- **${p.stateManagement}** - State management` : ""}
${p.validation ? `- **${p.validation}** - Validation` : ""}
${p.authentication ? `- **${p.authentication}** - Authentication` : ""}

### Key Directories

${analysis.directories.map(d => `- \`${d}/\``).join("\n")}

${m.isMonorepo && m.workspaces?.length > 0 ? `### Workspaces

${m.workspaces.slice(0, 10).map(w => `- \`${w.path}\` → ${w.name}`).join("\n")}
` : ""}

### Available Commands

${analysis.scripts?.slice(0, 10).map(s => `- \`npm run ${s.name}\``).join("\n") || "See package.json"}

### Data Models

${analysis.models?.slice(0, 15).map(m => `- ${m}`).join("\n") || "None detected"}

### Custom Hooks

${p.hooks?.slice(0, 10).map(h => `- \`${h}\``).join("\n") || "None detected"}

### Components

${analysis.components?.slice(0, 20).map(c => `- ${c}`).join("\n") || "None detected"}

### Environment Variables

${analysis.envVars?.variables?.slice(0, 15).map(v => `- \`${v}\``).join("\n") || "Check .env.example"}

### API Routes

${analysis.apiRoutes?.slice(0, 15).map(r => `- ${r}`).join("\n") || "None detected"}

### Rules for AI

1. **Follow existing patterns** - Match the codebase style
2. **Use TypeScript strictly** - No \`any\` types
3. **Use existing components** - Check list above first
4. **Use existing hooks** - Don't recreate what exists
5. **Validate inputs** - Use ${p.validation || "zod"} for validation
6. **No hardcoded secrets** - Use environment variables
7. **No mock data** - Use real API endpoints

${p.antiPatterns?.length > 0 ? `### ⚠️ Avoid These Patterns

${p.antiPatterns.map(ap => `- ${ap.message}`).join("\n")}
` : ""}

---

*Context Enhanced by guardrail AI*
`;

  return { config, instructions };
}

module.exports = {
  generateClaudeConfig,
};
