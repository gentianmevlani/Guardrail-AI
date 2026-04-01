/**
 * Semantic Code Search Module
 * Embeds code chunks for natural language queries
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Simple TF-IDF vectorizer for semantic search
 * In production, would use OpenAI embeddings or similar
 */
class SimpleVectorizer {
  constructor() {
    this.vocabulary = new Map();
    this.idf = new Map();
    this.documents = [];
  }
  
  /**
   * Tokenize text into words
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 2);
  }
  
  /**
   * Build vocabulary from documents
   */
  fit(documents) {
    this.documents = documents;
    const docCount = documents.length;
    const docFreq = new Map();
    
    // Count document frequency for each term
    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }
    
    // Calculate IDF
    for (const [term, freq] of docFreq) {
      this.idf.set(term, Math.log(docCount / freq));
      this.vocabulary.set(term, this.vocabulary.size);
    }
  }
  
  /**
   * Transform document to TF-IDF vector
   */
  transform(text) {
    const tokens = this.tokenize(text);
    const tf = new Map();
    
    // Count term frequency
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    
    // Create vector
    const vector = new Array(this.vocabulary.size).fill(0);
    for (const [term, count] of tf) {
      if (this.vocabulary.has(term)) {
        const idx = this.vocabulary.get(term);
        vector[idx] = (count / tokens.length) * this.idf.get(term);
      }
    }
    
    return vector;
  }
  
  /**
   * Calculate cosine similarity between vectors
   */
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

/**
 * Find files recursively
 */
function findFiles(dir, extensions, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) return [];
  
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findFiles(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

/**
 * Extract code chunks with context
 */
function extractCodeChunks(filePath, maxSize = 1000) {
  const chunks = [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    
    // Extract functions, classes, and important blocks
    let currentChunk = [];
    let startLine = 0;
    let inFunction = false;
    let inClass = false;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);
      
      // Detect function/class start
      if (line.match(/^(function|class|export\s+(function|class)|const\s+\w+\s*=|async\s+function)/)) {
        startLine = i;
        inFunction = true;
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      }
      
      // Track braces for function boundaries
      if (inFunction) {
        braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        
        if (braceCount <= 0 || line.trim().endsWith("}") || line.trim().endsWith("});")) {
          // End of function
          const chunkText = currentChunk.join("\n");
          if (chunkText.length < maxSize) {
            chunks.push({
              text: chunkText,
              file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
              startLine: startLine + 1,
              endLine: i + 1,
              type: "function",
            });
          }
          currentChunk = [];
          inFunction = false;
          braceCount = 0;
        }
      }
      
      // Split large chunks
      if (currentChunk.length > 50) {
        const chunkText = currentChunk.join("\n");
        if (chunkText.length < maxSize) {
          chunks.push({
            text: chunkText,
            file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
            startLine: startLine + 1,
            endLine: i + 1,
            type: "block",
          });
        }
        currentChunk = [];
        startLine = i + 1;
      }
    }
    
    // Add remaining chunk if significant
    if (currentChunk.length > 5) {
      const chunkText = currentChunk.join("\n");
      if (chunkText.length < maxSize) {
        chunks.push({
          text: chunkText,
          file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
          startLine: startLine + 1,
          endLine: lines.length,
          type: "block",
        });
      }
    }
  } catch {}
  
  return chunks;
}

/**
 * Build semantic search index
 */
function buildSearchIndex(projectPath) {
  const files = findFiles(projectPath, [".ts", ".tsx", ".js", ".jsx"], 5);
  const chunks = [];
  
  // Extract code chunks
  for (const file of files) {
    const fileChunks = extractCodeChunks(file);
    chunks.push(...fileChunks);
  }
  
  // Create vectorizer and fit
  const vectorizer = new SimpleVectorizer();
  const documents = chunks.map(c => c.text);
  vectorizer.fit(documents);
  
  // Create embeddings
  const embeddings = chunks.map((chunk, idx) => ({
    ...chunk,
    vector: vectorizer.transform(chunk.text),
    id: crypto.createHash("md5").update(chunk.text).digest("hex").slice(0, 8),
  }));
  
  return {
    vectorizer,
    embeddings,
    totalChunks: chunks.length,
    totalFiles: files.length,
  };
}

/**
 * Search code semantically
 */
function semanticSearch(index, query, limit = 10) {
  const queryVector = index.vectorizer.transform(query);
  const results = [];
  
  for (const embedding of index.embeddings) {
    const similarity = index.vectorizer.cosineSimilarity(queryVector, embedding.vector);
    if (similarity > 0.1) { // Threshold
      results.push({
        ...embedding,
        similarity,
      });
    }
  }
  
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Save search index
 */
function saveSearchIndex(projectPath, index) {
  const guardrailDir = path.join(projectPath, ".guardrail");
  if (!fs.existsSync(guardrailDir)) {
    fs.mkdirSync(guardrailDir, { recursive: true });
  }
  
  const indexData = {
    version: "1.0.0",
    created: new Date().toISOString(),
    totalChunks: index.totalChunks,
    totalFiles: index.totalFiles,
    vocabulary: Array.from(index.vectorizer.vocabulary.keys()),
    idf: Object.fromEntries(index.vectorizer.idf),
    embeddings: index.embeddings.map(e => ({
      id: e.id,
      file: e.file,
      startLine: e.startLine,
      endLine: e.endLine,
      type: e.type,
      vector: e.vector,
    })),
  };
  
  fs.writeFileSync(
    path.join(guardrailDir, "semantic-index.json"),
    JSON.stringify(indexData, null, 2)
  );
}

/**
 * Load search index
 */
function loadSearchIndex(projectPath) {
  const indexPath = path.join(projectPath, ".guardrail", "semantic-index.json");
  
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    
    // Reconstruct vectorizer
    const vectorizer = new SimpleVectorizer();
    data.vocabulary.forEach((term, idx) => {
      vectorizer.vocabulary.set(term, idx);
    });
    vectorizer.idf = new Map(Object.entries(data.idf));
    
    return {
      vectorizer,
      embeddings: data.embeddings,
      totalChunks: data.totalChunks,
      totalFiles: data.totalFiles,
    };
  } catch {
    return null;
  }
}

/**
 * Generate semantic search report
 */
function generateSearchReport(results, query) {
  let report = `# Semantic Search Results\n\n`;
  report += `Query: "${query}"\n`;
  report += `Found: ${results.length} results\n\n`;
  
  for (const result of results) {
    report += `## ${result.file}:${result.startLine}-${result.endLine}\n`;
    report += `**Similarity:** ${(result.similarity * 100).toFixed(1)}%\n`;
    report += `**Type:** ${result.type}\n\n`;
    report += `\`\`\`${path.extname(result.file).slice(1)}\n`;
    report += result.text.split("\n").slice(0, 10).join("\n");
    if (result.text.split("\n").length > 10) {
      report += "\n...";
    }
    report += "\n\`\`\`\n\n";
  }
  
  return report;
}

module.exports = {
  buildSearchIndex,
  semanticSearch,
  saveSearchIndex,
  loadSearchIndex,
  generateSearchReport,
  SimpleVectorizer,
};
