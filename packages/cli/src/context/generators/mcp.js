/**
 * MCP Context JSON Generator
 * Generates .guardrail/context.json for MCP servers
 */

/**
 * Generate universal context JSON for MCP
 */
function generateContextJson(analysis, projectPath) {
  const p = analysis.patterns || {};
  const m = analysis.monorepo || {};

  return JSON.stringify({
    version: "3.0.0",
    generatedAt: new Date().toISOString(),
    generator: "guardrail-context",
    
    project: {
      name: analysis.name,
      path: projectPath,
      framework: analysis.framework,
      language: analysis.language,
      architecture: analysis.architecture,
    },

    techStack: {
      nextjs: analysis.hasNextjs,
      react: analysis.hasReact,
      typescript: analysis.hasTypescript,
      prisma: analysis.hasPrisma,
      tailwind: analysis.hasTailwind,
      stateManagement: p.stateManagement,
      validation: p.validation,
      authentication: p.authentication,
      dataFetching: p.dataFetching || [],
      testing: p.testing || [],
      styling: p.styling || [],
    },

    structure: {
      directories: analysis.directories,
      components: analysis.components,
      apiRoutes: analysis.apiRoutes,
      models: analysis.models,
    },

    patterns: {
      hooks: p.hooks || [],
      stateManagement: p.stateManagement,
      validation: p.validation,
      authentication: p.authentication,
      dataFetching: p.dataFetching || [],
      styling: p.styling || [],
      testing: p.testing || [],
      codeExamples: p.codeExamples || {},
    },

    antiPatterns: p.antiPatterns || [],

    types: {
      interfaces: analysis.types?.interfaces || [],
      types: analysis.types?.types || [],
      enums: analysis.types?.enums || [],
    },

    environment: {
      files: analysis.envVars?.files || [],
      variables: analysis.envVars?.variables || [],
    },

    scripts: analysis.scripts || [],

    conventions: {
      naming: analysis.conventions?.naming || {},
      imports: analysis.imports?.importPatterns || [],
    },

    monorepo: m.isMonorepo ? {
      type: m.type,
      tools: m.tools || [],
      workspaces: m.workspaces?.map(w => ({
        name: w.name,
        path: w.path,
        description: w.description,
      })) || [],
      sharedPackages: m.sharedPackages || [],
    } : null,

    stats: {
      totalFiles: analysis.stats?.totalFiles || 0,
      totalLines: analysis.stats?.totalLines || 0,
      byExtension: analysis.stats?.byExtension || {},
      largestFiles: analysis.stats?.largestFiles || [],
    },

    rules: {
      critical: [
        "Never hardcode secrets - use environment variables",
        "No mock data in production code",
        `No 'any' types - use proper TypeScript types`,
        "Follow existing patterns in the codebase",
        "Use existing components before creating new ones",
        "API routes must validate all input",
      ],
      style: [
        `File naming: ${analysis.conventions?.naming?.components || "PascalCase"} for components`,
        "Use path aliases (@/) for imports",
        analysis.hasTailwind ? "Use Tailwind CSS for styling" : null,
        p.stateManagement ? `Use ${p.stateManagement} for state management` : null,
        p.validation ? `Use ${p.validation} for validation` : null,
      ].filter(Boolean),
    },

    mcp: {
      resources: [
        {
          uri: `file://${projectPath}/.guardrail/context.json`,
          name: "Project Context",
          description: "Full project analysis and context",
          mimeType: "application/json",
        },
        {
          uri: `file://${projectPath}/.guardrail/project-map.json`,
          name: "Project Map",
          description: "Complete project structure map",
          mimeType: "application/json",
        },
        {
          uri: `file://${projectPath}/.guardrail/memory.json`,
          name: "AI Memory",
          description: "AI learning memory for this project",
          mimeType: "application/json",
        },
      ],
      tools: [
        {
          name: "guardrail.context",
          description: "Regenerate project context",
        },
        {
          name: "guardrail.analyze",
          description: "Analyze specific file or directory",
        },
      ],
    },
  }, null, 2);
}

module.exports = {
  generateContextJson,
};
