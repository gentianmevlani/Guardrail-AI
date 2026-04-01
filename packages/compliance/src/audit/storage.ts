/**
 * Audit Trail Storage
 * 
 * Hash-chained JSONL storage with adapter interface for future extensibility.
 * Default: Local file storage at .guardrail/audit/audit.log.jsonl
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { 
  AuditEvent, 
  verifyEventHash,
} from './events';

// Storage adapter interface for future extensibility (e.g., server storage)
export interface AuditStorageAdapter {
  append(event: AuditEvent): Promise<void>;
  getLastHash(): Promise<string>;
  read(options?: AuditReadOptions): Promise<AuditEvent[]>;
  tail(count: number): Promise<AuditEvent[]>;
  validateChain(): Promise<AuditChainValidation>;
  export(format: 'json' | 'csv', options?: AuditExportOptions): Promise<string>;
  clear(): Promise<void>;
}

export interface AuditReadOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  surface?: string;
  category?: string;
  action?: string;
  actorId?: string;
  result?: string;
}

export interface AuditExportOptions {
  startDate?: Date;
  endDate?: Date;
  includeMetadata?: boolean;
}

export interface AuditChainValidation {
  valid: boolean;
  totalEvents: number;
  validEvents: number;
  invalidEvents: number;
  brokenLinks: Array<{
    index: number;
    eventId: string;
    expectedPrevHash: string;
    actualPrevHash: string;
  }>;
  tamperedEvents: Array<{
    index: number;
    eventId: string;
    reason: string;
  }>;
}

// Genesis hash (used as prevHash for first event)
const GENESIS_HASH = '0'.repeat(64);

/**
 * Local JSONL file storage adapter
 */
export class LocalJSONLStorage implements AuditStorageAdapter {
  private filePath: string;
  private lastHash: string = GENESIS_HASH;
  private initialized: boolean = false;

  constructor(basePath: string = process.cwd()) {
    const auditDir = path.join(basePath, '.guardrail', 'audit');
    this.filePath = path.join(auditDir, 'audit.log.jsonl');
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
    
    // Read last hash from existing log
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
    
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(this.filePath, line, 'utf8');
    this.lastHash = event.hash;
  }

  async getLastHash(): Promise<string> {
    await this.initialize();
    return this.lastHash;
  }

  async read(options: AuditReadOptions = {}): Promise<AuditEvent[]> {
    await this.initialize();
    
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    const events: AuditEvent[] = [];
    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let index = 0;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? Infinity;

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const event = JSON.parse(line) as AuditEvent;
        
        // Apply filters
        if (options.startDate && new Date(event.timestamp) < options.startDate) continue;
        if (options.endDate && new Date(event.timestamp) > options.endDate) continue;
        if (options.surface && event.surface !== options.surface) continue;
        if (options.category && event.category !== options.category) continue;
        if (options.action && event.action !== options.action) continue;
        if (options.actorId && event.actor.id !== options.actorId) continue;
        if (options.result && event.result !== options.result) continue;
        
        // Apply pagination
        if (index >= offset && events.length < limit) {
          events.push(event);
        }
        index++;
        
        if (events.length >= limit) break;
      } catch (e) {
        // Skip malformed lines
        console.error(`Skipping malformed audit event: ${e}`);
      }
    }

    return events;
  }

  async tail(count: number): Promise<AuditEvent[]> {
    await this.initialize();
    
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    // Read all events and return last N
    const allEvents: AuditEvent[] = [];
    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as AuditEvent;
        allEvents.push(event);
      } catch (e) {
        // Skip malformed lines
      }
    }

    return allEvents.slice(-count);
  }

  async validateChain(): Promise<AuditChainValidation> {
    await this.initialize();
    
    const result: AuditChainValidation = {
      valid: true,
      totalEvents: 0,
      validEvents: 0,
      invalidEvents: 0,
      brokenLinks: [],
      tamperedEvents: [],
    };

    if (!fs.existsSync(this.filePath)) {
      return result;
    }

    const fileStream = fs.createReadStream(this.filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let expectedPrevHash = GENESIS_HASH;
    let index = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const event = JSON.parse(line) as AuditEvent;
        result.totalEvents++;
        
        // Validate hash chain
        if (event.prevHash !== expectedPrevHash) {
          result.valid = false;
          result.invalidEvents++;
          result.brokenLinks.push({
            index,
            eventId: event.id,
            expectedPrevHash,
            actualPrevHash: event.prevHash,
          });
        } else if (!verifyEventHash(event)) {
          // Validate event hash
          result.valid = false;
          result.invalidEvents++;
          result.tamperedEvents.push({
            index,
            eventId: event.id,
            reason: 'Event hash does not match content',
          });
        } else {
          result.validEvents++;
        }
        
        expectedPrevHash = event.hash;
        index++;
      } catch (e) {
        result.totalEvents++;
        result.invalidEvents++;
        result.tamperedEvents.push({
          index,
          eventId: 'unknown',
          reason: `Malformed JSON: ${e}`,
        });
        index++;
      }
    }

    return result;
  }

  async export(format: 'json' | 'csv', options: AuditExportOptions = {}): Promise<string> {
    const events = await this.read({
      startDate: options.startDate,
      endDate: options.endDate,
    });

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }

    // CSV export
    const headers = [
      'id',
      'timestamp',
      'actor_id',
      'actor_type',
      'actor_name',
      'surface',
      'category',
      'action',
      'target_type',
      'target_path',
      'tier',
      'result',
      'hash',
    ];

    if (options.includeMetadata) {
      headers.push('metadata');
    }

    const rows = events.map(event => {
      const row = [
        event.id,
        event.timestamp,
        event.actor.id,
        event.actor.type,
        event.actor.name ?? '',
        event.surface,
        event.category,
        event.action,
        event.target.type,
        event.target.path ?? '',
        event.tier,
        event.result,
        event.hash,
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

  getFilePath(): string {
    return this.filePath;
  }
}

/**
 * Server storage adapter (placeholder for future implementation)
 */
export class ServerStorageAdapter implements AuditStorageAdapter {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async append(_event: AuditEvent): Promise<void> {
    // TODO: Implement server storage
    void this.apiUrl; void this.apiKey;
    throw new Error('Server storage not yet implemented');
  }

  async getLastHash(): Promise<string> {
    throw new Error('Server storage not yet implemented');
  }

  async read(_options?: AuditReadOptions): Promise<AuditEvent[]> {
    throw new Error('Server storage not yet implemented');
  }

  async tail(_count: number): Promise<AuditEvent[]> {
    throw new Error('Server storage not yet implemented');
  }

  async validateChain(): Promise<AuditChainValidation> {
    throw new Error('Server storage not yet implemented');
  }

  async export(_format: 'json' | 'csv', _options?: AuditExportOptions): Promise<string> {
    throw new Error('Server storage not yet implemented');
  }

  async clear(): Promise<void> {
    throw new Error('Server storage not yet implemented');
  }
}

/**
 * Factory function to create storage adapter based on configuration
 */
export function createStorageAdapter(config?: {
  type?: 'local' | 'server';
  basePath?: string;
  apiUrl?: string;
  apiKey?: string;
}): AuditStorageAdapter {
  const type = config?.type ?? 'local';
  
  if (type === 'server' && config?.apiUrl && config?.apiKey) {
    return new ServerStorageAdapter(config.apiUrl, config.apiKey);
  }
  
  return new LocalJSONLStorage(config?.basePath);
}
