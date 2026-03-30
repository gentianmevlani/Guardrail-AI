import { SignJWT, jwtVerify } from 'jose';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import { isIPInCIDR } from './ip-utils';

export interface ZeroTrustPolicy {
  id: string;
  name: string;
  version: string;
  rules: ZeroTrustRule[];
  enforcement: 'strict' | 'permissive' | 'monitor';
  createdAt: Date;
  updatedAt: Date;
}

export interface ZeroTrustRule {
  id: string;
  type: 'authentication' | 'authorization' | 'device' | 'network' | 'behavioral' | 'data';
  condition: string;
  action: 'allow' | 'deny' | 'challenge' | 'log';
  priority: number;
  enabled: boolean;
}

export interface IdentityContext {
  userId: string;
  sessionId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  location: {
    country: string;
    region: string;
    city: string;
    coordinates?: [number, number];
  };
  riskScore: number;
  trustLevel: 'low' | 'medium' | 'high';
  attributes: { [key: string]: any };
  mfaVerified: boolean;
  deviceTrusted: boolean;
  lastActivity: Date;
}

export interface AccessRequest {
  resource: string;
  action: string;
  context: IdentityContext;
  timestamp: Date;
  requestId: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  requirements: string[];
  expiresAt?: Date;
  additionalVerification?: 'mfa' | 'device_approval' | 'biometric';
}

export interface SecurityEvent {
  id: string;
  type: 'authentication_failure' | 'authorization_denied' | 'suspicious_behavior' | 'data_breach_attempt' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: IdentityContext;
  details: { [key: string]: any };
  timestamp: Date;
  resolved: boolean;
}

export class ZeroTrustEngine extends EventEmitter {
  private policies: Map<string, ZeroTrustPolicy> = new Map();
  private activeSessions: Map<string, IdentityContext> = new Map();
  private trustedDevices: Map<string, { userId: string; fingerprint: string; trustedAt: Date }> = new Map();
  private riskThresholds = { low: 30, medium: 60, high: 80 };
  private securityEvents: SecurityEvent[] = [];
  private secretKey: string;
  private corporateIPRanges: string[] = [];

  constructor(secretKey?: string) {
    super();
    this.secretKey = secretKey || randomBytes(64).toString('hex');
  }

  setCorporateIPRanges(ranges: string[]) {
    this.corporateIPRanges = ranges;
  }

  async createPolicy(policy: Omit<ZeroTrustPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateId();
    const now = new Date();
    
    const fullPolicy: ZeroTrustPolicy = {
      ...policy,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.policies.set(id, fullPolicy);
    this.emit('policy-created', fullPolicy);
    
    return id;
  }

  async updatePolicy(id: string, updates: Partial<ZeroTrustPolicy>): Promise<void> {
    const policy = this.policies.get(id);
    if (!policy) {
      throw new Error(`Policy with id ${id} not found`);
    }

    const updatedPolicy = {
      ...policy,
      ...updates,
      updatedAt: new Date(),
    };

    this.policies.set(id, updatedPolicy);
    this.emit('policy-updated', updatedPolicy);
  }

  async evaluateAccess(request: AccessRequest): Promise<AccessDecision> {
    const context = await this.enrichContext(request.context);
    const riskScore = await this.calculateRiskScore(context);
    context.riskScore = riskScore;
    context.trustLevel = this.getTrustLevel(riskScore);

    const decisions: AccessDecision[] = [];
    
    for (const policy of Array.from(this.policies.values())) {
      if (!policy.rules.some(rule => rule.enabled)) continue;
      
      const decision = await this.evaluatePolicy(policy, request, context);
      decisions.push(decision);
    }

    const finalDecision = this.aggregateDecisions(decisions);
    
    if (!finalDecision) {
      return {
        allowed: false,
        reason: 'No decisions available',
        requirements: [],
      };
    }
    
    if (!finalDecision.allowed) {
      await this.logSecurityEvent({
        id: this.generateId(),
        type: 'authorization_denied',
        severity: context.riskScore > 80 ? 'high' : 'medium',
        context,
        details: {
          resource: request.resource,
          action: request.action,
          reason: finalDecision.reason,
        },
        timestamp: new Date(),
        resolved: false,
      });
    }

    this.emit('access-evaluated', { request, decision: finalDecision });
    
    return finalDecision;
  }

  private async enrichContext(context: IdentityContext): Promise<IdentityContext> {
    const enriched = { ...context };
    
    enriched.location = await this.getLocationFromIP(context.ipAddress);
    enriched.deviceTrusted = await this.isDeviceTrusted(context.deviceId, context.userId);
    
    const recentEvents = this.getRecentEvents(context.userId, 'authentication_failure', 24);
    if (recentEvents.length > 3) {
      enriched.riskScore += 20;
    }

    return enriched;
  }

  private async calculateRiskScore(context: IdentityContext): Promise<number> {
    let score = 0;

    if (!context.mfaVerified) score += 25;
    if (!context.deviceTrusted) score += 20;
    if (this.isNewLocation(context)) score += 15;
    if (this.isSuspiciousTime(context)) score += 10;
    if (this.isSuspiciousUserAgent(context.userAgent)) score += 15;

    const behaviorScore = await this.analyzeBehavior(context);
    score += behaviorScore;

    return Math.min(100, Math.max(0, score));
  }

  private getTrustLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore < this.riskThresholds.low) return 'high';
    if (riskScore < this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  private async evaluatePolicy(
    policy: ZeroTrustPolicy,
    request: AccessRequest,
    context: IdentityContext
  ): Promise<AccessDecision> {
    const sortedRules = policy.rules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const matches = await this.evaluateRule(rule, request, context);
      
      if (matches) {
        switch (rule.action) {
          case 'allow':
            return {
              allowed: true,
              reason: `Rule ${rule.id} allows access`,
              requirements: [],
            };
          case 'deny':
            return {
              allowed: false,
              reason: `Rule ${rule.id} denies access`,
              requirements: [],
            };
          case 'challenge':
            return {
              allowed: false,
              reason: `Additional verification required by rule ${rule.id}`,
              requirements: ['mfa'],
              additionalVerification: 'mfa',
            };
        }
      }
    }

    return {
      allowed: policy.enforcement === 'permissive',
      reason: policy.enforcement === 'strict' ? 'No matching rule found in strict mode' : 'Default allow',
      requirements: [],
    };
  }

  private async evaluateRule(
    rule: ZeroTrustRule,
    request: AccessRequest,
    context: IdentityContext
  ): Promise<boolean> {
    switch (rule.type) {
      case 'authentication':
        return this.evaluateAuthenticationRule(rule.condition, context);
      case 'authorization':
        return this.evaluateAuthorizationRule(rule.condition, request, context);
      case 'device':
        return this.evaluateDeviceRule(rule.condition, context);
      case 'network':
        return this.evaluateNetworkRule(rule.condition, context);
      case 'behavioral':
        return this.evaluateBehavioralRule(rule.condition, context);
      case 'data':
        return this.evaluateDataRule(rule.condition, request, context);
      default:
        return false;
    }
  }

  private evaluateAuthenticationRule(condition: string, context: IdentityContext): boolean {
    // Support logical OR - if any sub-condition matches, return true
    if (condition.includes('||')) {
      return condition.split('||').some(subCondition => 
        this.evaluateAuthenticationRule(subCondition.trim(), context)
      );
    }

    // Support logical AND - all sub-conditions must match
    if (condition.includes('&&')) {
      return condition.split('&&').every(subCondition => 
        this.evaluateAuthenticationRule(subCondition.trim(), context)
      );
    }

    // MFA verification checks
    if (condition.includes('mfa_verified') || condition.includes('mfa_required')) {
      return context.mfaVerified === true;
    }

    // Trust level checks (trust_level:high, trust_level:medium, trust_level:low)
    const trustLevelMatch = condition.match(/trust_level[=:](\w+)/);
    if (trustLevelMatch) {
      const requiredLevel = trustLevelMatch[1]!.toLowerCase();
      if (requiredLevel === 'high') {
        return context.trustLevel === 'high';
      }
      if (requiredLevel === 'medium') {
        return context.trustLevel === 'high' || context.trustLevel === 'medium';
      }
      if (requiredLevel === 'low') {
        return true; // Any trust level satisfies 'low' requirement
      }
    }

    // Risk score comparisons (risk_score<50, risk_score>=30, risk_score<=80)
    const riskScoreMatch = condition.match(/risk_score\s*(<=|>=|<|>|==|=)\s*(\d+)/);
    if (riskScoreMatch) {
      const operator = riskScoreMatch[1]!;
      const threshold = parseInt(riskScoreMatch[2]!, 10);
      switch (operator) {
        case '<': return context.riskScore < threshold;
        case '<=': return context.riskScore <= threshold;
        case '>': return context.riskScore > threshold;
        case '>=': return context.riskScore >= threshold;
        case '==':
        case '=': return context.riskScore === threshold;
      }
    }

    // Session active check
    if (condition.includes('session_active')) {
      return this.activeSessions.has(context.sessionId);
    }

    // Device trusted check (fallback for authentication rules)
    if (condition.includes('device_trusted')) {
      return context.deviceTrusted === true;
    }

    // Attribute checks (attribute.role=admin, attribute.tier=premium)
    const attrMatch = condition.match(/attribute\.(\w+)\s*[=:]\s*(\w+)/);
    if (attrMatch) {
      const attrKey = attrMatch[1]!;
      const attrValue = attrMatch[2]!;
      return context.attributes?.[attrKey] === attrValue;
    }

    // Negation support (!mfa_verified)
    if (condition.startsWith('!')) {
      return !this.evaluateAuthenticationRule(condition.substring(1).trim(), context);
    }

    // Default: no matching condition
    return false;
  }

  private evaluateAuthorizationRule(_condition: string, _request: AccessRequest, _context: IdentityContext): boolean {
    // TODO: Implement authorization rule evaluation based on condition
    return false;
  }

  private evaluateDeviceRule(condition: string, context: IdentityContext): boolean {
    if (condition.includes('device_trusted')) {
      return context.deviceTrusted;
    }
    return false;
  }

  private evaluateNetworkRule(condition: string, context: IdentityContext): boolean {
    if (condition.includes('corporate_network')) {
      return this.isCorporateIP(context.ipAddress);
    }
    if (condition.includes('allowed_country')) {
      return this.isAllowedCountry(context.location.country);
    }
    return false;
  }

  private async evaluateBehavioralRule(condition: string, context: IdentityContext): Promise<boolean> {
    if (condition.includes('normal_behavior')) {
      const behaviorScore = await this.analyzeBehavior(context);
      return behaviorScore < 30;
    }
    return false;
  }

  private evaluateDataRule(_condition: string, _request: AccessRequest, _context: IdentityContext): boolean {
    return true;
  }

  private aggregateDecisions(decisions: AccessDecision[]): AccessDecision {
    if (decisions.length === 0) {
      return {
        allowed: false,
        reason: 'No policies configured',
        requirements: [],
      };
    }

    const anyDeny = decisions.find(d => !d.allowed);
    if (anyDeny) {
      return anyDeny;
    }

    const challenges = decisions.filter(d => d.requirements.length > 0);
    if (challenges.length > 0) {
      return challenges[0]!;
    }

    return decisions[0]!;
  }

  async createSession(context: IdentityContext, ttl: number = 3600): Promise<string> {
    const sessionId = this.generateId();
    const sessionContext = {
      ...context,
      sessionId,
    };

    const token = await new SignJWT({
      userId: context.userId,
      sessionId,
      deviceId: context.deviceId,
      riskScore: context.riskScore,
      trustLevel: context.trustLevel,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
      .sign(this.createSecretKey());

    this.activeSessions.set(sessionId, sessionContext);
    
    setTimeout(() => {
      this.activeSessions.delete(sessionId);
    }, ttl * 1000);

    return token;
  }

  async validateSession(token: string): Promise<IdentityContext | null> {
    try {
      const { payload } = await jwtVerify(token, this.createSecretKey());
      const session = this.activeSessions.get(payload['sessionId'] as string);
      
      if (!session) {
        return null;
      }

      const currentRiskScore = await this.calculateRiskScore(session);
      if (currentRiskScore > session.riskScore + 20) {
        await this.revokeSession(payload['sessionId'] as string);
        return null;
      }

      session.riskScore = currentRiskScore;
      session.trustLevel = this.getTrustLevel(currentRiskScore);
      session.lastActivity = new Date();

      return session;
    } catch (error) {
      return null;
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    this.emit('session-revoked', { sessionId });
  }

  async trustDevice(userId: string, deviceId: string, fingerprint: string): Promise<void> {
    this.trustedDevices.set(deviceId, {
      userId,
      fingerprint,
      trustedAt: new Date(),
    });
    
    this.emit('device-trusted', { userId, deviceId });
  }

  async untrustDevice(deviceId: string): Promise<void> {
    this.trustedDevices.delete(deviceId);
    this.emit('device-untrusted', { deviceId });
  }

  private async isDeviceTrusted(deviceId: string, userId: string): Promise<boolean> {
    const trusted = this.trustedDevices.get(deviceId);
    return trusted?.userId === userId || false;
  }

  private async getLocationFromIP(_ipAddress: string): Promise<IdentityContext['location']> {
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
    };
  }

  private isNewLocation(context: IdentityContext): boolean {
    return context.location.country === 'Unknown' || context.location.country === '';
  }

  private isSuspiciousTime(context: IdentityContext): boolean {
    const hour = context.lastActivity.getHours();
    return hour < 6 || hour > 22;
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    return userAgent.length < 10 || /bot|crawler|spider/i.test(userAgent);
  }

  private isCorporateIP(ipAddress: string): boolean {
    return this.corporateIPRanges.some(range => isIPInCIDR(ipAddress, range));
  }

  private isAllowedCountry(country: string): boolean {
    const allowedCountries = ['US', 'CA', 'GB', 'DE', 'FR'];
    return allowedCountries.includes(country) || country === '';
  }

  private async analyzeBehavior(_context: IdentityContext): Promise<number> {
    // TODO: Implement behavioral analysis
    return Math.random() * 20;
  }

  private getRecentEvents(userId: string, type: string, hours: number): SecurityEvent[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.securityEvents.filter(
      event => event.context.userId === userId && 
               event.type === type && 
               event.timestamp > cutoff
    );
  }

  private async logSecurityEvent(event: SecurityEvent): Promise<void> {
    this.securityEvents.push(event);
    this.emit('security-event', event);
    
    if (event.severity === 'critical') {
      this.emit('critical-security-event', event);
    }
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  private createSecretKey() {
    return new TextEncoder().encode(this.secretKey);
  }

  async getSecurityReport(): Promise<{
    totalEvents: number;
    criticalEvents: number;
    activeSessions: number;
    trustedDevices: number;
    averageRiskScore: number;
    recentEvents: SecurityEvent[];
  }> {
    const criticalEvents = this.securityEvents.filter(e => e.severity === 'critical').length;
    const averageRiskScore = Array.from(this.activeSessions.values())
      .reduce((sum, ctx) => sum + ctx.riskScore, 0) / (this.activeSessions.size || 1);

    return {
      totalEvents: this.securityEvents.length,
      criticalEvents,
      activeSessions: this.activeSessions.size,
      trustedDevices: this.trustedDevices.size,
      averageRiskScore,
      recentEvents: this.securityEvents.slice(-20),
    };
  }

  createPolicyTemplate(): PolicyTemplateBuilder {
    return new PolicyTemplateBuilder();
  }
}

export class PolicyTemplateBuilder {
  private policy: Partial<ZeroTrustPolicy> = {
    rules: [],
    enforcement: 'strict',
  };

  withName(name: string): PolicyTemplateBuilder {
    this.policy.name = name;
    return this;
  }

  withVersion(version: string): PolicyTemplateBuilder {
    this.policy.version = version;
    return this;
  }

  withEnforcement(enforcement: ZeroTrustPolicy['enforcement']): PolicyTemplateBuilder {
    this.policy.enforcement = enforcement;
    return this;
  }

  addAuthenticationRule(condition: string, action: ZeroTrustRule['action'], priority: number = 100): PolicyTemplateBuilder {
    this.policy.rules?.push({
      id: randomBytes(8).toString('hex'),
      type: 'authentication',
      condition,
      action,
      priority,
      enabled: true,
    });
    return this;
  }

  addDeviceRule(condition: string, action: ZeroTrustRule['action'], priority: number = 90): PolicyTemplateBuilder {
    this.policy.rules?.push({
      id: randomBytes(8).toString('hex'),
      type: 'device',
      condition,
      action,
      priority,
      enabled: true,
    });
    return this;
  }

  addNetworkRule(condition: string, action: ZeroTrustRule['action'], priority: number = 80): PolicyTemplateBuilder {
    this.policy.rules?.push({
      id: randomBytes(8).toString('hex'),
      type: 'network',
      condition,
      action,
      priority,
      enabled: true,
    });
    return this;
  }

  build(): Omit<ZeroTrustPolicy, 'id' | 'createdAt' | 'updatedAt'> {
    if (!this.policy.name || !this.policy.version) {
      throw new Error('Policy name and version are required');
    }
    return this.policy as Omit<ZeroTrustPolicy, 'id' | 'createdAt' | 'updatedAt'>;
  }
}

export const zeroTrustEngine = new ZeroTrustEngine();
