import { describe, it, expect } from 'vitest';
import { join } from 'path';
import {
  decodeClaudeProjectSlug,
  claudeProjectDirFromTranscript,
  projectPathFromTranscript,
} from '../src/lib/claude-project';

describe('claude-project', () => {
  it('decodes Claude projects slug', () => {
    expect(decodeClaudeProjectSlug('-Users-gee-app')).toBe('/Users/gee/app');
  });

  it('resolves project dir from main session transcript', () => {
    const tp = join('/home', 'u', '.claude', 'projects', '-Users-u-app', '550e8400-e29b-41d4-a716-446655440000.jsonl');
    expect(claudeProjectDirFromTranscript(tp)).toContain('-Users-u-app');
    expect(projectPathFromTranscript(tp)).toBe('/Users/u/app');
  });

  it('resolves project dir from subagent transcript', () => {
    const tp = join(
      '/home',
      'u',
      '.claude',
      'projects',
      '-Users-u-app',
      'subagents',
      'agent-abc.jsonl'
    );
    const dir = claudeProjectDirFromTranscript(tp);
    expect(dir).toContain('-Users-u-app');
    expect(dir).not.toContain('subagents');
  });
});
