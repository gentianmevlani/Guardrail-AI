/**
 * AST Parsing Service for Design System Builder
 * 
 * Provides AST-based code analysis for:
 * - Component extraction from React/Vue/Angular codebases
 * - Design token generation
 * - Pattern detection and classification
 * - Style property extraction
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface ComponentInfo {
  name: string;
  file: string;
  type: 'function' | 'class' | 'arrow';
  props: PropInfo[];
  styles: StyleInfo[];
  dependencies: string[];
  lineCount: number;
  hasDefaultExport: boolean;
  description?: string;
}

interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

interface StyleInfo {
  property: string;
  value: string;
  source: 'inline' | 'className' | 'styled' | 'css-module';
  line: number;
}

interface DesignToken {
  name: string;
  category: 'color' | 'spacing' | 'typography' | 'border' | 'shadow' | 'breakpoint' | 'animation';
  value: string;
  usageCount: number;
  files: string[];
}

interface ColorToken extends DesignToken {
  category: 'color';
  hex: string;
  rgb?: { r: number; g: number; b: number };
  usage: 'background' | 'text' | 'border' | 'accent';
}

interface SpacingToken extends DesignToken {
  category: 'spacing';
  pixels: number;
}

interface TypographyToken extends DesignToken {
  category: 'typography';
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
}

interface DesignSystemAnalysis {
  components: ComponentInfo[];
  tokens: {
    colors: ColorToken[];
    spacing: SpacingToken[];
    typography: TypographyToken[];
    borders: DesignToken[];
    shadows: DesignToken[];
    breakpoints: DesignToken[];
    animations: DesignToken[];
  };
  patterns: {
    name: string;
    description: string;
    occurrences: number;
    files: string[];
    example: string;
  }[];
  statistics: {
    totalComponents: number;
    totalTokens: number;
    uniqueColors: number;
    uniqueSpacing: number;
    consistencyScore: number;
  };
  analyzedAt: string;
}

// Common color patterns
const COLOR_PATTERNS = [
  /#[0-9a-fA-F]{3,8}\b/g,
  /rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+)?\s*\)/g,
  /hsla?\s*\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(?:,\s*[\d.]+)?\s*\)/g,
];

// Spacing patterns (tailwind-like and custom)
const SPACING_VALUES = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 128];

class ASTParsingService {
  private program: ts.Program | null = null;
  private checker: ts.TypeChecker | null = null;

  /**
   * Parse a TypeScript/JavaScript file and return AST
   */
  parseFile(filePath: string): ts.SourceFile | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') || filePath.endsWith('.jsx') 
          ? ts.ScriptKind.TSX 
          : ts.ScriptKind.TS
      );
    } catch (error) {
      console.error(`Failed to parse ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse content string and return AST
   */
  parseContent(content: string, filename: string = 'temp.tsx'): ts.SourceFile {
    return ts.createSourceFile(
      filename,
      content,
      ts.ScriptTarget.Latest,
      true,
      filename.endsWith('.tsx') || filename.endsWith('.jsx')
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS
    );
  }

  /**
   * Extract React components from a file
   */
  extractComponents(sourceFile: ts.SourceFile): ComponentInfo[] {
    const components: ComponentInfo[] = [];
    const fileName = sourceFile.fileName;

    const visit = (node: ts.Node) => {
      // Function component
      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = node.name.getText();
        if (this.isReactComponent(name, node)) {
          components.push(this.extractFunctionComponent(node, fileName));
        }
      }

      // Arrow function component (const Component = () => {})
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.initializer) {
            const name = decl.name.getText();
            if (ts.isArrowFunction(decl.initializer) && this.isReactComponent(name, decl.initializer)) {
              components.push(this.extractArrowComponent(decl, fileName));
            }
          }
        }
      }

      // Class component
      if (ts.isClassDeclaration(node) && node.name) {
        if (this.isClassComponent(node)) {
          components.push(this.extractClassComponent(node, fileName));
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return components;
  }

  /**
   * Check if function/arrow is a React component (capitalized, returns JSX)
   */
  private isReactComponent(name: string, node: ts.Node): boolean {
    // Components start with uppercase
    if (!/^[A-Z]/.test(name)) return false;

    // Check if it contains JSX
    let hasJSX = false;
    const checkJSX = (n: ts.Node) => {
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
        hasJSX = true;
        return;
      }
      ts.forEachChild(n, checkJSX);
    };
    checkJSX(node);

    return hasJSX;
  }

  /**
   * Check if class extends React.Component
   */
  private isClassComponent(node: ts.ClassDeclaration): boolean {
    if (!node.heritageClauses) return false;
    
    for (const clause of node.heritageClauses) {
      for (const type of clause.types) {
        const text = type.getText();
        if (text.includes('Component') || text.includes('PureComponent')) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Extract function component info
   */
  private extractFunctionComponent(node: ts.FunctionDeclaration, fileName: string): ComponentInfo {
    const name = node.name?.getText() || 'Anonymous';
    const props = this.extractPropsFromParameters(node.parameters);
    const styles = this.extractStyles(node);
    const dependencies = this.extractDependencies(node);

    return {
      name,
      file: fileName,
      type: 'function',
      props,
      styles,
      dependencies,
      lineCount: this.getLineCount(node),
      hasDefaultExport: this.checkDefaultExport(node),
    };
  }

  /**
   * Extract arrow component info
   */
  private extractArrowComponent(decl: ts.VariableDeclaration, fileName: string): ComponentInfo {
    const name = (decl.name as ts.Identifier).getText();
    const arrow = decl.initializer as ts.ArrowFunction;
    const props = this.extractPropsFromParameters(arrow.parameters);
    const styles = this.extractStyles(arrow);
    const dependencies = this.extractDependencies(arrow);

    return {
      name,
      file: fileName,
      type: 'arrow',
      props,
      styles,
      dependencies,
      lineCount: this.getLineCount(arrow),
      hasDefaultExport: false,
    };
  }

  /**
   * Extract class component info
   */
  private extractClassComponent(node: ts.ClassDeclaration, fileName: string): ComponentInfo {
    const name = node.name?.getText() || 'Anonymous';
    const props = this.extractPropsFromClass(node);
    const styles = this.extractStyles(node);
    const dependencies = this.extractDependencies(node);

    return {
      name,
      file: fileName,
      type: 'class',
      props,
      styles,
      dependencies,
      lineCount: this.getLineCount(node),
      hasDefaultExport: this.checkDefaultExport(node),
    };
  }

  /**
   * Extract props from function parameters
   */
  private extractPropsFromParameters(params: ts.NodeArray<ts.ParameterDeclaration>): PropInfo[] {
    const props: PropInfo[] = [];
    
    for (const param of params) {
      // Destructured props: ({ prop1, prop2 })
      if (ts.isObjectBindingPattern(param.name)) {
        for (const element of param.name.elements) {
          if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
            props.push({
              name: element.name.getText(),
              type: this.getTypeString(element),
              required: !element.initializer,
              defaultValue: element.initializer?.getText(),
            });
          }
        }
      }
      // Named props parameter
      else if (ts.isIdentifier(param.name)) {
        if (param.type && ts.isTypeLiteralNode(param.type)) {
          for (const member of param.type.members) {
            if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
              props.push({
                name: member.name.getText(),
                type: member.type?.getText() || 'unknown',
                required: !member.questionToken,
              });
            }
          }
        }
      }
    }

    return props;
  }

  /**
   * Extract props from class component
   */
  private extractPropsFromClass(node: ts.ClassDeclaration): PropInfo[] {
    const props: PropInfo[] = [];

    // Check heritage clause for Props type
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        for (const type of clause.types) {
          if (type.typeArguments && type.typeArguments.length > 0) {
            const propsType = type.typeArguments[0];
            if (ts.isTypeLiteralNode(propsType)) {
              for (const member of propsType.members) {
                if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
                  props.push({
                    name: member.name.getText(),
                    type: member.type?.getText() || 'unknown',
                    required: !member.questionToken,
                  });
                }
              }
            }
          }
        }
      }
    }

    return props;
  }

  /**
   * Extract inline styles and className usage
   */
  private extractStyles(node: ts.Node): StyleInfo[] {
    const styles: StyleInfo[] = [];

    const visit = (n: ts.Node) => {
      // JSX style attribute
      if (ts.isJsxAttribute(n) && n.name.getText() === 'style') {
        if (n.initializer && ts.isJsxExpression(n.initializer)) {
          const expr = n.initializer.expression;
          if (expr && ts.isObjectLiteralExpression(expr)) {
            for (const prop of expr.properties) {
              if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                styles.push({
                  property: prop.name.getText(),
                  value: prop.initializer.getText(),
                  source: 'inline',
                  line: this.getLineNumber(prop),
                });
              }
            }
          }
        }
      }

      // className attribute
      if (ts.isJsxAttribute(n) && n.name.getText() === 'className') {
        if (n.initializer) {
          const value = n.initializer.getText().replace(/['"]/g, '');
          styles.push({
            property: 'className',
            value,
            source: 'className',
            line: this.getLineNumber(n),
          });
        }
      }

      ts.forEachChild(n, visit);
    };

    visit(node);
    return styles;
  }

  /**
   * Extract import dependencies
   */
  private extractDependencies(node: ts.Node): string[] {
    const sourceFile = node.getSourceFile();
    const dependencies: string[] = [];

    ts.forEachChild(sourceFile, (child) => {
      if (ts.isImportDeclaration(child)) {
        const moduleSpecifier = child.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          dependencies.push(moduleSpecifier.text);
        }
      }
    });

    return dependencies;
  }

  /**
   * Extract design tokens from code
   */
  extractDesignTokens(content: string, fileName: string): {
    colors: ColorToken[];
    spacing: SpacingToken[];
    typography: TypographyToken[];
  } {
    const colors: ColorToken[] = [];
    const spacing: SpacingToken[] = [];
    const typography: TypographyToken[] = [];

    // Extract colors
    for (const pattern of COLOR_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const value = match[0];
        const hex = this.normalizeColor(value);
        if (hex) {
          const existing = colors.find(c => c.hex === hex);
          if (existing) {
            existing.usageCount++;
            if (!existing.files.includes(fileName)) {
              existing.files.push(fileName);
            }
          } else {
            colors.push({
              name: `color-${colors.length + 1}`,
              category: 'color',
              value,
              hex,
              usageCount: 1,
              files: [fileName],
              usage: this.inferColorUsage(content, value),
            });
          }
        }
      }
    }

    // Extract spacing values
    const spacingPattern = /(\d+)px|spacing-(\d+)|p-(\d+)|m-(\d+)|gap-(\d+)/g;
    const spacingMatches = content.matchAll(spacingPattern);
    for (const match of spacingMatches) {
      const value = match[1] || match[2] || match[3] || match[4] || match[5];
      if (value) {
        const pixels = parseInt(value, 10);
        const existing = spacing.find(s => s.pixels === pixels);
        if (existing) {
          existing.usageCount++;
          if (!existing.files.includes(fileName)) {
            existing.files.push(fileName);
          }
        } else {
          spacing.push({
            name: `spacing-${pixels}`,
            category: 'spacing',
            value: `${pixels}px`,
            pixels,
            usageCount: 1,
            files: [fileName],
          });
        }
      }
    }

    // Extract typography
    const fontSizePattern = /font-size:\s*([\d.]+(?:px|rem|em))|text-(xs|sm|base|lg|xl|2xl|3xl)/g;
    const fontSizeMatches = content.matchAll(fontSizePattern);
    for (const match of fontSizeMatches) {
      const value = match[1] || match[2];
      if (value) {
        const existing = typography.find(t => t.fontSize === value);
        if (existing) {
          existing.usageCount++;
        } else {
          typography.push({
            name: `font-${value}`,
            category: 'typography',
            value,
            fontSize: value,
            usageCount: 1,
            files: [fileName],
          });
        }
      }
    }

    return { colors, spacing, typography };
  }

  /**
   * Normalize color value to hex
   */
  private normalizeColor(value: string): string | null {
    if (value.startsWith('#')) {
      // Expand 3-digit hex to 6-digit
      if (value.length === 4) {
        return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toUpperCase();
      }
      return value.slice(0, 7).toUpperCase();
    }

    // Handle rgb/rgba
    const rgbMatch = value.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`.toUpperCase();
    }

    return null;
  }

  /**
   * Infer color usage from context
   */
  private inferColorUsage(content: string, colorValue: string): ColorToken['usage'] {
    const colorIndex = content.indexOf(colorValue);
    const context = content.slice(Math.max(0, colorIndex - 50), colorIndex + colorValue.length + 50);

    if (/background|bg-/i.test(context)) return 'background';
    if (/text|color:/i.test(context)) return 'text';
    if (/border/i.test(context)) return 'border';
    return 'accent';
  }

  /**
   * Analyze a directory for design system
   */
  async analyzeDirectory(directory: string): Promise<DesignSystemAnalysis> {
    const components: ComponentInfo[] = [];
    const allColors: ColorToken[] = [];
    const allSpacing: SpacingToken[] = [];
    const allTypography: TypographyToken[] = [];
    const patterns: Map<string, { name: string; count: number; files: Set<string>; example: string }> = new Map();

    const files = this.getCodeFiles(directory);

    for (const file of files) {
      const sourceFile = this.parseFile(file);
      if (!sourceFile) continue;

      // Extract components
      const fileComponents = this.extractComponents(sourceFile);
      components.push(...fileComponents);

      // Extract tokens
      const content = fs.readFileSync(file, 'utf-8');
      const tokens = this.extractDesignTokens(content, file);

      // Merge colors
      for (const color of tokens.colors) {
        const existing = allColors.find(c => c.hex === color.hex);
        if (existing) {
          existing.usageCount += color.usageCount;
          existing.files.push(...color.files);
        } else {
          allColors.push(color);
        }
      }

      // Merge spacing
      for (const space of tokens.spacing) {
        const existing = allSpacing.find(s => s.pixels === space.pixels);
        if (existing) {
          existing.usageCount += space.usageCount;
          existing.files.push(...space.files);
        } else {
          allSpacing.push(space);
        }
      }

      // Merge typography
      allTypography.push(...tokens.typography);

      // Detect patterns
      this.detectPatterns(content, file, patterns);
    }

    // Calculate consistency score
    const totalTokens = allColors.length + allSpacing.length + allTypography.length;
    const uniqueColors = new Set(allColors.map(c => c.hex)).size;
    const uniqueSpacing = new Set(allSpacing.map(s => s.pixels)).size;
    
    // Score based on how concentrated the usage is (fewer unique values = more consistent)
    const consistencyScore = Math.max(0, 100 - (uniqueColors * 2) - (uniqueSpacing));

    return {
      components,
      tokens: {
        colors: allColors.sort((a, b) => b.usageCount - a.usageCount),
        spacing: allSpacing.sort((a, b) => b.usageCount - a.usageCount),
        typography: allTypography.sort((a, b) => b.usageCount - a.usageCount),
        borders: [],
        shadows: [],
        breakpoints: [],
        animations: [],
      },
      patterns: Array.from(patterns.values()).map(p => ({
        name: p.name,
        description: `${p.name} pattern detected`,
        occurrences: p.count,
        files: Array.from(p.files),
        example: p.example,
      })),
      statistics: {
        totalComponents: components.length,
        totalTokens,
        uniqueColors,
        uniqueSpacing,
        consistencyScore,
      },
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Detect common patterns in code
   */
  private detectPatterns(
    content: string, 
    file: string, 
    patterns: Map<string, { name: string; count: number; files: Set<string>; example: string }>
  ): void {
    const patternDetectors = [
      { name: 'Hook Pattern', regex: /const\s+\[[\w,\s]+\]\s*=\s*useState\(/g },
      { name: 'Effect Pattern', regex: /useEffect\s*\(\s*\(\)\s*=>/g },
      { name: 'Callback Pattern', regex: /useCallback\s*\(/g },
      { name: 'Memo Pattern', regex: /useMemo\s*\(/g },
      { name: 'Context Pattern', regex: /useContext\s*\(/g },
      { name: 'Ref Pattern', regex: /useRef\s*\(/g },
      { name: 'Styled Components', regex: /styled\.\w+`/g },
      { name: 'CSS Modules', regex: /import\s+styles\s+from\s+['"].*\.module\.(css|scss)/g },
      { name: 'Tailwind Classes', regex: /className=["'][^"']*\b(flex|grid|p-|m-|text-|bg-|border-)/g },
    ];

    for (const { name, regex } of patternDetectors) {
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        const existing = patterns.get(name) || { name, count: 0, files: new Set(), example: matches[0] };
        existing.count += matches.length;
        existing.files.add(file);
        patterns.set(name, existing);
      }
    }
  }

  /**
   * Get code files from directory
   */
  private getCodeFiles(directory: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };

    try {
      walk(directory);
    } catch (error) {
      console.error('Failed to walk directory:', error);
    }

    return files;
  }

  /**
   * Generate design tokens file
   */
  generateTokensFile(analysis: DesignSystemAnalysis, format: 'css' | 'json' | 'scss' | 'js'): string {
    switch (format) {
      case 'css':
        return this.generateCSSTokens(analysis);
      case 'scss':
        return this.generateSCSSTokens(analysis);
      case 'js':
        return this.generateJSTokens(analysis);
      case 'json':
      default:
        return JSON.stringify(analysis.tokens, null, 2);
    }
  }

  private generateCSSTokens(analysis: DesignSystemAnalysis): string {
    let css = ':root {\n';
    
    // Colors
    css += '  /* Colors */\n';
    for (const color of analysis.tokens.colors) {
      css += `  --${color.name}: ${color.hex};\n`;
    }

    // Spacing
    css += '\n  /* Spacing */\n';
    for (const space of analysis.tokens.spacing) {
      css += `  --${space.name}: ${space.value};\n`;
    }

    // Typography
    css += '\n  /* Typography */\n';
    for (const font of analysis.tokens.typography) {
      css += `  --${font.name}: ${font.fontSize};\n`;
    }

    css += '}\n';
    return css;
  }

  private generateSCSSTokens(analysis: DesignSystemAnalysis): string {
    let scss = '// Design Tokens\n\n';
    
    // Colors
    scss += '// Colors\n';
    for (const color of analysis.tokens.colors) {
      scss += `$${color.name}: ${color.hex};\n`;
    }

    // Spacing
    scss += '\n// Spacing\n';
    for (const space of analysis.tokens.spacing) {
      scss += `$${space.name}: ${space.value};\n`;
    }

    // Typography
    scss += '\n// Typography\n';
    for (const font of analysis.tokens.typography) {
      scss += `$${font.name}: ${font.fontSize};\n`;
    }

    return scss;
  }

  private generateJSTokens(analysis: DesignSystemAnalysis): string {
    const tokens = {
      colors: Object.fromEntries(analysis.tokens.colors.map(c => [c.name, c.hex])),
      spacing: Object.fromEntries(analysis.tokens.spacing.map(s => [s.name, s.value])),
      typography: Object.fromEntries(analysis.tokens.typography.map(t => [t.name, t.fontSize])),
    };

    return `export const tokens = ${JSON.stringify(tokens, null, 2)};\n`;
  }

  // Helper methods
  private getTypeString(node: ts.Node): string {
    if (ts.isBindingElement(node) && node.parent && ts.isObjectBindingPattern(node.parent)) {
      // Try to get type from parent parameter
      const param = node.parent.parent;
      if (ts.isParameter(param) && param.type) {
        return 'any'; // Would need type checker for actual type
      }
    }
    return 'unknown';
  }

  private getLineCount(node: ts.Node): number {
    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    return end.line - start.line + 1;
  }

  private getLineNumber(node: ts.Node): number {
    const sourceFile = node.getSourceFile();
    return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  }

  private checkDefaultExport(node: ts.Node): boolean {
    const sourceFile = node.getSourceFile();
    let hasDefault = false;

    ts.forEachChild(sourceFile, (child) => {
      if (ts.isExportAssignment(child) && !child.isExportEquals) {
        hasDefault = true;
      }
    });

    return hasDefault;
  }
}

export const astParsingService = new ASTParsingService();
