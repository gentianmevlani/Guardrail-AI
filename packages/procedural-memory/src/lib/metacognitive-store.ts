/**
 * Metacognitive Store
 * ===================
 * Persistence layer for metacognitive data: fingerprints, reflections,
 * temporal profiles, and transfer indices.
 *
 * Stored alongside decision graphs in ~/.procedural-memory/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { MetacognitiveStore } from '../types/metacognition';

const STORE_FILE = 'metacognitive-store.json';
const SCHEMA_VERSION = 1;

export function metacognitiveStorePath(dataDir: string): string {
  return join(dataDir, STORE_FILE);
}

export function loadMetacognitiveStore(dataDir: string): MetacognitiveStore | null {
  const p = metacognitiveStorePath(dataDir);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8')) as MetacognitiveStore;
    if (data.schemaVersion !== SCHEMA_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveMetacognitiveStore(dataDir: string, store: MetacognitiveStore): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(metacognitiveStorePath(dataDir), JSON.stringify(store, null, 2));
}

export function emptyMetacognitiveStore(): MetacognitiveStore {
  return {
    schemaVersion: SCHEMA_VERSION,
    fingerprint: {
      computedAt: new Date().toISOString(),
      totalSessions: 0,
      dimensions: [],
      taskProfiles: [],
      toolProfiles: [],
      strengths: [],
      weaknesses: [],
      blindSpots: [],
      signatureMoves: [],
    },
    reflections: [],
    transferIndex: {
      computedAt: new Date().toISOString(),
      patterns: [],
      projectSimilarity: [],
    },
    temporalProfile: {
      computedAt: new Date().toISOString(),
      trajectories: [],
      overallLearningRate: 0,
      daysSinceLastBreakthrough: -1,
      prediction: 'No data yet',
    },
    recentIntents: [],
  };
}
