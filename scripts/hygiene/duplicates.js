/**
 * Duplicate File Detection Module
 *
 * Tier A: Exact duplicates (same hash)
 * Tier B: Near-duplicates (85%+ similar)
 * Tier C: Copy-pasted code blocks
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CONFIG = {
  codeExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  skipDirs: [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage",
    ".cache",
    "backup",
    ".guardrail",
    ".guardrail-demo", // Exclude backup and generated artifacts
  ],
  similarityThreshold: 0.85,
  minDuplicateLines: 10,
};

function getAllCodeFiles(projectPath) {
  const files = [];
  function walk(dir) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !CONFIG.skipDirs.includes(item)) {
          walk(fullPath);
        } else if (
          stat.isFile() &&
          CONFIG.codeExtensions.includes(path.extname(item))
        ) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      /* skip */
    }
  }
  walk(projectPath);
  return files;
}

function findExactDuplicates(projectPath) {
  const hashMap = new Map();
  const files = getAllCodeFiles(projectPath);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file);
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      if (!hashMap.has(hash)) hashMap.set(hash, []);
      hashMap
        .get(hash)
        .push({ path: path.relative(projectPath, file), size: content.length });
    } catch (err) {
      /* skip */
    }
  }

  const duplicates = [];
  for (const [hash, paths] of hashMap) {
    if (paths.length > 1) {
      duplicates.push({
        hash: hash.substring(0, 12),
        files: paths,
        totalWastedBytes: paths[0].size * (paths.length - 1),
        suggestion: "Delete duplicates, keep one canonical file",
      });
    }
  }
  return duplicates.sort((a, b) => b.totalWastedBytes - a.totalWastedBytes);
}

function normalizeContent(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "")
    .replace(/['"`]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function createFingerprint(content) {
  const fingerprints = new Set();
  const chunkSize = 50;
  for (let i = 0; i < content.length - chunkSize; i += 10) {
    const chunk = content.substring(i, i + chunkSize);
    fingerprints.add(
      crypto.createHash("md5").update(chunk).digest("hex").substring(0, 8),
    );
  }
  return fingerprints;
}

function calculateSimilarity(setA, setB) {
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function findNearDuplicates(projectPath) {
  const files = getAllCodeFiles(projectPath);
  const normalized = new Map();

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const norm = normalizeContent(content);
      if (norm.length > 100) {
        normalized.set(path.relative(projectPath, file), {
          normalized: norm,
          fingerprint: createFingerprint(norm),
        });
      }
    } catch (err) {
      /* skip */
    }
  }

  const nearDuplicates = [];
  const processed = new Set();
  const entries = Array.from(normalized.entries());

  for (let i = 0; i < entries.length; i++) {
    const [pathA, dataA] = entries[i];
    if (processed.has(pathA)) continue;

    const group = [pathA];
    for (let j = i + 1; j < entries.length; j++) {
      const [pathB, dataB] = entries[j];
      if (processed.has(pathB)) continue;

      const similarity = calculateSimilarity(
        dataA.fingerprint,
        dataB.fingerprint,
      );
      if (similarity >= CONFIG.similarityThreshold) {
        group.push(pathB);
        processed.add(pathB);
      }
    }

    if (group.length > 1) {
      processed.add(pathA);
      nearDuplicates.push({
        files: group,
        similarity: Math.round(
          calculateSimilarity(dataA.fingerprint, dataA.fingerprint) * 100,
        ),
        suggestion: "Consolidate into single module",
      });
    }
  }
  return nearDuplicates;
}

function findCopyPasteBlocks(projectPath) {
  const files = getAllCodeFiles(projectPath);
  const blockMap = new Map();

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      const relativePath = path.relative(projectPath, file);

      for (let i = 0; i <= lines.length - CONFIG.minDuplicateLines; i++) {
        const block = lines
          .slice(i, i + CONFIG.minDuplicateLines)
          .map((l) => l.trim())
          .filter(
            (l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("*"),
          )
          .join("\n");

        if (block.length > 50) {
          const blockHash = crypto
            .createHash("md5")
            .update(block)
            .digest("hex");
          if (!blockMap.has(blockHash)) blockMap.set(blockHash, []);

          const existing = blockMap.get(blockHash);
          if (
            !existing.some(
              (e) => e.file === relativePath && Math.abs(e.line - (i + 1)) < 5,
            )
          ) {
            existing.push({
              file: relativePath,
              line: i + 1,
              preview: lines
                .slice(i, i + 3)
                .join("\n")
                .substring(0, 100),
            });
          }
        }
      }
    } catch (err) {
      /* skip */
    }
  }

  const blocks = [];
  for (const [hash, locations] of blockMap) {
    if (locations.length > 1) {
      blocks.push({
        hash: hash.substring(0, 8),
        locations,
        totalDuplicatedLOC: CONFIG.minDuplicateLines * locations.length,
        suggestion: "Extract to shared function/module",
      });
    }
  }
  return blocks
    .sort((a, b) => b.totalDuplicatedLOC - a.totalDuplicatedLOC)
    .slice(0, 50);
}

function findDuplicates(projectPath) {
  return {
    exact: findExactDuplicates(projectPath),
    near: findNearDuplicates(projectPath),
    copyPaste: findCopyPasteBlocks(projectPath),
  };
}

module.exports = {
  findDuplicates,
  findExactDuplicates,
  findNearDuplicates,
  findCopyPasteBlocks,
  getAllCodeFiles,
  CONFIG,
};
