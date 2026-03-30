/**
 * Diff Validator Check
 * Validates unified diff structure and extracts file information
 */

import { CheckResult, ParsedDiff, DiffFile, DiffHunk } from '../types';

/**
 * Parse a unified diff string into structured data
 */
export function parseDiff(diffStr: string): ParsedDiff {
  const files: DiffFile[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;

  // Split by file headers
  const fileChunks = diffStr.split(/^diff --git /m).filter(Boolean);

  for (const chunk of fileChunks) {
    const lines = chunk.split('\n');
    if (lines.length === 0) continue;

    // Parse file path from first line: a/path b/path
    const headerMatch = lines[0].match(/a\/(.+?)\s+b\/(.+)/);
    if (!headerMatch) continue;

    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];
    const isRename = oldPath !== newPath;

    const file: DiffFile = {
      path: newPath,
      oldPath: isRename ? oldPath : undefined,
      additions: 0,
      deletions: 0,
      hunks: [],
    };

    // Find hunks
    let currentHunk: DiffHunk | null = null;
    let hunkContent: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
      const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        // Save previous hunk if exists
        if (currentHunk) {
          currentHunk.content = hunkContent.join('\n');
          file.hunks.push(currentHunk);
        }

        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldLines: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newLines: parseInt(hunkMatch[4] || '1', 10),
          content: '',
        };
        hunkContent = [line];
        continue;
      }

      if (currentHunk) {
        hunkContent.push(line);

        if (line.startsWith('+') && !line.startsWith('+++')) {
          file.additions++;
          totalAdditions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          file.deletions++;
          totalDeletions++;
        }
      }
    }

    // Save last hunk
    if (currentHunk) {
      currentHunk.content = hunkContent.join('\n');
      file.hunks.push(currentHunk);
    }

    files.push(file);
  }

  return {
    files,
    totalAdditions,
    totalDeletions,
    totalFiles: files.length,
  };
}

/**
 * Validate diff structure
 */
export function validateDiffStructure(diff: string): CheckResult {
  if (!diff || typeof diff !== 'string') {
    return {
      check: 'diff-structure',
      status: 'fail',
      message: 'Diff is empty or not a string',
      suggestedFix: 'Provide a valid unified diff',
    };
  }

  const trimmed = diff.trim();
  if (trimmed.length === 0) {
    return {
      check: 'diff-structure',
      status: 'fail',
      message: 'Diff is empty',
      suggestedFix: 'Provide a non-empty unified diff',
    };
  }

  // Check for required diff markers
  const hasDiffHeader = trimmed.includes('diff --git') || trimmed.includes('diff -');
  const hasOldMarker = trimmed.includes('---');
  const hasNewMarker = trimmed.includes('+++');
  const hasHunk = /@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(trimmed);

  const missing: string[] = [];
  if (!hasDiffHeader) missing.push('diff header (diff --git)');
  if (!hasOldMarker) missing.push('old file marker (---)');
  if (!hasNewMarker) missing.push('new file marker (+++)');
  if (!hasHunk) missing.push('hunk header (@@ ... @@)');

  if (missing.length > 0) {
    return {
      check: 'diff-structure',
      status: 'fail',
      message: `Invalid diff structure: missing ${missing.join(', ')}`,
      suggestedFix: 'Ensure the diff includes all required unified diff components',
      details: `A valid unified diff must include:\n- File headers (diff --git a/path b/path)\n- Old file marker (--- a/path)\n- New file marker (+++ b/path)\n- Hunk headers (@@ -start,count +start,count @@)`,
    };
  }

  // Parse and validate
  const parsed = parseDiff(trimmed);

  if (parsed.files.length === 0) {
    return {
      check: 'diff-structure',
      status: 'fail',
      message: 'No files found in diff',
      suggestedFix: 'Ensure the diff contains at least one file change',
    };
  }

  // Check for empty hunks
  for (const file of parsed.files) {
    if (file.hunks.length === 0) {
      return {
        check: 'diff-structure',
        status: 'fail',
        message: `File ${file.path} has no hunks`,
        file: file.path,
        suggestedFix: 'Each file in the diff must have at least one hunk with changes',
      };
    }
  }

  return {
    check: 'diff-structure',
    status: 'pass',
    message: `Valid diff with ${parsed.totalFiles} file(s), +${parsed.totalAdditions}/-${parsed.totalDeletions} lines`,
    details: parsed.files.map(f => `${f.path}: +${f.additions}/-${f.deletions}`).join('\n'),
  };
}

/**
 * Get list of files from diff
 */
export function getFilesFromDiff(diff: string): string[] {
  const parsed = parseDiff(diff);
  return parsed.files.map(f => f.path);
}

/**
 * Get detailed file info from diff
 */
export function getDiffFileInfo(diff: string): DiffFile[] {
  const parsed = parseDiff(diff);
  return parsed.files;
}
