/**
 * Java Language Analyzer
 *
 * Security analysis for Java projects including:
 * - Maven pom.xml / Gradle build.gradle parsing
 * - Import analysis for detecting dangerous classes
 * - Secret detection patterns specific to Java
 * - Common vulnerability patterns (SQL injection, XXE, deserialization, etc.)
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

export interface JavaDependency {
  groupId: string;
  artifactId: string;
  version: string;
  scope?: string;
  source: "maven" | "gradle";
}

export interface JavaSecurityIssue {
  type: "vulnerability" | "secret" | "dangerous_import" | "code_pattern";
  severity: "low" | "medium" | "high" | "critical";
  file: string;
  line?: number;
  message: string;
  recommendation: string;
  cwe?: string;
}

export interface JavaAnalysisResult {
  projectPath: string;
  javaVersion?: string;
  buildTool: "maven" | "gradle" | "unknown";
  dependencies: JavaDependency[];
  securityIssues: JavaSecurityIssue[];
  summary: {
    totalDependencies: number;
    issuesBySeverity: Record<string, number>;
  };
}

// Dangerous Java imports
const DANGEROUS_IMPORTS = [
  {
    pkg: "java.io.ObjectInputStream",
    reason: "Unsafe deserialization",
    severity: "critical" as const,
    cwe: "CWE-502",
  },
  {
    pkg: "java.lang.Runtime",
    reason: "Command execution",
    severity: "high" as const,
    cwe: "CWE-78",
  },
  {
    pkg: "java.lang.ProcessBuilder",
    reason: "Command execution",
    severity: "high" as const,
    cwe: "CWE-78",
  },
  {
    pkg: "javax.xml.parsers",
    reason: "Potential XXE vulnerability",
    severity: "medium" as const,
    cwe: "CWE-611",
  },
  {
    pkg: "org.xml.sax",
    reason: "Potential XXE vulnerability",
    severity: "medium" as const,
    cwe: "CWE-611",
  },
  {
    pkg: "java.security.MessageDigest",
    reason: "Verify secure algorithm usage",
    severity: "low" as const,
    cwe: "CWE-327",
  },
];

// Java-specific secret patterns
const JAVA_SECRET_PATTERNS = [
  { pattern: /(?:apiKey|API_KEY)\s*=\s*"[^"]{10,}"/g, type: "API Key" },
  {
    pattern: /(?:password|PASSWORD|passwd)\s*=\s*"[^"]{6,}"/g,
    type: "Password",
  },
  { pattern: /(?:secret|SECRET|secretKey)\s*=\s*"[^"]{10,}"/g, type: "Secret" },
  { pattern: /(?:token|TOKEN|accessToken)\s*=\s*"[^"]{10,}"/g, type: "Token" },
  {
    pattern: /(?:jdbc|JDBC):[^"]+password=[^"]+/g,
    type: "JDBC Connection String",
  },
  { pattern: /aws\.accessKeyId\s*=\s*"[^"]+"/g, type: "AWS Access Key" },
  { pattern: /aws\.secretKey\s*=\s*"[^"]+"/g, type: "AWS Secret Key" },
];

// Vulnerability code patterns
const VULNERABILITY_PATTERNS = [
  {
    pattern: /Statement\s+\w+\s*=.*createStatement\(\)/g,
    type: "SQL Injection",
    message: "Using Statement instead of PreparedStatement",
    severity: "critical" as const,
    cwe: "CWE-89",
  },
  {
    pattern: /executeQuery\s*\(\s*"[^"]*"\s*\+/g,
    type: "SQL Injection",
    message: "String concatenation in SQL query",
    severity: "critical" as const,
    cwe: "CWE-89",
  },
  {
    pattern: /Runtime\.getRuntime\(\)\.exec\s*\(/g,
    type: "Command Injection",
    message: "Runtime.exec() can be vulnerable to command injection",
    severity: "high" as const,
    cwe: "CWE-78",
  },
  {
    pattern: /new\s+ObjectInputStream\s*\(/g,
    type: "Unsafe Deserialization",
    message: "ObjectInputStream can deserialize malicious objects",
    severity: "critical" as const,
    cwe: "CWE-502",
  },
  {
    pattern: /DocumentBuilderFactory\.newInstance\(\)/g,
    type: "XXE Vulnerability",
    message: "XML parser may be vulnerable to XXE - disable external entities",
    severity: "high" as const,
    cwe: "CWE-611",
  },
  {
    pattern: /SAXParserFactory\.newInstance\(\)/g,
    type: "XXE Vulnerability",
    message: "SAX parser may be vulnerable to XXE - disable external entities",
    severity: "high" as const,
    cwe: "CWE-611",
  },
  {
    pattern: /MessageDigest\.getInstance\s*\(\s*"MD5"\s*\)/g,
    type: "Weak Cryptography",
    message: "MD5 is cryptographically broken",
    severity: "medium" as const,
    cwe: "CWE-327",
  },
  {
    pattern: /MessageDigest\.getInstance\s*\(\s*"SHA-?1"\s*\)/g,
    type: "Weak Cryptography",
    message: "SHA-1 is deprecated for security use",
    severity: "medium" as const,
    cwe: "CWE-327",
  },
  {
    pattern: /new\s+Random\s*\(\)/g,
    type: "Weak Random",
    message: "java.util.Random is not cryptographically secure",
    severity: "medium" as const,
    cwe: "CWE-330",
  },
  {
    pattern: /setAllowFileAccess\s*\(\s*true\s*\)/g,
    type: "WebView File Access",
    message: "WebView file access enabled",
    severity: "high" as const,
    cwe: "CWE-200",
  },
  {
    pattern: /TrustManager\s*\[\s*\]\s*\{[^}]*checkServerTrusted[^}]*\{\s*\}/g,
    type: "SSL/TLS Bypass",
    message: "Empty TrustManager bypasses SSL verification",
    severity: "critical" as const,
    cwe: "CWE-295",
  },
];

export class JavaAnalyzer {
  /**
   * Analyze a Java project
   */
  async analyze(projectPath: string): Promise<JavaAnalysisResult> {
    const buildTool = this.detectBuildTool(projectPath);
    const dependencies = await this.extractDependencies(projectPath, buildTool);
    const securityIssues: JavaSecurityIssue[] = [];

    // Scan Java files for security issues
    const javaFiles = this.findJavaFiles(projectPath);
    for (const file of javaFiles) {
      const issues = this.scanFile(file);
      securityIssues.push(...issues);
    }

    // Get Java version if available
    const javaVersion = this.detectJavaVersion(projectPath);

    // Calculate summary
    const issuesBySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const issue of securityIssues) {
      const severity = issue.severity;
      if (issuesBySeverity[severity] !== undefined) {
        issuesBySeverity[severity]++;
      }
    }

    return {
      projectPath,
      javaVersion,
      buildTool,
      dependencies,
      securityIssues,
      summary: {
        totalDependencies: dependencies.length,
        issuesBySeverity,
      },
    };
  }

  /**
   * Detect build tool
   */
  private detectBuildTool(projectPath: string): "maven" | "gradle" | "unknown" {
    if (existsSync(join(projectPath, "pom.xml"))) {
      return "maven";
    }
    if (
      existsSync(join(projectPath, "build.gradle")) ||
      existsSync(join(projectPath, "build.gradle.kts"))
    ) {
      return "gradle";
    }
    return "unknown";
  }

  /**
   * Extract dependencies
   */
  private async extractDependencies(
    projectPath: string,
    buildTool: string,
  ): Promise<JavaDependency[]> {
    if (buildTool === "maven") {
      return this.parseMavenPom(projectPath);
    }
    if (buildTool === "gradle") {
      return this.parseGradleBuild(projectPath);
    }
    return [];
  }

  /**
   * Parse Maven pom.xml
   */
  private parseMavenPom(projectPath: string): JavaDependency[] {
    const dependencies: JavaDependency[] = [];
    const pomPath = join(projectPath, "pom.xml");

    if (!existsSync(pomPath)) {
      return dependencies;
    }

    try {
      const content = readFileSync(pomPath, "utf-8");

      // Simple regex parsing for dependencies
      const depRegex =
        /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>\s*(?:<version>([^<]+)<\/version>)?/g;

      let match;
      while ((match = depRegex.exec(content)) !== null) {
        dependencies.push({
          groupId: match[1] || "",
          artifactId: match[2] || "",
          version: match[3] || "managed",
          source: "maven",
        });
      }
    } catch {
      // Skip if can't parse
    }

    return dependencies;
  }

  /**
   * Parse Gradle build file
   */
  private parseGradleBuild(projectPath: string): JavaDependency[] {
    const dependencies: JavaDependency[] = [];
    const gradlePath = join(projectPath, "build.gradle");
    const gradleKtsPath = join(projectPath, "build.gradle.kts");

    const buildFile = existsSync(gradlePath)
      ? gradlePath
      : existsSync(gradleKtsPath)
        ? gradleKtsPath
        : null;

    if (!buildFile) {
      return dependencies;
    }

    try {
      const content = readFileSync(buildFile, "utf-8");

      // Match implementation 'group:artifact:version' or implementation("group:artifact:version")
      const depRegex =
        /(?:implementation|compile|api|testImplementation)\s*[("']([^:]+):([^:]+):([^)"']+)/g;

      let match;
      while ((match = depRegex.exec(content)) !== null) {
        dependencies.push({
          groupId: match[1] || "",
          artifactId: match[2] || "",
          version: match[3] || "latest",
          source: "gradle",
        });
      }
    } catch {
      // Skip if can't parse
    }

    return dependencies;
  }

  /**
   * Find all Java files
   */
  private findJavaFiles(projectPath: string): string[] {
    const files: string[] = [];

    const walkDir = (dir: string) => {
      try {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);

          // Skip common non-source directories
          if (
            [
              "node_modules",
              ".git",
              "target",
              "build",
              ".gradle",
              ".idea",
            ].includes(entry)
          ) {
            continue;
          }

          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              walkDir(fullPath);
            } else if (entry.endsWith(".java")) {
              files.push(fullPath);
            }
          } catch {
            // Skip files we can't access
          }
        }
      } catch {
        // Skip directories we can't access
      }
    };

    walkDir(projectPath);
    return files;
  }

  /**
   * Scan a Java file for security issues
   */
  private scanFile(filePath: string): JavaSecurityIssue[] {
    const issues: JavaSecurityIssue[] = [];

    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      // Check for dangerous imports
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        for (const dangerous of DANGEROUS_IMPORTS) {
          if (
            line.includes(`import ${dangerous.pkg}`) ||
            line.includes(dangerous.pkg)
          ) {
            issues.push({
              type: "dangerous_import",
              severity: dangerous.severity,
              file: filePath,
              line: i + 1,
              message: `Dangerous import: ${dangerous.pkg} - ${dangerous.reason}`,
              recommendation: `Review usage of ${dangerous.pkg}`,
              cwe: dangerous.cwe,
            });
          }
        }
      }

      // Check for secrets
      for (const secretPattern of JAVA_SECRET_PATTERNS) {
        const matches = content.matchAll(secretPattern.pattern);
        for (const match of matches) {
          const lineNum = content.substring(0, match.index).split("\n").length;
          issues.push({
            type: "secret",
            severity: "critical",
            file: filePath,
            line: lineNum,
            message: `Potential ${secretPattern.type} detected`,
            recommendation:
              "Move secrets to environment variables or secure vault",
          });
        }
      }

      // Check for vulnerability patterns
      for (const vulnPattern of VULNERABILITY_PATTERNS) {
        const matches = content.matchAll(vulnPattern.pattern);
        for (const match of matches) {
          const lineNum = content.substring(0, match.index).split("\n").length;
          issues.push({
            type: "code_pattern",
            severity: vulnPattern.severity,
            file: filePath,
            line: lineNum,
            message: `${vulnPattern.type}: ${vulnPattern.message}`,
            recommendation: `Fix the ${vulnPattern.type.toLowerCase()} vulnerability`,
            cwe: vulnPattern.cwe,
          });
        }
      }
    } catch {
      // Skip files we can't read
    }

    return issues;
  }

  /**
   * Detect Java version
   */
  private detectJavaVersion(projectPath: string): string | undefined {
    // Check pom.xml for java version
    const pomPath = join(projectPath, "pom.xml");
    if (existsSync(pomPath)) {
      try {
        const content = readFileSync(pomPath, "utf-8");
        const match = content.match(/<java\.version>([^<]+)<\/java\.version>/);
        if (match && match[1]) {
          return match[1];
        }
        const sourceMatch = content.match(
          /<maven\.compiler\.source>([^<]+)<\/maven\.compiler\.source>/,
        );
        if (sourceMatch && sourceMatch[1]) {
          return sourceMatch[1];
        }
      } catch {
        // Skip
      }
    }

    // Check .java-version file
    const javaVersionPath = join(projectPath, ".java-version");
    if (existsSync(javaVersionPath)) {
      return readFileSync(javaVersionPath, "utf-8").trim();
    }

    return undefined;
  }
}

// Export singleton
export const javaAnalyzer = new JavaAnalyzer();
