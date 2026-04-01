/**
 * Consciousness Store — persistence layer for consciousness modules.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ConsciousnessStore } from '../types/consciousness';

const STORE_FILE = 'consciousness-store.json';
const SCHEMA_VERSION = 1;

export function consciousnessStorePath(dataDir: string): string {
  return join(dataDir, STORE_FILE);
}

export function loadConsciousnessStore(dataDir: string): ConsciousnessStore | null {
  const p = consciousnessStorePath(dataDir);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8')) as ConsciousnessStore;
    if (data.schemaVersion !== SCHEMA_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveConsciousnessStore(dataDir: string, store: ConsciousnessStore): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(consciousnessStorePath(dataDir), JSON.stringify(store, null, 2));
}

export function emptyConsciousnessStore(): ConsciousnessStore {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    identity: {
      updatedAt: now,
      selfNarrative: 'A new coding agent, still building its identity through experience.',
      episodes: [],
      traits: [],
      currentArc: {
        description: 'Beginning — building initial experience',
        startedAt: now,
        goal: 'Accumulate enough sessions to develop reliable patterns',
        progress: 0,
      },
      totalSessions: 0,
      ageDays: 0,
    },
    epistemicMap: {
      updatedAt: now,
      domains: [],
      connections: [],
      calibration: { highCertaintyAccuracy: 0, lowCertaintyMistakeRate: 0, sampleSize: 0 },
      activeFrontier: [],
    },
    userModel: {
      updatedAt: now,
      totalInteractions: 0,
      expertiseLevel: 'intermediate',
      expertiseDomains: [],
      learningDomains: [],
      style: {
        promptDetail: 'moderate',
        correctionStyle: 'neutral',
        explanatoryDepth: 'some-context',
        interventionFrequency: 'occasional',
        preferredResponseLength: 'moderate',
      },
      patience: 'moderate',
      correctionThreshold: 3,
      approvedBehaviors: [],
      rejectedBehaviors: [],
      recurringThemes: [],
      collaborationHealth: 0.5,
      collaborationTrend: 'stable',
    },
    somaticMarkers: [],
    phenomenology: {
      updatedAt: now,
      familiarityMap: [],
      noveltySignals: [],
      comfortZone: { paths: [], taskTypes: [], totalExperience: 0 },
      growthEdge: { paths: [], taskTypes: [], challengeLevel: 0 },
      currentMood: { valence: 0, arousal: 0.5, dominance: 0.5, description: 'Neutral — no data yet' },
    },
    lastDream: null,
    dreamHistory: [],
  };
}
