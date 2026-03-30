/**
 * Phase 1.2: Link Extraction (semantic, not regex)
 * 
 * Extracts navigations from:
 * - JSX: <a href>, <Link href/to>, <NavLink to>, custom wrappers
 * - Programmatic: router.push/replace/navigate, window.location
 * - Config-driven: route arrays/objects, exported route maps
 * 
 * Uses TypeScript Compiler API for semantic analysis.
 */

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import {
  ExtractedLink,
  ExtractionType,
  SourceLocation,
  EdgeGuard,
  PlaceholderMatch,
} from '../types';

interface ExtractorContext {
  sourceFile: ts.SourceFile;
  typeChecker: ts.TypeChecker | null;
  filePath: string;
  constants: Map<string, string>;
  imports: Map<string, string>;
}

interface ExtractionResult {
  links: ExtractedLink[];
  placeholders: PlaceholderMatch[];
  constants: Map<string, string>;
}

const LINK_COMPONENTS = new Set([
  'Link',
  'NavLink',
  'a',
  'A',
  'AppLink',
  'CustomLink',
  'InternalLink',
  'ExternalLink',
  'RouterLink',
]);

const HREF_PROPS = new Set(['href', 'to', 'path', 'route', 'url']);

const ROUTER_METHODS = new Set([
  'push',
  'replace',
  'navigate',
  'go',
  'goTo',
  'redirect',
]);

const PLACEHOLDER_PATTERNS = [
  /coming\s*soon/i,
  /not\s*implemented/i,
  /todo/i,
  /fixme/i,
  /placeholder/i,
  /work\s*in\s*progress/i,
  /wip/i,
  /under\s*construction/i,
  /tbd/i,
  /lorem\s*ipsum/i,
  /dummy/i,
  /mock/i,
  /fake/i,
  /sample/i,
  /example\.com/i,
  /test\s*data/i,
];

export class LinkExtractor {
  private program: ts.Program | null = null;
  private typeChecker: ts.TypeChecker | null = null;

  constructor(private tsconfigPath?: string) {
    if (tsconfigPath) {
      this.initializeProgram(tsconfigPath);
    }
  }

  private initializeProgram(tsconfigPath: string): void {
    try {
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (configFile.error) {
        return;
      }

      const configDir = path.dirname(tsconfigPath);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        configDir
      );

      this.program = ts.createProgram({
        rootNames: parsedConfig.fileNames,
        options: {
          ...parsedConfig.options,
          allowJs: true,
          checkJs: false,
          noEmit: true,
        },
      });

      this.typeChecker = this.program.getTypeChecker();
    } catch {
      // Failed to initialize program - will work without type checker
    }
  }

  extractFromFile(filePath: string, content?: string): ExtractionResult {
    const fileContent = content ?? fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
      this.getScriptKind(filePath)
    );

    const context: ExtractorContext = {
      sourceFile,
      typeChecker: this.typeChecker,
      filePath,
      constants: new Map(),
      imports: new Map(),
    };

    this.collectImportsAndConstants(sourceFile, context);

    const links: ExtractedLink[] = [];
    const placeholders: PlaceholderMatch[] = [];

    this.visitNode(sourceFile, context, links, placeholders);

    return {
      links,
      placeholders,
      constants: context.constants,
    };
  }

  extractFromFiles(filePaths: string[]): Map<string, ExtractionResult> {
    const results = new Map<string, ExtractionResult>();

    for (const filePath of filePaths) {
      try {
        const result = this.extractFromFile(filePath);
        results.set(filePath, result);
      } catch {
        // Skip files that can't be parsed
      }
    }

    return results;
  }

  private getScriptKind(filePath: string): ts.ScriptKind {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.tsx':
        return ts.ScriptKind.TSX;
      case '.ts':
        return ts.ScriptKind.TS;
      case '.jsx':
        return ts.ScriptKind.JSX;
      case '.js':
        return ts.ScriptKind.JS;
      default:
        return ts.ScriptKind.Unknown;
    }
  }

  private collectImportsAndConstants(
    sourceFile: ts.SourceFile,
    context: ExtractorContext
  ): void {
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        this.processImport(node, context);
      }

      if (ts.isVariableStatement(node)) {
        this.processVariableStatement(node, context);
      }

      if (ts.isExportAssignment(node) || ts.isExportDeclaration(node)) {
        this.processExport(node, context);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private processImport(node: ts.ImportDeclaration, context: ExtractorContext): void {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) return;

    const modulePath = moduleSpecifier.text;
    const importClause = node.importClause;

    if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
      for (const element of importClause.namedBindings.elements) {
        const name = element.name.text;
        const propertyName = element.propertyName?.text || name;
        context.imports.set(name, `${modulePath}#${propertyName}`);
      }
    }

    if (importClause?.name) {
      context.imports.set(importClause.name.text, modulePath);
    }
  }

  private processVariableStatement(
    node: ts.VariableStatement,
    context: ExtractorContext
  ): void {
    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const name = declaration.name.text;

      if (declaration.initializer) {
        const value = this.evaluateExpression(declaration.initializer, context);
        if (value !== null) {
          context.constants.set(name, value);
        }
      }
    }
  }

  private processExport(
    node: ts.ExportAssignment | ts.ExportDeclaration,
    context: ExtractorContext
  ): void {
    if (ts.isExportAssignment(node) && node.expression) {
      if (ts.isObjectLiteralExpression(node.expression)) {
        this.extractRoutesFromObject(node.expression, context);
      }
    }
  }

  private extractRoutesFromObject(
    obj: ts.ObjectLiteralExpression,
    context: ExtractorContext
  ): Map<string, string> {
    const routes = new Map<string, string>();

    for (const prop of obj.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        const key = prop.name.text;
        const value = this.evaluateExpression(prop.initializer, context);
        if (value !== null && value.startsWith('/')) {
          routes.set(key, value);
          context.constants.set(`ROUTES.${key}`, value);
        }
      }
    }

    return routes;
  }

  private evaluateExpression(
    expr: ts.Expression,
    context: ExtractorContext
  ): string | null {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return expr.text;
    }

    if (ts.isIdentifier(expr)) {
      const name = expr.text;
      if (context.constants.has(name)) {
        return context.constants.get(name)!;
      }
      return null;
    }

    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = this.evaluateExpression(expr.left, context);
      const right = this.evaluateExpression(expr.right, context);
      if (left !== null && right !== null) {
        return left + right;
      }
      return null;
    }

    if (ts.isTemplateExpression(expr)) {
      let result = expr.head.text;
      let hasUnresolved = false;

      for (const span of expr.templateSpans) {
        const spanValue = this.evaluateExpression(span.expression, context);
        if (spanValue !== null) {
          result += spanValue;
        } else {
          hasUnresolved = true;
          result += '${...}';
        }
        result += span.literal.text;
      }

      return hasUnresolved ? null : result;
    }

    if (ts.isPropertyAccessExpression(expr)) {
      const objName = ts.isIdentifier(expr.expression) ? expr.expression.text : null;
      const propName = expr.name.text;
      
      if (objName) {
        const key = `${objName}.${propName}`;
        if (context.constants.has(key)) {
          return context.constants.get(key)!;
        }
      }
    }

    return null;
  }

  private visitNode(
    node: ts.Node,
    context: ExtractorContext,
    links: ExtractedLink[],
    placeholders: PlaceholderMatch[]
  ): void {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      this.extractJsxLinks(node, context, links, placeholders);
    }

    if (ts.isCallExpression(node)) {
      this.extractCallLinks(node, context, links);
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      this.checkPlaceholder(node, context, placeholders);
    }

    if (ts.isJsxText(node)) {
      this.checkJsxTextPlaceholder(node, context, placeholders);
    }

    ts.forEachChild(node, child => this.visitNode(child, context, links, placeholders));
  }

  private extractJsxLinks(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    context: ExtractorContext,
    links: ExtractedLink[],
    placeholders: PlaceholderMatch[]
  ): void {
    const openingElement = ts.isJsxElement(node) ? node.openingElement : node;
    const tagName = this.getJsxTagName(openingElement);

    if (!LINK_COMPONENTS.has(tagName)) {
      return;
    }

    const attributes = openingElement.attributes;
    let hrefValue: string | null = null;
    let hrefPropName: string | null = null;
    let isLiteral = false;
    let isDynamic = false;
    let confidence: ExtractedLink['confidence'] = 'high';
    const guards: EdgeGuard[] = [];

    for (const attr of attributes.properties) {
      if (ts.isJsxAttribute(attr) && attr.name && ts.isIdentifier(attr.name)) {
        const propName = attr.name.text;

        if (HREF_PROPS.has(propName) && attr.initializer) {
          hrefPropName = propName;

          if (ts.isStringLiteral(attr.initializer)) {
            hrefValue = attr.initializer.text;
            isLiteral = true;
          } else if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
            const expr = attr.initializer.expression;
            const resolved = this.evaluateExpression(expr, context);

            if (resolved !== null) {
              hrefValue = resolved;
              isLiteral = !ts.isTemplateExpression(expr);
              confidence = 'high';
            } else if (ts.isTemplateExpression(expr)) {
              hrefValue = this.extractTemplatePattern(expr, context);
              isDynamic = true;
              confidence = 'medium';
            } else if (ts.isIdentifier(expr)) {
              hrefValue = `\${${expr.text}}`;
              isDynamic = true;
              confidence = 'low';
            } else {
              isDynamic = true;
              confidence = 'low';
            }
          }
        }
      }
    }

    this.extractGuardsFromParent(node, context, guards);

    if (hrefValue && (hrefValue.startsWith('/') || hrefValue.startsWith('${'))) {
      const location = this.getLocation(openingElement, context);
      const extractionType = this.getExtractionType(tagName, hrefPropName);

      links.push({
        type: extractionType,
        href: hrefValue,
        isLiteral,
        isDynamic,
        confidence,
        location,
        resolvedValue: isLiteral ? hrefValue : null,
        templateParts: isDynamic ? this.extractTemplateParts(hrefValue) : null,
        guards,
      });
    }
  }

  private extractCallLinks(
    node: ts.CallExpression,
    context: ExtractorContext,
    links: ExtractedLink[]
  ): void {
    const methodName = this.getCallMethodName(node);
    if (!methodName || !ROUTER_METHODS.has(methodName)) {
      return;
    }

    const firstArg = node.arguments[0];
    if (!firstArg) return;

    let href: string | null = null;
    let isLiteral = false;
    let isDynamic = false;
    let confidence: ExtractedLink['confidence'] = 'high';

    const resolved = this.evaluateExpression(firstArg, context);
    if (resolved !== null) {
      href = resolved;
      isLiteral = ts.isStringLiteral(firstArg);
    } else if (ts.isTemplateExpression(firstArg)) {
      href = this.extractTemplatePattern(firstArg, context);
      isDynamic = true;
      confidence = 'medium';
    } else if (ts.isObjectLiteralExpression(firstArg)) {
      href = this.extractPathFromObject(firstArg, context);
      if (href) {
        isLiteral = true;
      }
    }

    if (href && href.startsWith('/')) {
      const location = this.getLocation(node, context);

      links.push({
        type: this.getRouterExtractionType(methodName),
        href,
        isLiteral,
        isDynamic,
        confidence,
        location,
        resolvedValue: isLiteral ? href : null,
        templateParts: isDynamic ? this.extractTemplateParts(href) : null,
        guards: [],
      });
    }
  }

  private extractTemplatePattern(
    expr: ts.TemplateExpression,
    context: ExtractorContext
  ): string {
    let result = expr.head.text;

    for (const span of expr.templateSpans) {
      const spanValue = this.evaluateExpression(span.expression, context);
      if (spanValue !== null) {
        result += spanValue;
      } else if (ts.isIdentifier(span.expression)) {
        result += `:${span.expression.text}`;
      } else {
        result += ':param';
      }
      result += span.literal.text;
    }

    return result;
  }

  private extractPathFromObject(
    obj: ts.ObjectLiteralExpression,
    context: ExtractorContext
  ): string | null {
    for (const prop of obj.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        const propName = prop.name.text;
        if (propName === 'pathname' || propName === 'path' || propName === 'href') {
          return this.evaluateExpression(prop.initializer, context);
        }
      }
    }
    return null;
  }

  private extractGuardsFromParent(
    node: ts.Node,
    context: ExtractorContext,
    guards: EdgeGuard[]
  ): void {
    let parent = node.parent;
    let depth = 0;

    while (parent && depth < 10) {
      if (ts.isConditionalExpression(parent)) {
        const condition = parent.condition;
        const guardInfo = this.parseGuardCondition(condition, context);
        if (guardInfo) {
          guards.push(guardInfo);
        }
      }

      if (ts.isBinaryExpression(parent) && 
          parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        const condition = parent.left;
        const guardInfo = this.parseGuardCondition(condition, context);
        if (guardInfo) {
          guards.push(guardInfo);
        }
      }

      if (ts.isIfStatement(parent)) {
        const guardInfo = this.parseGuardCondition(parent.expression, context);
        if (guardInfo) {
          guards.push(guardInfo);
        }
      }

      parent = parent.parent;
      depth++;
    }
  }

  private parseGuardCondition(
    condition: ts.Expression,
    context: ExtractorContext
  ): EdgeGuard | null {
    const conditionText = condition.getText(context.sourceFile);

    if (/\b(isAuth|isLoggedIn|authenticated|user|session)\b/i.test(conditionText)) {
      return {
        type: 'auth-required',
        expression: conditionText,
        flagName: null,
      };
    }

    if (/\b(flag|feature|enabled|toggle)\b/i.test(conditionText)) {
      const flagMatch = conditionText.match(/['"]([^'"]+)['"]/);
      return {
        type: 'feature-flag',
        expression: conditionText,
        flagName: flagMatch ? flagMatch[1] : null,
      };
    }

    if (/\b(role|admin|permission|can[A-Z])\b/i.test(conditionText)) {
      return {
        type: 'role-check',
        expression: conditionText,
        flagName: null,
      };
    }

    return null;
  }

  private checkPlaceholder(
    node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
    context: ExtractorContext,
    placeholders: PlaceholderMatch[]
  ): void {
    const text = node.text;
    
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(text)) {
        const location = this.getLocation(node, context);
        const isInJsx = this.isInsideJsxText(node);

        placeholders.push({
          text,
          type: isInJsx ? 'ui-visible' : 'string-literal',
          severity: isInJsx ? 'high' : 'low',
          location,
          context: this.getNodeContext(node, context),
        });
        break;
      }
    }
  }

  private checkJsxTextPlaceholder(
    node: ts.JsxText,
    context: ExtractorContext,
    placeholders: PlaceholderMatch[]
  ): void {
    const text = node.text.trim();
    if (!text) return;

    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(text)) {
        const location = this.getLocation(node, context);

        placeholders.push({
          text,
          type: 'ui-visible',
          severity: 'high',
          location,
          context: this.getNodeContext(node, context),
        });
        break;
      }
    }
  }

  private isInsideJsxText(node: ts.Node): boolean {
    let parent = node.parent;
    while (parent) {
      if (ts.isJsxElement(parent) || ts.isJsxFragment(parent)) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  private getJsxTagName(element: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
    const tagName = element.tagName;
    if (ts.isIdentifier(tagName)) {
      return tagName.text;
    }
    if (ts.isPropertyAccessExpression(tagName) && ts.isIdentifier(tagName.name)) {
      return tagName.name.text;
    }
    return '';
  }

  private getCallMethodName(node: ts.CallExpression): string | null {
    const expr = node.expression;

    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
      return expr.name.text;
    }

    if (ts.isIdentifier(expr)) {
      return expr.text;
    }

    return null;
  }

  private getExtractionType(tagName: string, propName: string | null): ExtractionType {
    if (tagName === 'a' || tagName === 'A') {
      return 'jsx-a-tag';
    }
    if (tagName === 'NavLink') {
      return 'jsx-navlink';
    }
    return 'jsx-link';
  }

  private getRouterExtractionType(methodName: string): ExtractionType {
    if (methodName === 'push') return 'router-push';
    if (methodName === 'replace') return 'router-replace';
    if (methodName === 'navigate' || methodName === 'go' || methodName === 'goTo') {
      return 'router-navigate';
    }
    return 'router-push';
  }

  private extractTemplateParts(value: string): string[] {
    return value.split(/(\$\{[^}]+\}|:[a-zA-Z_][a-zA-Z0-9_]*)/);
  }

  private getLocation(node: ts.Node, context: ExtractorContext): SourceLocation {
    const start = context.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = context.sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return {
      file: context.filePath,
      line: start.line + 1,
      column: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1,
    };
  }

  private getNodeContext(node: ts.Node, context: ExtractorContext): string {
    const start = node.getStart();
    const lineStart = context.sourceFile.getLineAndCharacterOfPosition(start);
    const lineText = context.sourceFile.text.split('\n')[lineStart.line] || '';
    return lineText.trim().slice(0, 100);
  }
}

export function createLinkExtractor(tsconfigPath?: string): LinkExtractor {
  return new LinkExtractor(tsconfigPath);
}

export function extractLinksFromFile(
  filePath: string,
  tsconfigPath?: string
): ExtractionResult {
  const extractor = new LinkExtractor(tsconfigPath);
  return extractor.extractFromFile(filePath);
}
