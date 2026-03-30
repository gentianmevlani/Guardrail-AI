/**
 * Design System Enforcer
 *
 * Analyzes CSS/Tailwind for design token compliance.
 * Detects "magic numbers" and style drift from design system.
 */

import * as fs from "fs";
import * as path from "path";

export interface DesignTokenViolation {
  file: string;
  line: number;
  property: string;
  value: string;
  issue: string;
  suggestion: string;
  severity: "error" | "warning" | "info";
}

export interface DesignSystemReport {
  score: number;
  violations: DesignTokenViolation[];
  summary: {
    totalFiles: number;
    filesWithViolations: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
  tokenCoverage: {
    colors: number;
    spacing: number;
    typography: number;
    shadows: number;
  };
}

interface DesignTokens {
  colors: Set<string>;
  spacing: Set<string>;
  fontSizes: Set<string>;
  fontWeights: Set<string>;
  borderRadius: Set<string>;
  shadows: Set<string>;
}

// Standard Tailwind spacing scale
const TAILWIND_SPACING = new Set([
  "0",
  "0.5",
  "1",
  "1.5",
  "2",
  "2.5",
  "3",
  "3.5",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "14",
  "16",
  "20",
  "24",
  "28",
  "32",
  "36",
  "40",
  "44",
  "48",
  "52",
  "56",
  "60",
  "64",
  "72",
  "80",
  "96",
  "px",
  "auto",
  "full",
  "screen",
]);

// Standard Tailwind colors (base names)
const TAILWIND_COLORS = new Set([
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "white",
  "black",
  "transparent",
  "current",
  "inherit",
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "error",
  "info",
]);

// Magic number patterns to detect
const MAGIC_NUMBER_PATTERNS = {
  // Pixel values that aren't standard
  arbitraryPixels: /:\s*(\d+)px(?![;\s]*\/\*\s*@token)/,
  // Hex colors not in variables
  hardcodedHex: /#([0-9a-fA-F]{3,8})(?![;\s]*\/\*\s*@token)/,
  // RGB/RGBA values
  hardcodedRgb: /rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+/,
  // Z-index magic numbers
  arbitraryZIndex: /z-index:\s*(\d+)(?![;\s]*\/\*\s*@token)/,
  // Font sizes in px
  arbitraryFontSize: /font-size:\s*(\d+)px/,
  // Line heights as raw numbers
  arbitraryLineHeight: /line-height:\s*(\d+\.?\d*)(?!rem|em|%|px)/,
};

class DesignSystemEnforcer {
  private projectTokens: DesignTokens = {
    colors: new Set(),
    spacing: new Set(),
    fontSizes: new Set(),
    fontWeights: new Set(),
    borderRadius: new Set(),
    shadows: new Set(),
  };

  /**
   * Analyze project for design system compliance
   */
  async analyze(projectPath: string): Promise<DesignSystemReport> {
    const violations: DesignTokenViolation[] = [];
    let totalFiles = 0;
    const filesWithViolations = new Set<string>();

    // First, try to load project's design tokens
    await this.loadProjectTokens(projectPath);

    // Find all CSS and style files
    const styleFiles = await this.findStyleFiles(projectPath);
    totalFiles = styleFiles.length;

    for (const file of styleFiles) {
      const fileViolations = await this.analyzeFile(file);
      violations.push(...fileViolations);

      if (fileViolations.length > 0) {
        filesWithViolations.add(file);
      }
    }

    // Also check TSX/JSX for inline styles and Tailwind classes
    const componentFiles = await this.findComponentFiles(projectPath);
    totalFiles += componentFiles.length;

    for (const file of componentFiles) {
      const fileViolations = await this.analyzeComponentFile(file);
      violations.push(...fileViolations);

      if (fileViolations.length > 0) {
        filesWithViolations.add(file);
      }
    }

    const errorCount = violations.filter((v) => v.severity === "error").length;
    const warningCount = violations.filter(
      (v) => v.severity === "warning",
    ).length;
    const infoCount = violations.filter((v) => v.severity === "info").length;

    // Calculate score (100 - penalty for violations)
    const score = Math.max(
      0,
      100 - errorCount * 10 - warningCount * 5 - infoCount * 1,
    );

    return {
      score,
      violations,
      summary: {
        totalFiles,
        filesWithViolations: filesWithViolations.size,
        errorCount,
        warningCount,
        infoCount,
      },
      tokenCoverage: this.calculateTokenCoverage(violations, totalFiles),
    };
  }

  /**
   * Load project's custom design tokens from config files
   */
  private async loadProjectTokens(projectPath: string): Promise<void> {
    // Check for tailwind.config.js/ts
    const tailwindConfigs = [
      path.join(projectPath, "tailwind.config.js"),
      path.join(projectPath, "tailwind.config.ts"),
      path.join(projectPath, "tailwind.config.mjs"),
    ];

    for (const configPath of tailwindConfigs) {
      if (await this.fileExists(configPath)) {
        await this.parseTailwindConfig(configPath);
        break;
      }
    }

    // Check for CSS custom properties in global styles
    const globalStyles = [
      path.join(projectPath, "src", "styles", "globals.css"),
      path.join(projectPath, "src", "index.css"),
      path.join(projectPath, "styles", "globals.css"),
      path.join(projectPath, "app", "globals.css"),
    ];

    for (const stylePath of globalStyles) {
      if (await this.fileExists(stylePath)) {
        await this.parseCSSVariables(stylePath);
      }
    }
  }

  /**
   * Parse Tailwind config for custom tokens
   */
  private async parseTailwindConfig(configPath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(configPath, "utf8");

      // Extract color definitions
      const colorMatches = content.match(/colors:\s*\{([^}]+)\}/);
      if (colorMatches) {
        const colorNames = colorMatches[1].match(/['"]?(\w+)['"]?\s*:/g);
        colorNames?.forEach((name) => {
          this.projectTokens.colors.add(name.replace(/['":]/g, "").trim());
        });
      }

      // Extract spacing definitions
      const spacingMatches = content.match(/spacing:\s*\{([^}]+)\}/);
      if (spacingMatches) {
        const spacingNames = spacingMatches[1].match(/['"]?(\w+)['"]?\s*:/g);
        spacingNames?.forEach((name) => {
          this.projectTokens.spacing.add(name.replace(/['":]/g, "").trim());
        });
      }
    } catch (error) {
      // Config parsing failed, use defaults
    }
  }

  /**
   * Parse CSS variables from stylesheet
   */
  private async parseCSSVariables(filePath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, "utf8");

      // Extract CSS custom properties
      const varMatches = content.match(/--[\w-]+/g);
      varMatches?.forEach((varName) => {
        if (
          varName.includes("color") ||
          varName.includes("bg") ||
          varName.includes("text")
        ) {
          this.projectTokens.colors.add(varName);
        } else if (
          varName.includes("space") ||
          varName.includes("gap") ||
          varName.includes("padding") ||
          varName.includes("margin")
        ) {
          this.projectTokens.spacing.add(varName);
        } else if (varName.includes("font-size") || varName.includes("text")) {
          this.projectTokens.fontSizes.add(varName);
        } else if (varName.includes("shadow")) {
          this.projectTokens.shadows.add(varName);
        } else if (varName.includes("radius")) {
          this.projectTokens.borderRadius.add(varName);
        }
      });
    } catch (error) {
      // File read failed
    }
  }

  /**
   * Analyze a CSS file for violations
   */
  private async analyzeFile(filePath: string): Promise<DesignTokenViolation[]> {
    const violations: DesignTokenViolation[] = [];

    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Check for hardcoded hex colors
        const hexMatch = line.match(/#([0-9a-fA-F]{3,8})/);
        if (hexMatch && !line.includes("var(--") && !line.includes("@token")) {
          violations.push({
            file: filePath,
            line: lineNum,
            property: "color",
            value: hexMatch[0],
            issue: "Hardcoded color value",
            suggestion: "Use a CSS variable or Tailwind color class",
            severity: "warning",
          });
        }

        // Check for magic pixel values in common properties
        const pxMatch = line.match(
          /(margin|padding|gap|width|height|top|left|right|bottom):\s*(\d+)px/,
        );
        if (pxMatch) {
          const value = parseInt(pxMatch[2]);
          if (!this.isStandardSpacing(value)) {
            violations.push({
              file: filePath,
              line: lineNum,
              property: pxMatch[1],
              value: `${value}px`,
              issue: `Non-standard spacing value (${value}px)`,
              suggestion: `Use spacing token: ${this.suggestSpacing(value)}`,
              severity: "warning",
            });
          }
        }

        // Check for arbitrary z-index
        const zIndexMatch = line.match(/z-index:\s*(\d+)/);
        if (zIndexMatch) {
          const value = parseInt(zIndexMatch[1]);
          if (![0, 10, 20, 30, 40, 50, 100, 999, 9999].includes(value)) {
            violations.push({
              file: filePath,
              line: lineNum,
              property: "z-index",
              value: zIndexMatch[1],
              issue: "Arbitrary z-index value",
              suggestion:
                "Use standardized z-index scale (0, 10, 20, 30, 40, 50)",
              severity: "info",
            });
          }
        }

        // Check for font-size in px
        const fontSizeMatch = line.match(/font-size:\s*(\d+)px/);
        if (fontSizeMatch) {
          violations.push({
            file: filePath,
            line: lineNum,
            property: "font-size",
            value: `${fontSizeMatch[1]}px`,
            issue: "Font size in pixels (accessibility concern)",
            suggestion: "Use rem units for better accessibility",
            severity: "warning",
          });
        }
      });
    } catch (error) {
      // File read failed
    }

    return violations;
  }

  /**
   * Analyze component file for inline styles and Tailwind issues
   */
  private async analyzeComponentFile(
    filePath: string,
  ): Promise<DesignTokenViolation[]> {
    const violations: DesignTokenViolation[] = [];

    try {
      const content = await fs.promises.readFile(filePath, "utf8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Check for inline style objects with hardcoded values
        const inlineStyleMatch = line.match(/style=\{\{([^}]+)\}\}/);
        if (inlineStyleMatch) {
          const styleContent = inlineStyleMatch[1];

          // Check for hardcoded colors in inline styles
          if (/#[0-9a-fA-F]{3,8}/.test(styleContent)) {
            violations.push({
              file: filePath,
              line: lineNum,
              property: "inline-style",
              value: styleContent.slice(0, 50),
              issue: "Hardcoded color in inline style",
              suggestion: "Use CSS variables or theme colors",
              severity: "warning",
            });
          }

          // Check for pixel values in inline styles
          if (
            /\d+px/.test(styleContent) &&
            !/\d+(rem|em|%)/.test(styleContent)
          ) {
            violations.push({
              file: filePath,
              line: lineNum,
              property: "inline-style",
              value: styleContent.slice(0, 50),
              issue: "Pixel values in inline style",
              suggestion: "Use spacing tokens or rem units",
              severity: "info",
            });
          }
        }

        // Check Tailwind classes for arbitrary values
        const arbitraryMatch = line.match(/\[(\d+)px\]|\[#[0-9a-fA-F]+\]/g);
        if (arbitraryMatch) {
          arbitraryMatch.forEach((match) => {
            violations.push({
              file: filePath,
              line: lineNum,
              property: "tailwind-arbitrary",
              value: match,
              issue: "Arbitrary Tailwind value (magic number)",
              suggestion: "Extend Tailwind config with design token instead",
              severity: "warning",
            });
          });
        }

        // Check for !important usage
        if (/!important/.test(line)) {
          violations.push({
            file: filePath,
            line: lineNum,
            property: "specificity",
            value: "!important",
            issue: "Usage of !important",
            suggestion: "Refactor to avoid specificity wars",
            severity: "info",
          });
        }
      });
    } catch (error) {
      // File read failed
    }

    return violations;
  }

  /**
   * Find all CSS/SCSS files in project
   */
  private async findStyleFiles(dir: string, maxDepth = 6): Promise<string[]> {
    const files: string[] = [];
    await this.walkDir(dir, files, /\.(css|scss|sass|less)$/, maxDepth);
    return files;
  }

  /**
   * Find all component files (TSX/JSX)
   */
  private async findComponentFiles(
    dir: string,
    maxDepth = 6,
  ): Promise<string[]> {
    const files: string[] = [];
    await this.walkDir(dir, files, /\.(tsx|jsx)$/, maxDepth);
    return files;
  }

  private async walkDir(
    dir: string,
    files: string[],
    pattern: RegExp,
    maxDepth: number,
    currentDepth = 0,
  ): Promise<void> {
    if (currentDepth > maxDepth) return;

    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          await this.walkDir(
            fullPath,
            files,
            pattern,
            maxDepth,
            currentDepth + 1,
          );
        } else if (item.isFile() && pattern.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory access error
    }
  }

  private shouldIgnore(name: string): boolean {
    return [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "coverage",
      ".turbo",
      ".cache",
      "out",
    ].includes(name);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private isStandardSpacing(value: number): boolean {
    // Standard spacing values (Tailwind 4px base)
    const standardValues = [
      0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64,
      80, 96, 112, 128,
    ];
    return standardValues.includes(value);
  }

  private suggestSpacing(value: number): string {
    const rem = value / 16;
    const tailwindScale: Record<number, string> = {
      0: "0",
      4: "1",
      8: "2",
      12: "3",
      16: "4",
      20: "5",
      24: "6",
      32: "8",
      40: "10",
      48: "12",
      64: "16",
    };

    // Find closest standard value
    const closest = Object.keys(tailwindScale)
      .map(Number)
      .reduce((prev, curr) =>
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
      );

    return `${rem}rem or spacing-${tailwindScale[closest] || Math.round(rem * 4)}`;
  }

  private calculateTokenCoverage(
    violations: DesignTokenViolation[],
    totalFiles: number,
  ): DesignSystemReport["tokenCoverage"] {
    if (totalFiles === 0) {
      return { colors: 100, spacing: 100, typography: 100, shadows: 100 };
    }

    const colorViolations = violations.filter(
      (v) => v.property === "color" || v.issue.includes("color"),
    ).length;
    const spacingViolations = violations.filter((v) =>
      ["margin", "padding", "gap", "width", "height"].includes(v.property),
    ).length;
    const typographyViolations = violations.filter(
      (v) => v.property === "font-size" || v.property.includes("font"),
    ).length;

    return {
      colors: Math.max(0, 100 - colorViolations * 5),
      spacing: Math.max(0, 100 - spacingViolations * 5),
      typography: Math.max(0, 100 - typographyViolations * 5),
      shadows: 100, // Not checking shadows yet
    };
  }
}

export const designSystemEnforcer = new DesignSystemEnforcer();
