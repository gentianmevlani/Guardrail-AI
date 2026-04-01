/**
 * Vector Store
 * 
 * Efficient storage and retrieval of embeddings for massive codebases
 * Supports multiple backends: in-memory, file-based, or external (Pinecone, Weaviate, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';
import { embeddingService } from './embedding-service';

export interface VectorDocument {
  id: string;
  file: string;
  code: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  filter?: (doc: VectorDocument) => boolean;
}

export interface VectorStoreBackend {
  add(doc: VectorDocument): Promise<void>;
  addBatch(docs: VectorDocument[]): Promise<void>;
  search(queryEmbedding: number[], options?: VectorSearchOptions): Promise<VectorDocument[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

/**
 * File-based vector store (for massive repos)
 */
class FileVectorStore implements VectorStoreBackend {
  private storeDir: string;
  private index: Map<string, string> = new Map(); // id -> file path
  private chunkSize = 1000; // Documents per file

  constructor(storeDir: string = '.guardrail-vectors') {
    this.storeDir = storeDir;
  }

  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.storeDir, { recursive: true });
    await this.loadIndex();
  }

  async add(doc: VectorDocument): Promise<void> {
    const chunkIndex = Math.floor(this.index.size / this.chunkSize);
    const chunkFile = path.join(this.storeDir, `chunk-${chunkIndex}.json`);

    // Load or create chunk
    let chunk: VectorDocument[] = [];
    if (await this.pathExists(chunkFile)) {
      const content = await fs.promises.readFile(chunkFile, 'utf8');
      chunk = JSON.parse(content);
    }

    // Add document
    chunk.push(doc);
    this.index.set(doc.id, chunkFile);

    // Save chunk
    await fs.promises.writeFile(chunkFile, JSON.stringify(chunk, null, 2));

    // Save index
    await this.saveIndex();
  }

  async addBatch(docs: VectorDocument[]): Promise<void> {
    // Group by chunk
    const chunks = new Map<number, VectorDocument[]>();
    
    for (const doc of docs) {
      const chunkIndex = Math.floor(this.index.size / this.chunkSize);
      if (!chunks.has(chunkIndex)) {
        chunks.set(chunkIndex, []);
      }
      chunks.get(chunkIndex)!.push(doc);
      this.index.set(doc.id, `chunk-${chunkIndex}.json`);
    }

    // Save chunks in parallel
    await Promise.all(
      Array.from(chunks.entries()).map(async ([chunkIndex, chunkDocs]) => {
        const chunkFile = path.join(this.storeDir, `chunk-${chunkIndex}.json`);
        await fs.promises.writeFile(chunkFile, JSON.stringify(chunkDocs, null, 2));
      })
    );

    await this.saveIndex();
  }

  async search(
    queryEmbedding: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorDocument[]> {
    const { limit = 10, threshold = 0.5, filter } = options;
    const results: Array<{ doc: VectorDocument; similarity: number }> = [];

    // Search all chunks
    const chunkFiles = new Set(this.index.values());
    
    for (const chunkFile of chunkFiles) {
      const fullPath = path.join(this.storeDir, chunkFile);
      if (!await this.pathExists(fullPath)) continue;

      const content = await fs.promises.readFile(fullPath, 'utf8');
      const chunk: VectorDocument[] = JSON.parse(content);

      for (const doc of chunk) {
        if (filter && !filter(doc)) continue;

        const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
        if (similarity >= threshold) {
          results.push({ doc, similarity });
        }
      }
    }

    // Sort by similarity and return top results
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit).map(r => r.doc);
  }

  async delete(id: string): Promise<void> {
    const chunkFile = this.index.get(id);
    if (!chunkFile) return;

    const fullPath = path.join(this.storeDir, chunkFile);
    if (await this.pathExists(fullPath)) {
      const content = await fs.promises.readFile(fullPath, 'utf8');
      const chunk: VectorDocument[] = JSON.parse(content);
      const filtered = chunk.filter(doc => doc.id !== id);
      await fs.promises.writeFile(fullPath, JSON.stringify(filtered, null, 2));
    }

    this.index.delete(id);
    await this.saveIndex();
  }

  async clear(): Promise<void> {
    const files = await fs.promises.readdir(this.storeDir);
    await Promise.all(
      files.map(file => fs.promises.unlink(path.join(this.storeDir, file)))
    );
    this.index.clear();
    await this.saveIndex();
  }

  async size(): Promise<number> {
    return this.index.size;
  }

  private async loadIndex(): Promise<void> {
    const indexFile = path.join(this.storeDir, 'index.json');
    if (await this.pathExists(indexFile)) {
      const content = await fs.promises.readFile(indexFile, 'utf8');
      const index = JSON.parse(content);
      this.index = new Map(Object.entries(index));
    }
  }

  private async saveIndex(): Promise<void> {
    const indexFile = path.join(this.storeDir, 'index.json');
    const indexObj = Object.fromEntries(this.index);
    await fs.promises.writeFile(indexFile, JSON.stringify(indexObj, null, 2));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * In-memory vector store (for smaller repos)
 */
class MemoryVectorStore implements VectorStoreBackend {
  private documents: Map<string, VectorDocument> = new Map();

  async add(doc: VectorDocument): Promise<void> {
    this.documents.set(doc.id, doc);
  }

  async addBatch(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      this.documents.set(doc.id, doc);
    }
  }

  async search(
    queryEmbedding: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorDocument[]> {
    const { limit = 10, threshold = 0.5, filter } = options;
    const results: Array<{ doc: VectorDocument; similarity: number }> = [];

    for (const doc of this.documents.values()) {
      if (filter && !filter(doc)) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
      if (similarity >= threshold) {
        results.push({ doc, similarity });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit).map(r => r.doc);
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async clear(): Promise<void> {
    this.documents.clear();
  }

  async size(): Promise<number> {
    return this.documents.size;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

/**
 * Vector Store Manager
 */
class VectorStoreManager {
  private store: VectorStoreBackend;
  private useFileStore: boolean;

  constructor(useFileStore: boolean = true) {
    this.useFileStore = useFileStore;
    this.store = useFileStore
      ? new FileVectorStore()
      : new MemoryVectorStore();
  }

  async initialize(): Promise<void> {
    if (this.store instanceof FileVectorStore) {
      await this.store.initialize();
    }
  }

  async indexCodebase(
    projectPath: string,
    files: string[],
    batchSize: number = 100
  ): Promise<void> {
    const batches: VectorDocument[] = [];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const embedding = await embeddingService.generateEmbedding(content);

        batches.push({
          id: path.relative(projectPath, file),
          file: path.relative(projectPath, file),
          code: content.substring(0, 1000), // Store first 1000 chars
          embedding,
          metadata: {
            size: content.length,
            lines: content.split('\n').length,
          },
        });

        // Batch insert
        if (batches.length >= batchSize) {
          await this.store.addBatch(batches);
          batches.length = 0;
        }
      } catch {
        // Skip file
      }
    }

    // Insert remaining
    if (batches.length > 0) {
      await this.store.addBatch(batches);
    }
  }

  async search(
    query: string,
    options?: VectorSearchOptions
  ): Promise<VectorDocument[]> {
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    return this.store.search(queryEmbedding, options);
  }

  getStore(): VectorStoreBackend {
    return this.store;
  }
}

export const vectorStoreManager = new VectorStoreManager(true);

