import ts from "typescript";
import path from "node:path";
import type { SymbolRecord } from "@guardrail-context/shared";

export function scanSymbols(repoRoot: string, files: string[]): SymbolRecord[] {
  const tsFiles = files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
  
  const program = ts.createProgram(tsFiles, {
    allowJs: true,
    checkJs: false,
    noEmit: true,
    skipLibCheck: true,
  });

  const out: SymbolRecord[] = [];

  for (const sf of program.getSourceFiles()) {
    if (!sf.fileName.startsWith(repoRoot)) continue;
    if (sf.isDeclarationFile) continue;
    if (sf.fileName.includes("node_modules")) continue;

    const rel = path.relative(repoRoot, sf.fileName);

    function add(name: string, kind: SymbolRecord["kind"], node: ts.Node, isExported: boolean) {
      const s = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const e = sf.getLineAndCharacterOfPosition(node.getEnd());
      out.push({ name, kind, file: rel, startLine: s.line + 1, endLine: e.line + 1, isExported });
    }

    function hasExport(mods?: ts.NodeArray<ts.ModifierLike>) {
      return !!mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    }

    function isReactComponent(name: string, file: string): boolean {
      return /^[A-Z]/.test(name) && (file.endsWith(".tsx") || file.endsWith(".jsx"));
    }

    function isHook(name: string): boolean {
      return name.startsWith("use") && name.length > 3 && /^use[A-Z]/.test(name);
    }

    sf.forEachChild(node => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = node.name.text;
        const exported = hasExport(node.modifiers);
        
        if (isHook(name)) {
          add(name, "hook", node, exported);
        } else if (isReactComponent(name, rel)) {
          add(name, "component", node, exported);
        } else {
          add(name, "function", node, exported);
        }
      }
      
      if (ts.isClassDeclaration(node) && node.name) {
        add(node.name.text, "class", node, hasExport(node.modifiers));
      }
      
      if (ts.isTypeAliasDeclaration(node)) {
        add(node.name.text, "type", node, hasExport(node.modifiers));
      }
      
      if (ts.isInterfaceDeclaration(node)) {
        add(node.name.text, "interface", node, hasExport(node.modifiers));
      }
      
      if (ts.isVariableStatement(node)) {
        const isExp = hasExport(node.modifiers);
        for (const d of node.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) {
            const name = d.name.text;
            
            if (isHook(name)) {
              add(name, "hook", d, isExp);
            } else if (isReactComponent(name, rel)) {
              add(name, "component", d, isExp);
            } else {
              add(name, "const", d, isExp);
            }
          }
        }
      }

      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          add(el.name.text, "export", el, true);
        }
      }
    });
  }

  return out;
}

export function symbolExists(symbols: SymbolRecord[], name: string): SymbolRecord | null {
  return symbols.find(s => s.name === name) || null;
}

export function findSymbols(symbols: SymbolRecord[], name: string): SymbolRecord[] {
  return symbols.filter(s => s.name === name);
}
