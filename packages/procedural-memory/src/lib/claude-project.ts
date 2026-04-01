/**
 * Claude Code project directory encoding helpers.
 * Project folders under ~/.claude/projects/ use a slug: -Users-foo-bar-baz
 */

import { basename, dirname } from 'path';

/**
 * Decode a Claude projects directory basename into a filesystem path string.
 * Example: `-Users-gee-vibecheck` → `/Users/gee/vibecheck`
 */
export function decodeClaudeProjectSlug(slug: string): string {
  return slug.replace(/^-/, '/').replace(/-/g, '/');
}

/**
 * Given a session transcript path, return the enclosing Claude "project" directory
 * (the folder under ~/.claude/projects/<slug>/).
 */
export function claudeProjectDirFromTranscript(transcriptPath: string): string {
  let dir = dirname(transcriptPath);
  if (dir.endsWith('/subagents') || dir.endsWith('\\subagents')) {
    dir = dirname(dir);
  }
  return dir;
}

/**
 * Decoded project path from a transcript file path (matches graph.project from full analyze).
 */
export function projectPathFromTranscript(transcriptPath: string): string {
  const projectDir = claudeProjectDirFromTranscript(transcriptPath);
  return decodeClaudeProjectSlug(basename(projectDir));
}
