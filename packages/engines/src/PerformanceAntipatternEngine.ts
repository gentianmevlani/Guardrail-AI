/**
 * PerformanceAntipatternEngine — Detects performance anti-patterns from AI-generated code.
 * Rules: PERF001–PERF007 (N+1, unbounded query, memo, sync I/O, img, index, fetch in render)
 */

import { BaseEngine } from './base-engine.js';
import type { Finding, DeltaContext } from './core-types';
import {
  LOOP_START_RE,
  DB_AWAIT_RE,
  UNBOUNDED_QUERY_RE,
  PAGINATION_PARAMS,
  COMPONENT_IN_MAP_RE,
  REACT_MEMO_RE,
  SYNC_IO_RE,
  RAW_IMG_RE,
  NEXT_IMAGE_RE,
  STRING_SEARCH_RE,
  ORDER_BY_RE,
  FETCH_IN_RENDER_RE,
} from './data/performance-patterns.js';

export class PerformanceAntipatternEngine extends BaseEngine {
  readonly id = 'perf-antipattern';
  readonly name = 'Performance Antipattern Engine';
  readonly version = '1.0.0';
  readonly supportedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    const findings: Finding[] = [];
    const source = delta.fullText;
    const uri = delta.documentUri.replace(/^file:\/\//, '');
    const lines = source.split('\n');

    this.checkAbort(signal);

    const isNextProject = /next\.config|from\s+['"]next['"]/.test(source);
    const hasPagination = PAGINATION_PARAMS.test(source);
    const hasMemo = REACT_MEMO_RE.test(source);
    const hasNextImage = NEXT_IMAGE_RE.test(source);

    let inLoop = 0;
    let perf002Added = false;
    let perf004Added = false;
    let perf005Added = false;

    for (let i = 0; i < lines.length; i++) {
      this.checkAbort(signal);
      const line = lines[i]!;
      const lineNum = i + 1;

      // Track loop depth (simplified: count loop starts vs closes)
      if (LOOP_START_RE.test(line)) inLoop++;
      if (/^\s*\}\s*\)?\s*;?\s*$/.test(line) && inLoop > 0) inLoop--;

      // PERF001 — N+1 query in loop
      if (inLoop > 0 && DB_AWAIT_RE.test(line)) {
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'PERF001', 'n+1'),
            ruleId: 'PERF001',
            category: 'performance',
            message: 'Database query inside loop — N+1 pattern',
            severity: 'high',
            confidence: 0.9,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Batch the query or use include/join to fetch related data',
            autoFixable: false,
          })
        );
      }

      // PERF002 — Unbounded query without pagination
      if (
        !perf002Added &&
        UNBOUNDED_QUERY_RE.test(line) &&
        !hasPagination &&
        !PAGINATION_PARAMS.test(line)
      ) {
        perf002Added = true;
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'PERF002', 'unbounded'),
            ruleId: 'PERF002',
            category: 'performance',
            message: 'Query without pagination — may return unbounded results',
            severity: 'high',
            confidence: 0.85,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Add take, limit, or cursor-based pagination',
            autoFixable: false,
          })
        );
      }

      // PERF003 — Missing React.memo on component in map
      if (
        COMPONENT_IN_MAP_RE.test(line) &&
        !hasMemo &&
        /\.tsx$|\.jsx$/.test(uri)
      ) {
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'PERF003', 'memo'),
            ruleId: 'PERF003',
            category: 'performance',
            message: 'Component in .map() without React.memo — may cause unnecessary re-renders',
            severity: 'medium',
            confidence: 0.65,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Wrap the component in React.memo() if it receives stable props',
            autoFixable: false,
          })
        );
      }

      // PERF004 — Sync file I/O at module level
      if (!perf004Added && SYNC_IO_RE.test(line)) {
        const beforeLine = lines.slice(0, i).join('\n');
        const depth =
          (beforeLine.match(/\{/g) || []).length -
          (beforeLine.match(/\}/g) || []).length;
        if (depth <= 0) {
          perf004Added = true;
          findings.push(
            this.createFinding({
              id: this.deterministicId(uri, lineNum, 0, 'PERF004', 'sync-io'),
              ruleId: 'PERF004',
              category: 'performance',
              message: 'Synchronous file I/O at module level — blocks event loop',
              severity: 'medium',
              confidence: 0.8,
              file: uri,
              line: lineNum,
              column: 0,
              evidence: line.trim().slice(0, 60),
              suggestion: 'Use async fs.promises or move I/O inside an async function',
              autoFixable: false,
            })
          );
        }
      }

      // PERF005 — Unoptimized img in Next.js
      if (
        !perf005Added &&
        isNextProject &&
        RAW_IMG_RE.test(line) &&
        !hasNextImage
      ) {
        perf005Added = true;
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'PERF005', 'img'),
            ruleId: 'PERF005',
            category: 'performance',
            message: 'Use next/image for automatic optimization',
            severity: 'low',
            confidence: 0.7,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Replace <img> with next/image Image component',
            autoFixable: false,
          })
        );
      }

      // PERF006 — String search without index
      if (STRING_SEARCH_RE.test(line) && ORDER_BY_RE.test(source)) {
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'PERF006', 'index'),
            ruleId: 'PERF006',
            category: 'performance',
            message: 'String search (contains/startsWith) with orderBy — consider composite index',
            severity: 'low',
            confidence: 0.5,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Add database index for the searched column(s)',
            autoFixable: false,
          })
        );
      }

      // PERF007 — Fetch in React render body (not inside useEffect)
      if (FETCH_IN_RENDER_RE.test(line) && /\.tsx$|\.jsx$/.test(uri)) {
        const beforeLine = lines.slice(0, i).join('\n');
        const lastUseEffect = beforeLine.lastIndexOf('useEffect');
        const slice = lastUseEffect >= 0 ? beforeLine.slice(lastUseEffect) : '';
        const opens = (slice.match(/\{/g) || []).length;
        const closes = (slice.match(/\}/g) || []).length;
        const isInsideUseEffect = lastUseEffect >= 0 && opens > closes;
        if (!isInsideUseEffect) {
          findings.push(
            this.createFinding({
              id: this.deterministicId(uri, lineNum, 0, 'PERF007', 'fetch'),
              ruleId: 'PERF007',
              category: 'performance',
              message: 'Fetch in render body — move to useEffect to avoid re-fetch on every render',
              severity: 'high',
              confidence: 0.85,
              file: uri,
              line: lineNum,
              column: 0,
              evidence: line.trim().slice(0, 60),
              suggestion: 'Move fetch/axios call inside useEffect',
              autoFixable: false,
            })
          );
        }
      }
    }

    return findings;
  }
}
