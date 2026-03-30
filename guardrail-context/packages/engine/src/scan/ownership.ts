import { execSync } from "node:child_process";
import path from "node:path";

export type FileOwnership = {
  file: string;
  primaryOwner: string;
  contributors: Array<{ name: string; commits: number; percentage: number }>;
  lastModified: string;
  lastModifiedBy: string;
};

export type OwnershipMap = {
  files: Record<string, FileOwnership>;
  byOwner: Record<string, string[]>;
  summary: {
    totalFiles: number;
    uniqueContributors: number;
    topContributors: Array<{ name: string; files: number }>;
  };
};

export async function scanOwnership(repoRoot: string, files: string[]): Promise<OwnershipMap> {
  const ownership: Record<string, FileOwnership> = {};
  const byOwner: Record<string, string[]> = {};
  const contributorCounts: Record<string, number> = {};

  // Only scan git-tracked source files
  const sourceFiles = files.filter(f => 
    /\.(ts|tsx|js|jsx|py|go|rs|java|rb)$/.test(f) &&
    !f.includes("node_modules") &&
    !f.includes(".git")
  ).slice(0, 500); // Limit for performance

  for (const file of sourceFiles) {
    try {
      const relPath = path.relative(repoRoot, file);
      const fileOwnership = getFileOwnership(repoRoot, relPath);
      
      if (fileOwnership) {
        ownership[relPath] = fileOwnership;
        
        // Track by owner
        const owner = fileOwnership.primaryOwner;
        if (!byOwner[owner]) byOwner[owner] = [];
        byOwner[owner].push(relPath);
        
        // Count files per contributor
        for (const contrib of fileOwnership.contributors) {
          contributorCounts[contrib.name] = (contributorCounts[contrib.name] || 0) + 1;
        }
      }
    } catch {
      // Skip files with git blame errors
    }
  }

  // Sort contributors by file count
  const topContributors = Object.entries(contributorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, files]) => ({ name, files }));

  return {
    files: ownership,
    byOwner,
    summary: {
      totalFiles: Object.keys(ownership).length,
      uniqueContributors: Object.keys(contributorCounts).length,
      topContributors
    }
  };
}

function getFileOwnership(repoRoot: string, relPath: string): FileOwnership | null {
  try {
    // Get git blame statistics
    const blameOutput = execSync(
      `git blame --line-porcelain "${relPath}" 2>nul`,
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );

    const authorCounts: Record<string, number> = {};
    let lastAuthor = "";
    let lastTime = 0;
    let totalLines = 0;

    const lines = blameOutput.split("\n");
    for (const line of lines) {
      if (line.startsWith("author ")) {
        const author = line.substring(7).trim();
        authorCounts[author] = (authorCounts[author] || 0) + 1;
        totalLines++;
      } else if (line.startsWith("author-time ")) {
        const time = parseInt(line.substring(12));
        if (time > lastTime) {
          lastTime = time;
          // Get the author from the previous line context
          const prevAuthorLine = lines[lines.indexOf(line) - 1];
          if (prevAuthorLine?.startsWith("author ")) {
            lastAuthor = prevAuthorLine.substring(7).trim();
          }
        }
      }
    }

    if (totalLines === 0) return null;

    // Sort by contribution
    const sorted = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1]);

    const contributors = sorted.map(([name, commits]) => ({
      name,
      commits,
      percentage: Math.round((commits / totalLines) * 100)
    }));

    return {
      file: relPath,
      primaryOwner: sorted[0]?.[0] || "unknown",
      contributors,
      lastModified: new Date(lastTime * 1000).toISOString(),
      lastModifiedBy: lastAuthor || sorted[0]?.[0] || "unknown"
    };
  } catch {
    return null;
  }
}

export function getFileOwner(ownership: OwnershipMap, file: string): string | null {
  const normalizedFile = file.replace(/\\/g, "/");
  const entry = ownership.files[normalizedFile] || ownership.files[file];
  return entry?.primaryOwner || null;
}

export function getOwnerFiles(ownership: OwnershipMap, owner: string): string[] {
  return ownership.byOwner[owner] || [];
}
