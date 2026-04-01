/**
 * Multi-Language Security Analysis
 *
 * Provides security analysis for multiple programming languages
 */

export * from "./python-analyzer";
export * from "./java-analyzer";

export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "go"
  | "rust";

export interface LanguageDetectionResult {
  primaryLanguage: SupportedLanguage;
  languages: { language: SupportedLanguage; percentage: number }[];
  buildTools: string[];
}

/**
 * Detect project languages
 */
export function detectProjectLanguages(
  projectPath: string,
): LanguageDetectionResult {
  const { existsSync } = require("fs");
  const { join } = require("path");

  const languages: { language: SupportedLanguage; percentage: number }[] = [];
  const buildTools: string[] = [];

  // Check for JavaScript/TypeScript
  if (existsSync(join(projectPath, "package.json"))) {
    if (existsSync(join(projectPath, "tsconfig.json"))) {
      languages.push({ language: "typescript", percentage: 0 });
      buildTools.push("npm/yarn/pnpm");
    } else {
      languages.push({ language: "javascript", percentage: 0 });
      buildTools.push("npm/yarn/pnpm");
    }
  }

  // Check for Python
  if (
    existsSync(join(projectPath, "requirements.txt")) ||
    existsSync(join(projectPath, "pyproject.toml")) ||
    existsSync(join(projectPath, "Pipfile"))
  ) {
    languages.push({ language: "python", percentage: 0 });
    buildTools.push("pip/poetry/pipenv");
  }

  // Check for Java
  if (existsSync(join(projectPath, "pom.xml"))) {
    languages.push({ language: "java", percentage: 0 });
    buildTools.push("maven");
  }
  if (
    existsSync(join(projectPath, "build.gradle")) ||
    existsSync(join(projectPath, "build.gradle.kts"))
  ) {
    languages.push({ language: "java", percentage: 0 });
    buildTools.push("gradle");
  }

  // Check for Go
  if (existsSync(join(projectPath, "go.mod"))) {
    languages.push({ language: "go", percentage: 0 });
    buildTools.push("go");
  }

  // Check for Rust
  if (existsSync(join(projectPath, "Cargo.toml"))) {
    languages.push({ language: "rust", percentage: 0 });
    buildTools.push("cargo");
  }

  // Determine primary language (first detected)
  const primaryLanguage =
    languages.length > 0 && languages[0] ? languages[0].language : "javascript";

  return {
    primaryLanguage,
    languages,
    buildTools: [...new Set(buildTools)],
  };
}
