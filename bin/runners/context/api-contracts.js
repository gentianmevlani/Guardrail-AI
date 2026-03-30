/**
 * API Contract Extraction Module
 * Extracts OpenAPI and GraphQL schemas for context
 */

const fs = require("fs");
const path = require("path");

/**
 * Find files recursively (local helper)
 */
function findFiles(dir, extensions, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) return [];
  
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findFiles(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

/**
 * Extract OpenAPI/Swagger specifications
 */
function extractOpenAPISpecs(projectPath) {
  const specs = [];
  
  // Look for OpenAPI files
  const openAPIFiles = findFiles(projectPath, [
    ".json", ".yaml", ".yml"
  ]).filter(file => {
    const content = fs.readFileSync(file, "utf-8");
    return content.includes("openapi") || content.includes("swagger");
  });
  
  for (const file of openAPIFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      let spec;
      
      if (file.endsWith(".json")) {
        spec = JSON.parse(content);
      } else {
        // Simple YAML parser for basic specs
        spec = parseSimpleYAML(content);
      }
      
      if (spec && (spec.openapi || spec.swagger)) {
        // Extract key information
        const extracted = {
          file: path.relative(projectPath, file).replace(/\\/g, "/"),
          version: spec.openapi || spec.swagger,
          title: spec.info?.title || "Untitled API",
          description: spec.info?.description || "",
          baseUrl: spec.servers?.[0]?.url || "",
          paths: Object.keys(spec.paths || {}),
          schemas: Object.keys(spec.components?.schemas || {}),
          endpoints: [],
        };
        
        // Extract endpoint details
        for (const [path, methods] of Object.entries(spec.paths || {})) {
          for (const [method, details] of Object.entries(methods)) {
            if (typeof details === "object" && details.operationId) {
              extracted.endpoints.push({
                method: method.toUpperCase(),
                path,
                operationId: details.operationId,
                summary: details.summary || "",
                tags: details.tags || [],
              });
            }
          }
        }
        
        specs.push(extracted);
      }
    } catch {}
  }
  
  return specs;
}

/**
 * Simple YAML parser for basic specs
 */
function parseSimpleYAML(content) {
  const lines = content.split("\n");
  const result = {};
  let currentSection = result;
  const sectionStack = [result];
  let indent = 0;
  
  for (const line of lines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    
    const currentIndent = line.match(/^ */)[0].length;
    const trimmed = line.trim();
    
    if (trimmed.includes(":")) {
      const [key, ...valueParts] = trimmed.split(":");
      const value = valueParts.join(":").trim();
      
      // Adjust section stack based on indentation
      if (currentIndent < indent) {
        sectionStack.pop();
        currentSection = sectionStack[sectionStack.length - 1];
      }
      
      if (value) {
        // Simple value
        currentSection[key.trim()] = value.replace(/['"]/g, "");
      } else {
        // New section
        currentSection[key.trim()] = {};
        sectionStack.push(currentSection[key.trim()]);
        currentSection = currentSection[key.trim()];
      }
      
      indent = currentIndent;
    }
  }
  
  return result;
}

/**
 * Extract GraphQL schemas
 */
function extractGraphQLSchemas(projectPath) {
  const schemas = [];
  
  // Look for GraphQL files
  const graphqlFiles = findFiles(projectPath, [
    ".graphql", ".gql"
  ]);
  
  // Also check for schema definitions in JS/TS files
  const jsFiles = findFiles(projectPath, [
    ".ts", ".tsx", ".js", ".jsx"
  ]).filter(file => {
    const content = fs.readFileSync(file, "utf-8");
    return content.includes("gql`") || content.includes("GraphQLSchema") || content.includes("typeDefs");
  });
  
  // Process .graphql files
  for (const file of graphqlFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const types = extractGraphQLTypes(content);
      
      schemas.push({
        file: path.relative(projectPath, file).replace(/\\/g, "/"),
        type: "schema",
        types,
        queries: types.filter(t => t.type === "Query" || t.name.startsWith("query")),
        mutations: types.filter(t => t.type === "Mutation" || t.name.startsWith("mutation")),
        subscriptions: types.filter(t => t.type === "Subscription" || t.name.startsWith("subscription")),
      });
    } catch {}
  }
  
  // Process JS/TS files with embedded schemas
  for (const file of jsFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const extracted = extractEmbeddedGraphQL(content);
      
      if (extracted.schemas.length > 0) {
        schemas.push({
          file: path.relative(projectPath, file).replace(/\\/g, "/"),
          type: "embedded",
          schemas: extracted.schemas,
          resolvers: extracted.resolvers,
        });
      }
    } catch {}
  }
  
  return schemas;
}

/**
 * Extract types from GraphQL schema
 */
function extractGraphQLTypes(content) {
  const types = [];
  const lines = content.split("\n");
  let currentType = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith("type ") || trimmed.startsWith("interface ") || 
        trimmed.startsWith("input ") || trimmed.startsWith("enum ")) {
      const parts = trimmed.split(/\s+/);
      currentType = {
        type: parts[0],
        name: parts[1],
        fields: [],
      };
      types.push(currentType);
    } else if (currentType && trimmed && !trimmed.startsWith("#")) {
      if (trimmed === "}") {
        currentType = null;
      } else if (trimmed.includes(":")) {
        const [fieldName, fieldType] = trimmed.split(":").map(s => s.trim());
        if (fieldName && fieldType) {
          currentType.fields.push({
            name: fieldName,
            type: fieldType.replace(/[!]/g, ""),
            required: fieldType.includes("!"),
          });
        }
      }
    }
  }
  
  return types;
}

/**
 * Extract embedded GraphQL from JS/TS
 */
function extractEmbeddedGraphQL(content) {
  const schemas = [];
  const resolvers = [];
  
  // Extract template literals
  const gqlMatches = content.match(/gql`([^`]+)`/g) || [];
  
  for (const match of gqlMatches) {
    const schema = match.replace(/gql`([^`]+)`/, "$1");
    const types = extractGraphQLTypes(schema);
    
    schemas.push({
      content: schema,
      types,
    });
  }
  
  // Look for typeDefs assignments
  const typeDefMatches = content.match(/typeDefs\s*[:=]\s*`([^`]+)`/g) || [];
  
  for (const match of typeDefMatches) {
    const schema = match.replace(/typeDefs\s*[:=]\s*`([^`]+)`/, "$1");
    const types = extractGraphQLTypes(schema);
    
    schemas.push({
      content: schema,
      types,
    });
  }
  
  // Look for resolvers
  const resolverMatches = content.match(/resolvers\s*[:=]\s*{([^}]+)}/gs) || [];
  
  for (const match of resolverMatches) {
    resolvers.push({
      content: match,
    });
  }
  
  return { schemas, resolvers };
}

/**
 * Extract API route patterns from Express/Next.js
 */
function extractAPIRoutes(projectPath) {
  const routes = [];
  
  // Look for API route files
  const apiFiles = findFiles(projectPath, [
    ".ts", ".tsx", ".js", ".jsx"
  ]).filter(file => {
    const relativePath = path.relative(projectPath, file).replace(/\\/g, "/");
    return relativePath.includes("/api/") || relativePath.includes("/routes/");
  });
  
  for (const file of apiFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const extracted = extractRouteInfo(content, file);
      
      if (extracted.routes.length > 0) {
        routes.push({
          file: path.relative(projectPath, file).replace(/\\/g, "/"),
          routes: extracted.routes,
          middleware: extracted.middleware,
          validation: extracted.validation,
        });
      }
    } catch {}
  }
  
  return routes;
}

/**
 * Extract route information from file
 */
function extractRouteInfo(content, filePath) {
  const routes = [];
  const middleware = [];
  const validation = [];
  
  // Extract Express routes
  const expressMatches = content.match(/\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g) || [];
  
  for (const match of expressMatches) {
    const parts = match.match(/\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/);
    if (parts) {
      routes.push({
        method: parts[1].toUpperCase(),
        path: parts[2],
        framework: "Express",
      });
    }
  }
  
  // Extract Next.js API routes
  if (filePath.includes("/api/")) {
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
    const routePath = relativePath
      .replace(/\/api\//, "/")
      .replace(/\.(ts|tsx|js|jsx)$/, "");
    
    // Look for HTTP method exports
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    for (const method of methods) {
      if (content.includes(`export async function ${method}`) || 
          content.includes(`export function ${method}`)) {
        routes.push({
          method,
          path: routePath,
          framework: "Next.js",
        });
      }
    }
  }
  
  // Extract middleware usage
  if (content.includes("cors")) middleware.push("cors");
  if (content.includes("helmet")) middleware.push("helmet");
  if (content.includes("auth")) middleware.push("auth");
  if (content.includes("validate") || content.includes("zod")) validation.push("zod");
  if (content.includes("joi")) validation.push("joi");
  
  return { routes, middleware, validation };
}

/**
 * Generate API context summary
 */
function generateAPIContext(projectPath) {
  const openAPI = extractOpenAPISpecs(projectPath);
  const graphql = extractGraphQLSchemas(projectPath);
  const routes = extractAPIRoutes(projectPath);
  
  return {
    summary: {
      hasOpenAPI: openAPI.length > 0,
      openAPICount: openAPI.length,
      hasGraphQL: graphql.length > 0,
      graphqlCount: graphql.length,
      hasCustomRoutes: routes.length > 0,
      routeCount: routes.reduce((sum, r) => sum + r.routes.length, 0),
    },
    openAPI,
    graphql,
    routes,
    recommendations: generateAPIRecommendations(openAPI, graphql, routes),
  };
}

/**
 * Generate API recommendations
 */
function generateAPIRecommendations(openAPI, graphql, routes) {
  const recommendations = [];
  
  if (openAPI.length === 0 && graphql.length === 0 && routes.length > 0) {
    recommendations.push({
      type: "documentation",
      message: "Consider adding OpenAPI/Swagger specification for better API documentation",
    });
  }
  
  if (routes.length > 0) {
    const hasValidation = routes.some(r => r.validation.length > 0);
    if (!hasValidation) {
      recommendations.push({
        type: "validation",
        message: "Add input validation to API routes (zod, joi, etc.)",
      });
    }
  }
  
  const totalEndpoints = openAPI.reduce((sum, s) => sum + s.endpoints.length, 0) +
                       graphql.reduce((sum, s) => sum + (s.queries?.length || 0) + (s.mutations?.length || 0), 0) +
                       routes.reduce((sum, r) => sum + r.routes.length, 0);
  
  if (totalEndpoints > 20) {
    recommendations.push({
      type: "organization",
      message: "Consider organizing APIs into modules or microservices",
    });
  }
  
  return recommendations;
}

module.exports = {
  extractOpenAPISpecs,
  extractGraphQLSchemas,
  extractAPIRoutes,
  generateAPIContext,
};
