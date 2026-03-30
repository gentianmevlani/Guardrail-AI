import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { zeroTrustEngine } from './zero-trust-engine';

export interface ThreatIndicator {
  id: string;
  type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'user_agent' | 'pattern';
  value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'malware' | 'phishing' | 'botnet' | 'ddos' | 'data_exfiltration' | 'anomaly';
  source: string;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  tags: string[];
  description?: string;
}

export interface ThreatEvent {
  id: string;
  timestamp: Date;
  type: ThreatEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: {
    ip: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
  };
  target: {
    resource?: string;
    endpoint?: string;
    data?: any;
  };
  indicators: ThreatIndicator[];
  context: {
    requestHeaders?: { [key: string]: string };
    requestBody?: any;
    responseCode?: number;
    latency?: number;
  };
  mitigated: boolean;
  mitigationAction?: string;
  description: string;
}

export type ThreatEventType = 
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'command_injection'
  | 'path_traversal'
  | 'brute_force'
  | 'ddos_attack'
  | 'data_exfiltration'
  | 'unauthorized_access'
  | 'malicious_upload'
  | 'suspicious_pattern'
  | 'anomaly_detected';

export interface DetectionRule {
  id: string;
  name: string;
  enabled: boolean;
  type: 'signature' | 'behavioral' | 'anomaly' | 'ml';
  pattern?: string;
  conditions?: DetectionCondition[];
  threshold?: number;
  timeWindow?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: MitigationAction[];
  falsePositiveRate: number;
  lastUpdated: Date;
}

export interface DetectionCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'gt' | 'lt' | 'in' | 'not_in';
  value: any;
  weight?: number;
}

export interface MitigationAction {
  type: 'block_ip' | 'require_mfa' | 'rate_limit' | 'quarantine' | 'alert' | 'log';
  parameters?: { [key: string]: any };
  duration?: number;
}

export interface ThreatIntelligence {
  sources: ThreatIntelSource[];
  lastSync: Date;
  indicators: ThreatIndicator[];
  autoUpdate: boolean;
  updateInterval: number;
}

export interface ThreatIntelSource {
  name: string;
  type: 'feed' | 'api' | 'database';
  url?: string;
  apiKey?: string;
  enabled: boolean;
  priority: number;
  lastFetch: Date;
  fetchCount: number;
}

export class AdvancedThreatDetection extends EventEmitter {
  private rules: Map<string, DetectionRule> = new Map();
  private indicators: Map<string, ThreatIndicator> = new Map();
  private blockedIPs: Set<string> = new Set();
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
  private events: ThreatEvent[] = [];
  private intelligence: ThreatIntelligence;
  private anomalyDetector: AnomalyDetector;
  private mlModel: MLThreatModel;

  constructor() {
    super();
    this.intelligence = {
      sources: [],
      lastSync: new Date(),
      indicators: [],
      autoUpdate: true,
      updateInterval: 3600000,
    };
    this.anomalyDetector = new AnomalyDetector();
    this.mlModel = new MLThreatModel();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    const defaultRules: Omit<DetectionRule, 'id' | 'lastUpdated'>[] = [
      {
        name: 'SQL Injection Detection',
        enabled: true,
        type: 'signature',
        pattern: '(union|select|insert|update|delete|drop|exec|script)',
        conditions: [
          { field: 'requestBody', operator: 'regex', value: '(?i)(union|select|insert|update|delete|drop|exec|script)' },
          { field: 'url', operator: 'regex', value: '(?i)(union|select|insert|update|delete|drop|exec|script)' },
        ],
        severity: 'high',
        actions: [{ type: 'block_ip', duration: 3600000 }, { type: 'alert' }],
        falsePositiveRate: 0.05,
      },
      {
        name: 'XSS Detection',
        enabled: true,
        type: 'signature',
        pattern: '(<script|javascript:|onload=|onerror=)',
        conditions: [
          { field: 'requestBody', operator: 'regex', value: '(?i)(<script|javascript:|onload=|onerror=)' },
        ],
        severity: 'high',
        actions: [{ type: 'block_ip', duration: 1800000 }, { type: 'alert' }],
        falsePositiveRate: 0.1,
      },
      {
        name: 'Brute Force Detection',
        enabled: true,
        type: 'behavioral',
        conditions: [
          { field: 'failed_attempts', operator: 'gt', value: 5 },
          { field: 'time_window', operator: 'lt', value: 300 },
        ],
        threshold: 5,
        timeWindow: 300,
        severity: 'medium',
        actions: [{ type: 'rate_limit', parameters: { requests: 1, window: 900 } }, { type: 'alert' }],
        falsePositiveRate: 0.15,
      },
      {
        name: 'DDoS Detection',
        enabled: true,
        type: 'behavioral',
        conditions: [
          { field: 'request_rate', operator: 'gt', value: 1000 },
        ],
        threshold: 1000,
        timeWindow: 60,
        severity: 'critical',
        actions: [{ type: 'block_ip', duration: 3600000 }, { type: 'alert' }],
        falsePositiveRate: 0.01,
      },
      {
        name: 'Anomaly Detection',
        enabled: true,
        type: 'anomaly',
        threshold: 0.8,
        severity: 'medium',
        actions: [{ type: 'require_mfa' }, { type: 'alert' }],
        falsePositiveRate: 0.2,
      },
    ];

    defaultRules.forEach(rule => {
      this.addRule(rule);
    });
  }

  async addRule(rule: Omit<DetectionRule, 'id' | 'lastUpdated'>): Promise<string> {
    const id = this.generateId();
    const fullRule: DetectionRule = {
      ...rule,
      id,
      lastUpdated: new Date(),
    };

    this.rules.set(id, fullRule);
    this.emit('rule-added', fullRule);
    
    return id;
  }

  async updateRule(id: string, updates: Partial<DetectionRule>): Promise<void> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule with id ${id} not found`);
    }

    const updatedRule = {
      ...rule,
      ...updates,
      lastUpdated: new Date(),
    };

    this.rules.set(id, updatedRule);
    this.emit('rule-updated', updatedRule);
  }

  async analyzeRequest(request: {
    ip: string;
    method: string;
    url: string;
    headers: { [key: string]: string };
    body?: any;
    userId?: string;
    sessionId?: string;
    userAgent?: string;
  }): Promise<{ allowed: boolean; threats: ThreatEvent[]; mitigations: string[] }> {
    const threats: ThreatEvent[] = [];
    const mitigations: string[] = [];

    if (this.blockedIPs.has(request.ip)) {
      threats.push(await this.createThreatEvent({
        type: 'unauthorized_access',
        severity: 'high',
        source: { ip: request.ip },
        target: { endpoint: request.url },
        mitigated: true,
        mitigationAction: 'blocked_ip',
        description: 'Request from blocked IP address',
      }, request, [{
        id: this.generateId(),
        type: 'ip' as const,
        value: request.ip,
        severity: 'high' as const,
        category: 'anomaly' as const,
        source: 'internal' as const,
        confidence: 1.0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        tags: ['blocked']
      }]));
      return { allowed: false, threats, mitigations: ['IP blocked'] };
    }

    if (this.isRateLimited(request.ip)) {
      threats.push(await this.createThreatEvent({
        type: 'ddos_attack',
        severity: 'medium',
        source: { ip: request.ip },
        target: { endpoint: request.url },
        mitigated: true,
        mitigationAction: 'rate_limited',
        description: 'Request rate limit exceeded',
      }, request, [{
        id: this.generateId(),
        type: 'ip' as const,
        value: request.ip,
        severity: 'medium' as const,
        category: 'anomaly' as const,
        source: 'internal' as const,
        confidence: 0.9,
        firstSeen: new Date(),
        lastSeen: new Date(),
        tags: ['rate-limited']
      }]));
      return { allowed: false, threats, mitigations: ['Rate limited'] };
    }

    this.updateRateLimit(request.ip);

    for (const rule of Array.from(this.rules.values())) {
      if (!rule.enabled) continue;

      const matches = await this.evaluateRule(rule, request);
      if (matches) {
        const threat = await this.createThreatEvent({
          type: this.getThreatTypeFromRule(rule),
          severity: rule.severity,
          source: {
            ip: request.ip,
            userAgent: request.userAgent,
            userId: request.userId,
            sessionId: request.sessionId,
          },
          target: { endpoint: request.url },
          mitigated: false,
          description: `Threat detected by rule: ${rule.name}`,
        }, request, await this.extractIndicators(request));

        threats.push(threat);

        for (const action of rule.actions) {
          const mitigation = await this.applyMitigation(action, request, threat);
          if (mitigation) {
            threat.mitigated = true;
            threat.mitigationAction = mitigation;
            mitigations.push(mitigation);
          }
        }
      }
    }

    const anomalyScore = await this.anomalyDetector.analyze(request);
    if (anomalyScore > 0.8) {
      const anomalyThreat = await this.createThreatEvent({
        type: 'anomaly_detected',
        severity: 'medium',
        source: { ip: request.ip },
        target: { endpoint: request.url },
        mitigated: false,
        description: `Anomalous behavior detected (score: ${anomalyScore})`,
      }, request, [{
        id: this.generateId(),
        type: 'pattern' as const,
        value: anomalyScore.toString(),
        severity: 'medium' as const,
        category: 'anomaly' as const,
        source: 'ml' as const,
        confidence: anomalyScore,
        firstSeen: new Date(),
        lastSeen: new Date(),
        tags: ['anomaly']
      }]);
      
      threats.push(anomalyThreat);
    }

    const mlPrediction = await this.mlModel.predict(request);
    if (mlPrediction.isThreat) {
      const mlThreat = await this.createThreatEvent({
        type: 'suspicious_pattern',
        severity: mlPrediction.severity,
        source: { ip: request.ip },
        target: { endpoint: request.url },
        mitigated: false,
        description: `ML model detected threat (confidence: ${mlPrediction.confidence})`,
      }, request, [{
        id: this.generateId(),
        type: 'pattern' as const,
        value: mlPrediction.confidence.toString(),
        severity: mlPrediction.severity,
        category: 'anomaly' as const,
        source: 'ml' as const,
        confidence: mlPrediction.confidence,
        firstSeen: new Date(),
        lastSeen: new Date(),
        tags: ['ml-detected']
      }]);
      
      threats.push(mlThreat);
    }

    return {
      allowed: threats.length === 0 || threats.every(t => t.mitigated),
      threats,
      mitigations,
    };
  }

  private async evaluateRule(rule: DetectionRule, request: any): Promise<boolean> {
    switch (rule.type) {
      case 'signature':
        return this.evaluateSignatureRule(rule, request);
      case 'behavioral':
        return await this.evaluateBehavioralRule(rule, request);
      case 'anomaly':
        return await this.evaluateAnomalyRule(rule, request);
      case 'ml':
        return await this.evaluateMLRule(rule, request);
      default:
        return true;
    }
  }

  private evaluateSignatureRule(rule: DetectionRule, request: any): boolean {
    if (!rule.conditions) return false;

    return rule.conditions.some(condition => {
      const value = this.getFieldValue(request, condition.field);
      return this.evaluateCondition(value, condition.operator, condition.value);
    });
  }

  private async evaluateBehavioralRule(rule: DetectionRule, request: any): Promise<boolean> {
    if (!rule.conditions) return false;

    for (const condition of rule.conditions) {
      const value = this.getFieldValue(request, condition.field);
      if (!this.evaluateCondition(value, condition.operator, condition.value)) {
        return false;
      }
    }

    return true;
  }

  private async evaluateAnomalyRule(_rule: DetectionRule, request: any): Promise<boolean> {
    const score = await this.anomalyDetector.analyze(request);
    return score > (_rule.threshold || 0.8);
  }

  private async evaluateMLRule(_rule: DetectionRule, request: any): Promise<boolean> {
    const prediction = await this.mlModel.predict(request);
    return prediction.isThreat && prediction.confidence > 0.7;
  }

  private getFieldValue(request: any, field: string): any {
    const parts = field.split('.');
    let value = request;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  private evaluateCondition(value: any, operator: DetectionCondition['operator'], expected: any): boolean {
    switch (operator) {
      case 'equals':
        return value === expected;
      case 'contains':
        return typeof value === 'string' && value.toLowerCase().includes(expected.toLowerCase());
      case 'regex':
        return typeof value === 'string' && new RegExp(expected, 'i').test(value);
      case 'gt':
        return Number(value) > Number(expected);
      case 'lt':
        return Number(value) < Number(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(value);
      case 'not_in':
        return Array.isArray(expected) && !expected.includes(value);
      default:
        return false;
    }
  }

  private getThreatTypeFromRule(rule: DetectionRule): ThreatEventType {
    if (rule.name.toLowerCase().includes('sql')) return 'sql_injection_attempt';
    if (rule.name.toLowerCase().includes('xss')) return 'xss_attempt';
    if (rule.name.toLowerCase().includes('brute')) return 'brute_force';
    if (rule.name.toLowerCase().includes('ddos')) return 'ddos_attack';
    return 'suspicious_pattern';
  }

  private async extractIndicators(request: any): Promise<ThreatIndicator[]> {
    const indicators: ThreatIndicator[] = [];

    if (this.isSuspiciousIP(request.ip)) {
      indicators.push({
        id: this.generateId(),
        type: 'ip',
        value: request.ip,
        severity: 'medium',
        category: 'anomaly',
        source: 'internal',
        confidence: 0.7,
        firstSeen: new Date(),
        lastSeen: new Date(),
        tags: ['suspicious'],
      });
    }

    if (request.userAgent && this.isSuspiciousUserAgent(request.userAgent)) {
      indicators.push({
        id: this.generateId(),
        type: 'user_agent',
        value: request.userAgent,
        severity: 'low',
        category: 'anomaly',
        source: 'internal',
        confidence: 0.6,
        firstSeen: new Date(),
        lastSeen: new Date(),
        tags: ['bot'],
      });
    }

    return indicators;
  }

  private isSuspiciousIP(_ip: string): boolean {
    // TODO: Implement suspicious IP detection logic
    return false;
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    return /bot|crawler|spider|scraper/i.test(userAgent);
  }

  private async createThreatEvent(
    baseEvent: Omit<ThreatEvent, 'id' | 'timestamp' | 'indicators' | 'context'>,
    request: any,
    indicators?: ThreatIndicator[]
  ): Promise<ThreatEvent> {
    const event: ThreatEvent = {
      ...baseEvent,
      id: this.generateId(),
      timestamp: new Date(),
      indicators: indicators || [],
      context: {
        requestHeaders: request.headers,
        requestBody: request.body,
      },
    };

    this.events.push(event);
    this.emit('threat-detected', event);

    if (event.severity === 'critical') {
      this.emit('critical-threat', event);
    }

    return event;
  }

  private async applyMitigation(
    action: MitigationAction,
    request: any,
    threat: ThreatEvent
  ): Promise<string | null> {
    switch (action.type) {
      case 'block_ip':
        this.blockedIPs.add(request.ip);
        setTimeout(() => this.blockedIPs.delete(request.ip), action.duration || 3600000);
        return 'IP blocked';
      
      case 'require_mfa':
        if (request.userId) {
          await zeroTrustEngine.revokeSession(request.sessionId);
        }
        return 'MFA required';
      
      case 'rate_limit':
        const rateLimitKey = `rate_limit:${request.ip}`;
        this.rateLimitMap.set(rateLimitKey, {
          count: 0,
          resetTime: Date.now() + (action.duration || 900000),
        });
        return 'Rate limit applied';
      
      case 'quarantine':
        return 'Resource quarantined';
      
      case 'alert':
        this.emit('security-alert', { threat, action });
        return 'Alert sent';
      
      case 'log':
        console.warn(`Security event logged: ${threat.description}`);
        return 'Logged';
      
      default:
        return null;
    }
  }

  private isRateLimited(ip: string): boolean {
    const key = `rate_limit:${ip}`;
    const limit = this.rateLimitMap.get(key);
    
    if (!limit) return false;
    
    if (Date.now() > limit.resetTime) {
      this.rateLimitMap.delete(key);
      return false;
    }
    
    return limit.count > 100;
  }

  private updateRateLimit(ip: string): void {
    const key = `rate_limit:${ip}`;
    const limit = this.rateLimitMap.get(key);
    
    if (!limit) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: Date.now() + 60000,
      });
    } else {
      limit.count++;
    }
  }

  async addThreatIndicator(indicator: Omit<ThreatIndicator, 'id' | 'firstSeen' | 'lastSeen'>): Promise<string> {
    const id = this.generateId();
    const now = new Date();
    
    const fullIndicator: ThreatIndicator = {
      ...indicator,
      id,
      firstSeen: now,
      lastSeen: now,
    };

    this.indicators.set(id, fullIndicator);
    this.emit('indicator-added', fullIndicator);
    
    return id;
  }

  async syncThreatIntelligence(): Promise<void> {
    for (const source of this.intelligence.sources) {
      if (!source.enabled) continue;
      
      try {
        const indicators = await this.fetchThreatIntel(source);
        for (const indicator of indicators) {
          await this.addThreatIndicator(indicator);
        }
        
        source.lastFetch = new Date();
        source.fetchCount++;
      } catch (error) {
        console.error(`Failed to sync threat intel from ${source.name}:`, error);
      }
    }
    
    this.intelligence.lastSync = new Date();
    this.emit('intel-synced', this.intelligence);
  }

  private async fetchThreatIntel(source: ThreatIntelSource): Promise<Omit<ThreatIndicator, 'id' | 'firstSeen' | 'lastSeen'>[]> {
    if (!source.url) {
      console.warn(`Source ${source.name} has no URL configured`);
      return [];
    }

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (source.apiKey) {
        headers['Authorization'] = `Bearer ${source.apiKey}`;
      }

      const response = await fetch(source.url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch from ${source.name}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseThreatData(data, source.name);
    } catch (error) {
      console.error(`Error fetching threat intel from ${source.name}:`, error);
      return [];
    }
  }

  private parseThreatData(data: any, sourceName: string): Omit<ThreatIndicator, 'id' | 'firstSeen' | 'lastSeen'>[] {
    const indicators: Omit<ThreatIndicator, 'id' | 'firstSeen' | 'lastSeen'>[] = [];

    // Handle array of indicators
    const items = Array.isArray(data) ? data : (data.indicators || data.items || data.threats || []);

    for (const item of items) {
      if (typeof item === 'object') {
        const type = this.normalizeIndicatorType(item.type);
        const severity = this.normalizeSeverity(item.severity);
        const category = this.normalizeCategory(item.category);
        const value = item.value || item.indicator || item.ip || item.domain || item.url || item.hash;

        if (type && value) {
          indicators.push({
            type,
            value,
            severity,
            category,
            source: sourceName,
            confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
            tags: Array.isArray(item.tags) ? item.tags : [],
            description: item.description,
          });
        }
      }
    }

    return indicators;
  }

  private normalizeIndicatorType(type: string): ThreatIndicator['type'] | undefined {
    const t = type?.toLowerCase();
    if (['ip', 'domain', 'url', 'hash', 'email', 'user_agent', 'pattern'].includes(t)) {
      return t as ThreatIndicator['type'];
    }
    return undefined;
  }

  private normalizeSeverity(severity: string): ThreatIndicator['severity'] {
    const s = severity?.toLowerCase();
    if (['low', 'medium', 'high', 'critical'].includes(s)) {
      return s as ThreatIndicator['severity'];
    }
    return 'medium'; // Default severity
  }

  private normalizeCategory(category: string): ThreatIndicator['category'] {
    const c = category?.toLowerCase();
    if (['malware', 'phishing', 'botnet', 'ddos', 'data_exfiltration', 'anomaly'].includes(c)) {
      return c as ThreatIndicator['category'];
    }
    return 'anomaly'; // Default category
  }

  async getThreatReport(): Promise<{
    totalThreats: number;
    criticalThreats: number;
    blockedIPs: number;
    activeRules: number;
    indicators: number;
    recentThreats: ThreatEvent[];
    topThreatTypes: { type: string; count: number }[];
  }> {
    const criticalThreats = this.events.filter(e => e.severity === 'critical').length;
    const activeRules = Array.from(this.rules.values()).filter(r => r.enabled).length;
    
    const threatTypes: { [key: string]: number } = {};
    this.events.forEach(event => {
      threatTypes[event.type] = (threatTypes[event.type] || 0) + 1;
    });
    
    const topThreatTypes = Object.entries(threatTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    return {
      totalThreats: this.events.length,
      criticalThreats,
      blockedIPs: this.blockedIPs.size,
      activeRules,
      indicators: this.indicators.size,
      recentThreats: this.events.slice(-20),
      topThreatTypes,
    };
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }
}

class AnomalyDetector {
  private baseline: { [key: string]: number } = {};
  private history: any[] = [];

  async analyze(request: any): Promise<number> {
    const features = this.extractFeatures(request);
    let anomalyScore = 0;

    for (const [feature, value] of Object.entries(features)) {
      const baseline = this.baseline[feature];
      if (baseline) {
        const deviation = Math.abs(value - baseline) / baseline;
        anomalyScore += Math.min(deviation, 1);
      }
    }

    this.updateBaseline(features);
    this.history.push({ ...features, timestamp: Date.now() });
    
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }

    return Math.min(anomalyScore / Object.keys(features).length, 1);
  }

  private extractFeatures(request: any): { [key: string]: number } {
    return {
      requestLength: JSON.stringify(request).length,
      headerCount: Object.keys(request.headers || {}).length,
      bodySize: request.body ? JSON.stringify(request.body).length : 0,
      paramCount: this.countParameters(request.url),
    };
  }

  private countParameters(url: string): number {
    const params = new URL(url, 'http://localhost').searchParams;
    return params.size;
  }

  private updateBaseline(features: { [key: string]: number }): void {
    for (const [feature, value] of Object.entries(features)) {
      if (!this.baseline[feature]) {
        this.baseline[feature] = value;
      } else {
        this.baseline[feature] = this.baseline[feature] * 0.95 + value * 0.05;
      }
    }
  }
}

class MLThreatModel {
  async predict(request: any): Promise<{ isThreat: boolean; severity: 'low' | 'medium' | 'high' | 'critical'; confidence: number }> {
    const features = this.extractMLFeatures(request);
    const score = this.calculateThreatScore(features);
    
    return {
      isThreat: score > 0.7,
      severity: score > 0.9 ? 'critical' : score > 0.8 ? 'high' : score > 0.7 ? 'medium' : 'low',
      confidence: score,
    };
  }

  private extractMLFeatures(request: any): number[] {
    return [
      this.hasSQLInjection(request) ? 1 : 0,
      this.hasXSS(request) ? 1 : 0,
      this.hasCommandInjection(request) ? 1 : 0,
      this.isLargeRequest(request) ? 1 : 0,
      this.hasEncodedPayload(request) ? 1 : 0,
    ];
  }

  private hasSQLInjection(request: any): boolean {
    const patterns = ['union', 'select', 'insert', 'update', 'delete', 'drop', 'exec'];
    const content = JSON.stringify(request).toLowerCase();
    return patterns.some(pattern => content.includes(pattern));
  }

  private hasXSS(request: any): boolean {
    const patterns = ['<script', 'javascript:', 'onload=', 'onerror='];
    const content = JSON.stringify(request).toLowerCase();
    return patterns.some(pattern => content.includes(pattern));
  }

  private hasCommandInjection(request: any): boolean {
    const patterns = ['; ', '| ', '& ', '$(', '`'];
    const content = JSON.stringify(request);
    return patterns.some(pattern => content.includes(pattern));
  }

  private isLargeRequest(request: any): boolean {
    return JSON.stringify(request).length > 10000;
  }

  private hasEncodedPayload(request: any): boolean {
    const content = JSON.stringify(request);
    return /%[0-9A-Fa-f]{2}/.test(content);
  }

  private calculateThreatScore(features: number[]): number {
    const weights = [0.3, 0.25, 0.25, 0.1, 0.1];
    return features.reduce((sum, feature, index) => sum + feature * weights[index], 0);
  }
}

export const threatDetection = new AdvancedThreatDetection();
