/**
 * Signed Audit Storage
 *
 * Enhanced audit trail with digital signatures for SOC2/ISO compliance.
 * Events are hash-chained AND cryptographically signed for tamper-proof logging.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createSign, createVerify, generateKeyPairSync } from 'crypto';
import type { AuditEvent } from './events';
import { verifyEventHash } from './events';
import type {
  AuditStorageAdapter,
  AuditReadOptions,
  AuditExportOptions,
  AuditChainValidation,
} from './storage';

// ─── Signed Event Extension ───────────────────────────────────

export interface SignedAuditEvent extends AuditEvent {
  signature: string;       // RSA-SHA256 signature of the event
  signerKeyId: string;     // Key ID for the signing key
}

// ─── Key Management ───────────────────────────────────────────

interface SigningKey {
  keyId: string;
  publicKey: string;       // PEM format
  privateKey: string;      // PEM format (only stored locally)
  algorithm: 'RSA-SHA256';
  createdAt: string;
  rotatedAt?: string;
}

interface KeyStore {
  version: string;
  activeKeyId: string;
  keys: SigningKey[];
}

const KEY_STORE_FILE = 'signing-keys.json';
const KEY_SIZE = 2048;

/**
 * Manage signing keys for audit events
 */
export class AuditKeyManager {
  private storePath: string;
  private keyStore: KeyStore | null = null;

  constructor(basePath: string = process.cwd()) {
    this.storePath = path.join(basePath, '.guardrail', 'audit', KEY_STORE_FILE);
  }

  /**
   * Initialize or load the key store
   */
  async init(): Promise<void> {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.storePath)) {
      this.keyStore = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
    } else {
      // Generate initial key pair
      const key = this.generateKey();
      this.keyStore = {
        version: '1.0.0',
        activeKeyId: key.keyId,
        keys: [key],
      };
      this.saveKeyStore();
    }
  }

  /**
   * Generate a new signing key pair
   */
  private generateKey(): SigningKey {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: KEY_SIZE,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return {
      keyId: `guardrail-audit-${Date.now()}`,
      publicKey: publicKey as string,
      privateKey: privateKey as string,
      algorithm: 'RSA-SHA256',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Rotate the signing key
   */
  async rotateKey(): Promise<string> {
    if (!this.keyStore) await this.init();

    const newKey = this.generateKey();

    // Mark old key as rotated
    const oldKey = this.keyStore!.keys.find(k => k.keyId === this.keyStore!.activeKeyId);
    if (oldKey) {
      oldKey.rotatedAt = new Date().toISOString();
    }

    this.keyStore!.keys.push(newKey);
    this.keyStore!.activeKeyId = newKey.keyId;
    this.saveKeyStore();

    return newKey.keyId;
  }

  /**
   * Sign data with the active key
   */
  sign(data: string): { signature: string; keyId: string } {
    if (!this.keyStore) {
      throw new Error('Key store not initialized. Call init() first.');
    }

    const activeKey = this.keyStore.keys.find(k => k.keyId === this.keyStore!.activeKeyId);
    if (!activeKey) {
      throw new Error('Active signing key not found');
    }

    const sign = createSign('RSA-SHA256');
    sign.update(data);
    const signature = sign.sign(activeKey.privateKey, 'base64');

    return { signature, keyId: activeKey.keyId };
  }

  /**
   * Verify a signature with the specified key
   */
  verify(data: string, signature: string, keyId: string): boolean {
    if (!this.keyStore) {
      throw new Error('Key store not initialized. Call init() first.');
    }

    const key = this.keyStore.keys.find(k => k.keyId === keyId);
    if (!key) {
      return false; // Unknown key
    }

    const verify = createVerify('RSA-SHA256');
    verify.update(data);
    return verify.verify(key.publicKey, signature, 'base64');
  }

  /**
   * Export public keys for external verification
   */
  exportPublicKeys(): Array<{ keyId: string; publicKey: string; algorithm: string }> {
    if (!this.keyStore) return [];

    return this.keyStore.keys.map(k => ({
      keyId: k.keyId,
      publicKey: k.publicKey,
      algorithm: k.algorithm,
    }));
  }

  private saveKeyStore(): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath, JSON.stringify(this.keyStore, null, 2), 'utf8');
  }
}

// ─── Signed JSONL Storage ─────────────────────────────────────

const GENESIS_HASH = '0'.repeat(64);

/**
 * JSONL storage with cryptographic signatures on every event
 */
export class SignedJSONLStorage implements AuditStorageAdapter {
  private filePath: string;
  private lastHash: string = GENESIS_HASH;
  private initialized: boolean = false;
  private keyManager: AuditKeyManager;

  constructor(basePath: string = process.cwd()) {
    const auditDir = path.join(basePath, '.guardrail', 'audit');
    this.filePath = path.join(auditDir, 'audit.signed.jsonl');
    this.keyManager = new AuditKeyManager(basePath);
  }

  private async ensureDir(): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureDir();
    await this.keyManager.init();

    if (fs.existsSync(this.filePath)) {
      const events = await this.tail(1);
      if (events.length > 0 && events[0]) {
        this.lastHash = events[0].hash;
      }
    }

    this.initialized = true;
  }

  async append(event: AuditEvent): Promise<void> {
    await this.initialize();

    // Sign the event
    const eventJson = JSON.stringify(event);
    const { signature, keyId } = this.keyManager.sign(eventJson);

    const signedEvent: SignedAuditEvent = {
      ...event,
      signature,
      signerKeyId: keyId,
    };

    const line = JSON.stringify(signedEvent) + '\n';
    fs.appendFileSync(this.filePath, line, 'utf8');
    this.lastHash = event.hash;
  }

  async getLastHash(): Promise<string> {
    await this.initialize();
    return this.lastHash;
  }

  async read(options: AuditReadOptions = {}): Promise<AuditEvent[]> {
    await this.initialize();

    if (!fs.existsSync(this.filePath)) return [];

    const events: AuditEvent[] = [];
    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let index = 0;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? Infinity;

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as AuditEvent;

        if (options.startDate && new Date(event.timestamp) < options.startDate) continue;
        if (options.endDate && new Date(event.timestamp) > options.endDate) continue;
        if (options.surface && event.surface !== options.surface) continue;
        if (options.category && event.category !== options.category) continue;
        if (options.action && event.action !== options.action) continue;
        if (options.actorId && event.actor.id !== options.actorId) continue;
        if (options.result && event.result !== options.result) continue;

        if (index >= offset && events.length < limit) {
          events.push(event);
        }
        index++;
        if (events.length >= limit) break;
      } catch {
        // Skip malformed lines
      }
    }

    return events;
  }

  async tail(count: number): Promise<AuditEvent[]> {
    await this.ensureDir();

    if (!fs.existsSync(this.filePath)) return [];

    const allEvents: AuditEvent[] = [];
    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        allEvents.push(JSON.parse(line));
      } catch { /* skip */ }
    }

    return allEvents.slice(-count);
  }

  async validateChain(): Promise<AuditChainValidation & { signatureResults: SignatureValidation }> {
    await this.initialize();

    const baseResult: AuditChainValidation = {
      valid: true,
      totalEvents: 0,
      validEvents: 0,
      invalidEvents: 0,
      brokenLinks: [],
      tamperedEvents: [],
    };

    const signatureResults: SignatureValidation = {
      totalVerified: 0,
      validSignatures: 0,
      invalidSignatures: 0,
      unknownKeys: 0,
      details: [],
    };

    if (!fs.existsSync(this.filePath)) {
      return { ...baseResult, signatureResults };
    }

    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let expectedPrevHash = GENESIS_HASH;
    let index = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const signedEvent = JSON.parse(line) as SignedAuditEvent;
        baseResult.totalEvents++;

        // Validate hash chain
        if (signedEvent.prevHash !== expectedPrevHash) {
          baseResult.valid = false;
          baseResult.invalidEvents++;
          baseResult.brokenLinks.push({
            index,
            eventId: signedEvent.id,
            expectedPrevHash,
            actualPrevHash: signedEvent.prevHash,
          });
        } else if (!verifyEventHash(signedEvent)) {
          baseResult.valid = false;
          baseResult.invalidEvents++;
          baseResult.tamperedEvents.push({
            index,
            eventId: signedEvent.id,
            reason: 'Event hash does not match content',
          });
        } else {
          baseResult.validEvents++;
        }

        // Validate signature
        signatureResults.totalVerified++;
        if (signedEvent.signature && signedEvent.signerKeyId) {
          const { signature, signerKeyId, ...eventWithoutSig } = signedEvent;
          const eventJson = JSON.stringify(eventWithoutSig);

          const sigValid = this.keyManager.verify(eventJson, signature, signerKeyId);
          if (sigValid) {
            signatureResults.validSignatures++;
          } else {
            signatureResults.invalidSignatures++;
            signatureResults.details.push({
              index,
              eventId: signedEvent.id,
              keyId: signerKeyId,
              valid: false,
              reason: 'Signature verification failed',
            });
          }
        } else {
          signatureResults.unknownKeys++;
        }

        expectedPrevHash = signedEvent.hash;
        index++;
      } catch {
        baseResult.totalEvents++;
        baseResult.invalidEvents++;
        index++;
      }
    }

    return { ...baseResult, signatureResults };
  }

  async export(format: 'json' | 'csv', options: AuditExportOptions = {}): Promise<string> {
    const events = await this.read({
      startDate: options.startDate,
      endDate: options.endDate,
    });

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }

    const headers = [
      'id', 'timestamp', 'actor_id', 'actor_type', 'surface',
      'category', 'action', 'target_type', 'tier', 'result', 'hash',
    ];

    if (options.includeMetadata) headers.push('metadata');

    const rows = events.map(event => {
      const row = [
        event.id, event.timestamp, event.actor.id, event.actor.type,
        event.surface, event.category, event.action, event.target.type,
        event.tier, event.result, event.hash,
      ];
      if (options.includeMetadata) {
        row.push(JSON.stringify(event.metadata ?? {}));
      }
      return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  async clear(): Promise<void> {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
    this.lastHash = GENESIS_HASH;
    this.initialized = false;
  }

  /**
   * Export public keys for external auditors
   */
  getPublicKeys(): Array<{ keyId: string; publicKey: string; algorithm: string }> {
    return this.keyManager.exportPublicKeys();
  }

  /**
   * Rotate the signing key
   */
  async rotateSigningKey(): Promise<string> {
    return this.keyManager.rotateKey();
  }
}

// ─── Signature Validation Types ───────────────────────────────

export interface SignatureValidation {
  totalVerified: number;
  validSignatures: number;
  invalidSignatures: number;
  unknownKeys: number;
  details: Array<{
    index: number;
    eventId: string;
    keyId: string;
    valid: boolean;
    reason?: string;
  }>;
}
