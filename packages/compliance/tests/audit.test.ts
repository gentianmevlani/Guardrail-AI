/**
 * Audit Trail Tests
 * 
 * Tests for the comprehensive audit logging system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  createAuditEvent,
  computeEventHash,
  verifyEventHash,
  redactSensitive,
  redactMetadataForTier,
  AuditEventInput,
  AuditActions,
} from '../src/audit/events';
import {
  LocalJSONLStorage,
  AuditChainValidation,
} from '../src/audit/storage';

const TEST_DIR = path.join(__dirname, '.test-audit');
const AUDIT_FILE = path.join(TEST_DIR, '.guardrail', 'audit', 'audit.log.jsonl');

/** Placeholder prefix built at runtime (GitHub push protection). */
const STRIPE_LIVE_PREFIX = String.fromCharCode(
  115, 107, 95, 108, 105, 118, 101, 95,
);

describe('Audit Events', () => {
  describe('createAuditEvent', () => {
    it('should create a valid audit event with hash chain', () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user', name: 'Test User' },
        surface: 'cli',
        action: AuditActions.SCAN_START,
        category: 'scan',
        target: { type: 'project', path: '/test/project' },
        tier: 'compliance',
        result: 'success',
        metadata: { command: 'scan', projectPath: '/test/project' },
      };

      const event = createAuditEvent(input);

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.actor.id).toBe('user-1');
      expect(event.surface).toBe('cli');
      expect(event.action).toBe('scan.start');
      expect(event.category).toBe('scan');
      expect(event.result).toBe('success');
      expect(event.hash).toBeDefined();
      expect(event.prevHash).toBe('0'.repeat(64)); // Genesis hash
      expect(event.version).toBe(1);
    });

    it('should chain events with previous hash', () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user' },
        surface: 'cli',
        action: AuditActions.SCAN_START,
        category: 'scan',
        target: { type: 'project', path: '/test' },
        tier: 'compliance',
        result: 'success',
      };

      const event1 = createAuditEvent(input);
      const event2 = createAuditEvent(input, event1.hash);

      expect(event2.prevHash).toBe(event1.hash);
      expect(event2.hash).not.toBe(event1.hash);
    });
  });

  describe('computeEventHash', () => {
    it('should produce consistent hashes for same input', () => {
      const event = {
        id: 'test-id',
        timestamp: '2026-01-08T00:00:00.000Z',
        actor: { id: 'user-1', type: 'user' as const },
        surface: 'cli' as const,
        action: 'test.action',
        category: 'scan' as const,
        target: { type: 'project' },
        tier: 'compliance' as const,
        result: 'success' as const,
        metadata: undefined,
        prevHash: '0'.repeat(64),
        version: 1 as const,
      };

      const hash1 = computeEventHash(event);
      const hash2 = computeEventHash(event);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('should produce different hashes for different inputs', () => {
      const event1 = {
        id: 'test-id-1',
        timestamp: '2026-01-08T00:00:00.000Z',
        actor: { id: 'user-1', type: 'user' as const },
        surface: 'cli' as const,
        action: 'test.action',
        category: 'scan' as const,
        target: { type: 'project' },
        tier: 'compliance' as const,
        result: 'success' as const,
        metadata: undefined,
        prevHash: '0'.repeat(64),
        version: 1 as const,
      };

      const event2 = { ...event1, id: 'test-id-2' };

      const hash1 = computeEventHash(event1);
      const hash2 = computeEventHash(event2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyEventHash', () => {
    it('should verify valid event hash', () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user' },
        surface: 'cli',
        action: AuditActions.SCAN_COMPLETE,
        category: 'scan',
        target: { type: 'project', path: '/test' },
        tier: 'compliance',
        result: 'success',
      };

      const event = createAuditEvent(input);
      expect(verifyEventHash(event)).toBe(true);
    });

    it('should detect tampered event', () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user' },
        surface: 'cli',
        action: AuditActions.SCAN_COMPLETE,
        category: 'scan',
        target: { type: 'project', path: '/test' },
        tier: 'compliance',
        result: 'success',
      };

      const event = createAuditEvent(input);
      // Tamper with the event
      event.result = 'failure';

      expect(verifyEventHash(event)).toBe(false);
    });
  });

  describe('redactSensitive', () => {
    it('should redact API keys', () => {
      const input = 'api_key=' + (STRIPE_LIVE_PREFIX + 'a'.repeat(32));
      const result = redactSensitive(input);
      expect(result).not.toContain(STRIPE_LIVE_PREFIX);
      expect(result).toContain('[REDACTED');
    });

    it('should redact JWT tokens', () => {
      const input = 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = redactSensitive(input);
      expect(result).not.toContain('eyJ');
    });

    it('should redact AWS keys', () => {
      const input = 'AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE';
      const result = redactSensitive(input);
      expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('should preserve non-sensitive data', () => {
      const input = 'project_path=/home/user/myproject';
      const result = redactSensitive(input);
      expect(result).toBe(input);
    });
  });

  describe('redactMetadataForTier', () => {
    const fullMetadata = {
      command: 'scan',
      args: ['--verbose'],
      score: 85,
      grade: 'B',
      issueCount: 3,
      fixCount: 2,
      projectPath: '/test/project',
      durationMs: 1234,
      errorCode: 'TEST_ERROR',
      errorMessage: 'Test error message',
      custom: { foo: 'bar' },
    };

    it('should return full metadata for compliance tier', () => {
      const result = redactMetadataForTier(fullMetadata, 'compliance');
      expect(result?.command).toBe('scan');
      expect(result?.args).toBeDefined();
      expect(result?.projectPath).toBeDefined();
      expect(result?.custom).toBeDefined();
    });

    it('should return limited metadata for pro tier', () => {
      const result = redactMetadataForTier(fullMetadata, 'pro');
      expect(result?.command).toBe('scan');
      expect(result?.score).toBe(85);
      expect(result?.grade).toBe('B');
      expect(result?.projectPath).toBeUndefined();
      expect(result?.custom).toBeUndefined();
    });

    it('should return minimal metadata for free tier', () => {
      const result = redactMetadataForTier(fullMetadata, 'free');
      expect(result?.score).toBe(85);
      expect(result?.grade).toBe('B');
      expect(result?.command).toBeUndefined();
      expect(result?.projectPath).toBeUndefined();
    });
  });
});

describe('Audit Storage', () => {
  let storage: LocalJSONLStorage;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    storage = new LocalJSONLStorage(TEST_DIR);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('append and read', () => {
    it('should append and read events', async () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user' },
        surface: 'cli',
        action: AuditActions.SCAN_START,
        category: 'scan',
        target: { type: 'project', path: '/test' },
        tier: 'compliance',
        result: 'success',
      };

      const prevHash = await storage.getLastHash();
      const event = createAuditEvent(input, prevHash);
      await storage.append(event);

      const events = await storage.read();
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(event.id);
    });

    it('should maintain hash chain across multiple events', async () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user' },
        surface: 'cli',
        action: AuditActions.SCAN_START,
        category: 'scan',
        target: { type: 'project', path: '/test' },
        tier: 'compliance',
        result: 'success',
      };

      // Add 3 events
      for (let i = 0; i < 3; i++) {
        const prevHash = await storage.getLastHash();
        const event = createAuditEvent(input, prevHash);
        await storage.append(event);
      }

      const events = await storage.read();
      expect(events).toHaveLength(3);

      // Verify chain
      expect(events[0].prevHash).toBe('0'.repeat(64));
      expect(events[1].prevHash).toBe(events[0].hash);
      expect(events[2].prevHash).toBe(events[1].hash);
    });
  });

  describe('tail', () => {
    it('should return last N events', async () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user' },
        surface: 'cli',
        action: AuditActions.SCAN_START,
        category: 'scan',
        target: { type: 'project', path: '/test' },
        tier: 'compliance',
        result: 'success',
      };

      // Add 5 events
      for (let i = 0; i < 5; i++) {
        const prevHash = await storage.getLastHash();
        const event = createAuditEvent(input, prevHash);
        await storage.append(event);
      }

      const lastTwo = await storage.tail(2);
      expect(lastTwo).toHaveLength(2);

      const allEvents = await storage.read();
      expect(lastTwo[0].id).toBe(allEvents[3].id);
      expect(lastTwo[1].id).toBe(allEvents[4].id);
    });
  });

  describe('validateChain', () => {
    it('should validate intact chain', async () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user' },
        surface: 'cli',
        action: AuditActions.SCAN_START,
        category: 'scan',
        target: { type: 'project', path: '/test' },
        tier: 'compliance',
        result: 'success',
      };

      // Add 3 events
      for (let i = 0; i < 3; i++) {
        const prevHash = await storage.getLastHash();
        const event = createAuditEvent(input, prevHash);
        await storage.append(event);
      }

      const validation = await storage.validateChain();
      expect(validation.valid).toBe(true);
      expect(validation.totalEvents).toBe(3);
      expect(validation.validEvents).toBe(3);
      expect(validation.invalidEvents).toBe(0);
      expect(validation.brokenLinks).toHaveLength(0);
      expect(validation.tamperedEvents).toHaveLength(0);
    });
  });

  describe('export', () => {
    it('should export as JSON', async () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user' },
        surface: 'cli',
        action: AuditActions.SCAN_START,
        category: 'scan',
        target: { type: 'project', path: '/test' },
        tier: 'compliance',
        result: 'success',
      };

      const prevHash = await storage.getLastHash();
      const event = createAuditEvent(input, prevHash);
      await storage.append(event);

      const json = await storage.export('json');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(event.id);
    });

    it('should export as CSV', async () => {
      const input: AuditEventInput = {
        actor: { id: 'user-1', type: 'user', name: 'Test User' },
        surface: 'cli',
        action: AuditActions.SCAN_START,
        category: 'scan',
        target: { type: 'project', path: '/test' },
        tier: 'compliance',
        result: 'success',
      };

      const prevHash = await storage.getLastHash();
      const event = createAuditEvent(input, prevHash);
      await storage.append(event);

      const csv = await storage.export('csv');
      expect(csv).toContain('id,timestamp,actor_id');
      expect(csv).toContain('user-1');
      expect(csv).toContain('cli');
      expect(csv).toContain('scan');
    });
  });
});
