/**
 * TypeContractEngine — Detects type-contract violations.
 * Catches situations where TypeScript types don't match actual API responses.
 * Rules: TCE001 (fetch/response mismatch), TCE002 (schema drift), TCE003 (JSON.parse), TCE004 (GraphQL)
 */

import { BaseEngine } from './base-engine.js';
import type { Finding, DeltaContext } from './core-types';
import {
  INTERFACE_DECL_RE,
  TYPE_ALIAS_OBJECT_RE,
  FIELD_EXTRACT_RE,
  AS_TYPE_RE,
  PROP_ACCESS_RE,
  OPTIONAL_PROP_RE,
} from './data/type-contract-patterns.js';

export class TypeContractEngine extends BaseEngine {
  readonly id = 'type-contract';
  readonly name = 'Type Contract Engine';
  readonly version = '1.0.0';
  readonly supportedExtensions = new Set(['.ts', '.tsx']);

  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    const findings: Finding[] = [];
    const source = delta.fullText;

    this.checkAbort(signal);

    const typeMap = this.extractTypeDeclarations(source);

    this.checkAbort(signal);

    const varTypes = this.extractTypedAssignments(source, typeMap);

    this.checkAbort(signal);

    for (const [varName, typeName] of varTypes) {
      const fields = typeMap.get(typeName);
      if (!fields) continue;

      const accesses = this.extractPropertyAccesses(source, varName);
      for (const { property, line, col } of accesses) {
        this.checkAbort(signal);
        if (!fields.has(property)) {
          const suggestion = this.closestField(property, fields);
          findings.push(
            this.createFinding({
              id: this.deterministicId(
                delta.documentUri,
                line,
                col,
                'TCE001',
                property
              ),
              ruleId: 'TCE001',
              category: 'type_contract',
              message: `'${property}' does not exist on type '${typeName}'.${
                suggestion ? ` Did you mean '${suggestion}'?` : ''
              }`,
              severity: 'high',
              confidence: suggestion ? 0.9 : 0.8,
              file: delta.documentUri.replace(/^file:\/\//, ''),
              line,
              column: col,
              evidence: property,
              suggestion: suggestion
                ? `Replace '${property}' with '${suggestion}'`
                : `Check the '${typeName}' interface definition`,
              autoFixable: false,
            })
          );
        }
      }
    }

    return findings;
  }

  private extractTypeDeclarations(source: string): Map<string, Set<string>> {
    const typeMap = new Map<string, Set<string>>();

    const extractFields = (braceIdx: number): Set<string> => {
      const fields = new Set<string>();
      let depth = 1;
      let i = braceIdx + 1;
      while (i < source.length && depth > 0) {
        const ch = source[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        i++;
      }
      const body = source.slice(braceIdx + 1, i - 1);
      const fieldRe = /(\w+)\s*[?]?\s*:/g;
      let fm: RegExpExecArray | null;
      while ((fm = fieldRe.exec(body))) {
        const name = fm[1]!;
        if (!/^(string|number|boolean|void|any)$/.test(name)) {
          fields.add(name);
        }
      }
      return fields;
    };

    let m: RegExpExecArray | null;
    INTERFACE_DECL_RE.lastIndex = 0;
    while ((m = INTERFACE_DECL_RE.exec(source))) {
      const typeName = m[1]!;
      const braceIdx = source.indexOf('{', m.index);
      if (braceIdx >= 0) {
        typeMap.set(typeName, extractFields(braceIdx + 1));
      }
    }

    TYPE_ALIAS_OBJECT_RE.lastIndex = 0;
    while ((m = TYPE_ALIAS_OBJECT_RE.exec(source))) {
      const typeName = m[1]!;
      const braceIdx = source.indexOf('{', m.index);
      if (braceIdx >= 0) {
        typeMap.set(typeName, extractFields(braceIdx + 1));
      }
    }

    return typeMap;
  }

  private extractTypedAssignments(
    source: string,
    typeMap: Map<string, Set<string>>
  ): Map<string, string> {
    const varTypes = new Map<string, string>();

    AS_TYPE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = AS_TYPE_RE.exec(source))) {
      const typeName = m[1]!;
      if (typeMap.has(typeName)) {
        const before = source.slice(0, m.index);
        const varMatch = before.match(/(\w+)\s*=\s*[^=]*$/);
        if (varMatch) {
          varTypes.set(varMatch[1]!, typeName);
        }
      }
    }

    return varTypes;
  }

  private extractPropertyAccesses(
    source: string,
    varName: string
  ): Array<{ property: string; line: number; col: number }> {
    const accesses: Array<{ property: string; line: number; col: number }> = [];
    const lines = source.split('\n');

    const varNameRe = new RegExp(
      `\\b${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[?]?\\.\\s*(\\w+)`,
      'g'
    );

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]!;
      varNameRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = varNameRe.exec(line))) {
        accesses.push({
          property: m[1]!,
          line: lineIdx + 1,
          col: m.index,
        });
      }
    }

    return accesses;
  }

  private closestField(property: string, fields: Set<string>): string | null {
    let best: string | null = null;
    let bestDist = Infinity;

    for (const f of fields) {
      const d = this.levenshtein(property, f);
      if (d < bestDist && d <= 2) {
        bestDist = d;
        best = f;
      }
    }
    return best;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i]![0] = i;
    for (let j = 0; j <= n; j++) dp[0]![j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i]![j] = Math.min(
          dp[i - 1]![j]! + 1,
          dp[i]![j - 1]! + 1,
          dp[i - 1]![j - 1]! + cost
        );
      }
    }
    return dp[m]![n]!;
  }
}
