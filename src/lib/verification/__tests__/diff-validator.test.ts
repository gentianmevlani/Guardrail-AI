/**
 * Diff Validator Tests
 */

import { validateDiffStructure, parseDiff, getFilesFromDiff } from '../checks/diff-validator';

describe('validateDiffStructure', () => {
  const validDiff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 import { app } from './app';
+import { logger } from './logger';

 app.listen(3000);`;

  it('should accept valid unified diff', () => {
    const result = validateDiffStructure(validDiff);
    expect(result.status).toBe('pass');
  });

  it('should reject empty diff', () => {
    const result = validateDiffStructure('');
    expect(result.status).toBe('fail');
    expect(result.message).toContain('empty');
  });

  it('should reject diff without header', () => {
    const result = validateDiffStructure(`--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('diff header');
  });

  it('should reject diff without hunk header', () => {
    const result = validateDiffStructure(`diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
-old
+new`);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('hunk header');
  });

  it('should reject diff without file markers', () => {
    const result = validateDiffStructure(`diff --git a/file.ts b/file.ts
@@ -1 +1 @@
-old
+new`);
    expect(result.status).toBe('fail');
  });

  it('should accept multi-file diff', () => {
    const multiFileDiff = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1 +1 @@
-old1
+new1
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1 +1 @@
-old2
+new2`;
    const result = validateDiffStructure(multiFileDiff);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 file');
  });
});

describe('parseDiff', () => {
  it('should parse file paths correctly', () => {
    const diff = `diff --git a/src/utils/helper.ts b/src/utils/helper.ts
--- a/src/utils/helper.ts
+++ b/src/utils/helper.ts
@@ -1 +1,2 @@
 export const helper = () => {};
+export const newHelper = () => {};`;

    const parsed = parseDiff(diff);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].path).toBe('src/utils/helper.ts');
  });

  it('should count additions and deletions', () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
-deleted
+added1
+added2
 line3`;

    const parsed = parseDiff(diff);
    expect(parsed.totalAdditions).toBe(2);
    expect(parsed.totalDeletions).toBe(1);
    expect(parsed.files[0].additions).toBe(2);
    expect(parsed.files[0].deletions).toBe(1);
  });

  it('should handle new file', () => {
    const diff = `diff --git a/new-file.ts b/new-file.ts
--- /dev/null
+++ b/new-file.ts
@@ -0,0 +1,3 @@
+line1
+line2
+line3`;

    const parsed = parseDiff(diff);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.totalAdditions).toBe(3);
    expect(parsed.totalDeletions).toBe(0);
  });

  it('should handle renamed file', () => {
    const diff = `diff --git a/old-name.ts b/new-name.ts
--- a/old-name.ts
+++ b/new-name.ts
@@ -1 +1 @@
-old content
+new content`;

    const parsed = parseDiff(diff);
    expect(parsed.files[0].path).toBe('new-name.ts');
    expect(parsed.files[0].oldPath).toBe('old-name.ts');
  });

  it('should parse multiple hunks', () => {
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line1
-old1
+new1
 line3
@@ -10,3 +10,3 @@
 line10
-old2
+new2
 line12`;

    const parsed = parseDiff(diff);
    expect(parsed.files[0].hunks).toHaveLength(2);
  });
});

describe('getFilesFromDiff', () => {
  it('should extract file paths', () => {
    const diff = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-a
+b
diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1 +1 @@
-c
+d`;

    const files = getFilesFromDiff(diff);
    expect(files).toEqual(['src/a.ts', 'src/b.ts']);
  });
});
