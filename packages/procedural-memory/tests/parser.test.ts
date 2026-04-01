import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { parseJSONL, buildDecisionGraph } from '../src/parser/parse';

const FIXTURES = join(__dirname, 'fixtures');

describe('parseJSONL', () => {
  it('parses sample session into typed records', () => {
    const records = parseJSONL(join(FIXTURES, 'sample-session.jsonl'));
    
    // Should have records (summary + user + assistant messages)
    expect(records.length).toBeGreaterThan(0);
    
    // First non-summary record should be user message
    const firstMessage = records.find(r => r.type === 'user' || r.type === 'assistant');
    expect(firstMessage).toBeDefined();
    expect(firstMessage!.type).toBe('user');
  });

  it('filters out sidechain messages', () => {
    const records = parseJSONL(join(FIXTURES, 'sample-session.jsonl'));
    const hasSidechain = records.some(r => 'isSidechain' in r && r.isSidechain);
    expect(hasSidechain).toBe(false);
  });

  it('extracts summary record', () => {
    const records = parseJSONL(join(FIXTURES, 'sample-session.jsonl'));
    const summary = records.find(r => r.type === 'summary');
    expect(summary).toBeDefined();
  });
});

describe('buildDecisionGraph', () => {
  it('builds a graph from parsed records', () => {
    const records = parseJSONL(join(FIXTURES, 'sample-session.jsonl'));
    const graph = buildDecisionGraph(records, 'test-project');
    
    expect(graph.sessionId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(graph.project).toBe('test-project');
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('detects user corrections', () => {
    const records = parseJSONL(join(FIXTURES, 'sample-session.jsonl'));
    const graph = buildDecisionGraph(records, 'test-project');
    
    // The sample has "No, stop looking at the auth service" — should be detected as correction
    expect(graph.metrics.userCorrectionCount).toBeGreaterThanOrEqual(1);
  });

  it('tracks files touched', () => {
    const records = parseJSONL(join(FIXTURES, 'sample-session.jsonl'));
    const graph = buildDecisionGraph(records, 'test-project');
    
    // Should have tracked files from Read and Edit tool calls
    const allFiles = graph.nodes.flatMap(n => n.filesTouched);
    expect(allFiles).toContain('src/middleware/auth.ts');
    expect(allFiles).toContain('src/services/auth.service.ts');
  });

  it('identifies resolution files vs false leads', () => {
    const records = parseJSONL(join(FIXTURES, 'sample-session.jsonl'));
    const graph = buildDecisionGraph(records, 'test-project');
    
    // The resolution was in middleware, the service files were false leads
    expect(graph.metrics.filesModifiedAsResolution).toContain('src/middleware/auth.ts');
    // auth.service.ts and token.service.ts were investigated but not the resolution
    expect(graph.metrics.filesInvestigatedNotResolution.length).toBeGreaterThan(0);
  });

  it('computes session metrics', () => {
    const records = parseJSONL(join(FIXTURES, 'sample-session.jsonl'));
    const graph = buildDecisionGraph(records, 'test-project');
    
    expect(graph.metrics.totalToolCalls).toBeGreaterThan(0);
    expect(graph.metrics.durationSeconds).toBeGreaterThan(0);
    expect(graph.summary).toBe('Fixed auth middleware bug causing 401 errors on protected routes');
  });
});
