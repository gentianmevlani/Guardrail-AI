/**
 * Template Applier
 *
 * Applies guardrail templates to projects to fix missing features.
 * Works with VibecoderDetector to automatically add missing components.
 */

import * as fs from "fs";
import * as path from "path";

export interface ApplyResult {
  success: boolean;
  template: string;
  targetPath: string;
  message: string;
  filesCreated: string[];
  filesModified: string[];
}

export interface ApplyOptions {
  overwrite?: boolean;
  dryRun?: boolean;
  interactive?: boolean;
}

type TemplateType =
  | "error-boundary"
  | "loading-state"
  | "empty-state"
  | "404-page"
  | "env-config"
  | "rate-limit"
  | "auth-middleware"
  | "error-handler"
  | "cors-middleware"
  | "validation-middleware";

interface TemplateConfig {
  source: string[];
  target: string;
  category: "component" | "middleware" | "config" | "page";
  description: string;
  dependencies?: string[];
}

const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  "error-boundary": {
    source: ["components/ErrorBoundary.tsx", "components/ErrorBoundary.css"],
    target: "src/components",
    category: "component",
    description: "React Error Boundary with fallback UI",
    dependencies: ["lucide-react"],
  },
  "loading-state": {
    source: ["components/LoadingState.tsx", "components/LoadingState.css"],
    target: "src/components",
    category: "component",
    description: "Accessible loading spinner and skeleton components",
  },
  "empty-state": {
    source: ["components/EmptyState.tsx", "components/EmptyState.css"],
    target: "src/components",
    category: "component",
    description: "Empty state component for when data is not available",
    dependencies: ["lucide-react"],
  },
  "404-page": {
    source: ["pages/NotFound.tsx", "pages/NotFound.css"],
    target: "src/pages",
    category: "page",
    description: "Custom 404 Not Found page",
    dependencies: ["lucide-react"],
  },
  "env-config": {
    source: ["backend/env.example"],
    target: ".",
    category: "config",
    description: "Environment configuration template",
  },
  "rate-limit": {
    source: ["backend/middleware/rate-limit.middleware.ts"],
    target: "src/middleware",
    category: "middleware",
    description: "API rate limiting middleware",
    dependencies: ["express-rate-limit"],
  },
  "auth-middleware": {
    source: ["backend/middleware/auth.middleware.ts"],
    target: "src/middleware",
    category: "middleware",
    description: "JWT authentication middleware",
    dependencies: ["jsonwebtoken"],
  },
  "error-handler": {
    source: ["backend/middleware/error-handler.middleware.ts"],
    target: "src/middleware",
    category: "middleware",
    description: "Global error handling middleware",
  },
  "cors-middleware": {
    source: ["backend/middleware/cors.middleware.ts"],
    target: "src/middleware",
    category: "middleware",
    description: "CORS configuration middleware",
    dependencies: ["cors"],
  },
  "validation-middleware": {
    source: ["backend/middleware/validation.middleware.ts"],
    target: "src/middleware",
    category: "middleware",
    description: "Request validation middleware with Zod",
    dependencies: ["zod"],
  },
};

class TemplateApplier {
  private templatesDir: string;

  constructor() {
    // Templates are in the project root /templates directory
    this.templatesDir = path.join(__dirname, "..", "..", "templates");
  }

  /**
   * Apply a template to a project
   */
  async apply(
    templateType: TemplateType,
    projectPath: string,
    options: ApplyOptions = {},
  ): Promise<ApplyResult> {
    const config = TEMPLATE_CONFIGS[templateType];

    if (!config) {
      return {
        success: false,
        template: templateType,
        targetPath: "",
        message: `Unknown template type: ${templateType}`,
        filesCreated: [],
        filesModified: [],
      };
    }

    const targetDir = path.join(projectPath, config.target);
    const filesCreated: string[] = [];
    const filesModified: string[] = [];

    try {
      // Ensure target directory exists
      if (!options.dryRun) {
        await fs.promises.mkdir(targetDir, { recursive: true });
      }

      // Copy each source file
      for (const sourceFile of config.source) {
        const sourcePath = path.join(this.templatesDir, sourceFile);
        const fileName = path.basename(sourceFile);
        const targetPath = path.join(targetDir, fileName);

        // Check if file exists
        const exists = await this.fileExists(targetPath);

        if (exists && !options.overwrite) {
          filesModified.push(targetPath);
          continue;
        }

        if (!options.dryRun) {
          // Read source template
          const content = await fs.promises.readFile(sourcePath, "utf8");

          // Write to target
          await fs.promises.writeFile(targetPath, content, "utf8");
        }

        filesCreated.push(targetPath);
      }

      return {
        success: true,
        template: templateType,
        targetPath: targetDir,
        message: `Applied ${config.description}`,
        filesCreated,
        filesModified,
      };
    } catch (error) {
      return {
        success: false,
        template: templateType,
        targetPath: targetDir,
        message: `Failed to apply template: ${error instanceof Error ? error.message : "Unknown error"}`,
        filesCreated,
        filesModified,
      };
    }
  }

  /**
   * Apply multiple templates
   */
  async applyMultiple(
    templates: TemplateType[],
    projectPath: string,
    options: ApplyOptions = {},
  ): Promise<ApplyResult[]> {
    const results: ApplyResult[] = [];

    for (const template of templates) {
      const result = await this.apply(template, projectPath, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Get recommended templates based on vibe report
   */
  getRecommendedTemplates(missingFeatures: string[]): TemplateType[] {
    const templates: TemplateType[] = [];
    const featureMap: Record<string, TemplateType> = {
      "Error Boundary": "error-boundary",
      ErrorBoundary: "error-boundary",
      "error-boundary": "error-boundary",
      "Loading States": "loading-state",
      LoadingState: "loading-state",
      "loading-state": "loading-state",
      "Empty States": "empty-state",
      EmptyState: "empty-state",
      "empty-state": "empty-state",
      "404 Page": "404-page",
      NotFound: "404-page",
      "404-page": "404-page",
      "Environment Configuration": "env-config",
      "env-config": "env-config",
      "Rate Limiting": "rate-limit",
      "rate-limit": "rate-limit",
      Authentication: "auth-middleware",
      "auth-middleware": "auth-middleware",
      "Error Handler": "error-handler",
      "error-handler": "error-handler",
      CORS: "cors-middleware",
      "cors-middleware": "cors-middleware",
      Validation: "validation-middleware",
      "validation-middleware": "validation-middleware",
    };

    for (const feature of missingFeatures) {
      const template = featureMap[feature];
      if (template && !templates.includes(template)) {
        templates.push(template);
      }
    }

    return templates;
  }

  /**
   * Get template info
   */
  getTemplateInfo(templateType: TemplateType): TemplateConfig | null {
    return TEMPLATE_CONFIGS[templateType] || null;
  }

  /**
   * List all available templates
   */
  listTemplates(): Array<{ type: TemplateType; config: TemplateConfig }> {
    return Object.entries(TEMPLATE_CONFIGS).map(([type, config]) => ({
      type: type as TemplateType,
      config,
    }));
  }

  /**
   * Check dependencies for templates
   */
  async checkDependencies(
    templates: TemplateType[],
    projectPath: string,
  ): Promise<{ missing: string[]; installed: string[] }> {
    const allDeps = new Set<string>();

    for (const template of templates) {
      const config = TEMPLATE_CONFIGS[template];
      config?.dependencies?.forEach((dep) => allDeps.add(dep));
    }

    const packageJsonPath = path.join(projectPath, "package.json");
    let installedDeps: Record<string, string> = {};

    try {
      const content = await fs.promises.readFile(packageJsonPath, "utf8");
      const packageJson = JSON.parse(content);
      installedDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
    } catch {
      // No package.json
    }

    const missing: string[] = [];
    const installed: string[] = [];

    for (const dep of Array.from(allDeps)) {
      if (dep in installedDeps) {
        installed.push(dep);
      } else {
        missing.push(dep);
      }
    }

    return { missing, installed };
  }

  /**
   * Generate install command for missing dependencies
   */
  generateInstallCommand(dependencies: string[]): string {
    if (dependencies.length === 0) return "";
    return `npm install ${dependencies.join(" ")}`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const templateApplier = new TemplateApplier();
