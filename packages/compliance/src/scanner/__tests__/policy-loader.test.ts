import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyLoader } from '../policy-loader';
import { EvaluationContext } from '../types';

describe('PolicyLoader', () => {
  let loader: PolicyLoader;
  let mockContext: EvaluationContext;

  beforeEach(() => {
    loader = new PolicyLoader();
    mockContext = {
      projectPath: '/test/project',
      files: new Map([
        ['src/server.ts', 'https.createServer()'],
        ['package.json', '{}']
      ]),
      config: {
        hasAuth: true,
        hasEncryption: true,
        hasLogging: true,
        hasMonitoring: false,
        hasRBAC: true,
        hasVersionControl: true,
        hasCICD: false,
        hasSecrets: false,
        hasBackup: false,
        hasAuditLog: true
      },
      dependencies: {
        'bcrypt': '^5.0.0',
        'winston': '^3.0.0',
        'passport': '^0.6.0'
      }
    };
  });

  describe('loadPolicies', () => {
    it('should load SOC2 policies', () => {
      const policies = loader.loadPolicies('soc2');
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.every(p => p.id)).toBe(true);
      expect(policies.every(p => p.controlId)).toBe(true);
    });

    it('should load GDPR policies', () => {
      const policies = loader.loadPolicies('gdpr');
      expect(policies.length).toBeGreaterThan(0);
    });

    it('should load HIPAA policies', () => {
      const policies = loader.loadPolicies('hipaa');
      expect(policies.length).toBeGreaterThan(0);
    });

    it('should load PCI policies', () => {
      const policies = loader.loadPolicies('pci');
      expect(policies.length).toBeGreaterThan(0);
    });

    it('should load ISO27001 policies', () => {
      const policies = loader.loadPolicies('iso27001');
      expect(policies.length).toBeGreaterThan(0);
    });

    it('should load NIST policies', () => {
      const policies = loader.loadPolicies('nist');
      expect(policies.length).toBeGreaterThan(0);
    });
  });

  describe('policy evaluation', () => {
    it('should evaluate file-exists check correctly', async () => {
      const policies = loader.loadPolicies('soc2');
      const authPolicy = policies.find(p => p.id.includes('CC6.1-001'));
      
      if (authPolicy) {
        const result = await authPolicy.evaluate(mockContext);
        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('controlId');
        expect(result).toHaveProperty('severity');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('evidenceRefs');
        expect(result).toHaveProperty('remediation');
      }
    });

    it('should evaluate dependency-present check correctly', async () => {
      const policies = loader.loadPolicies('soc2');
      const encryptionPolicy = policies.find(p => p.id.includes('CC6.7-001'));
      
      if (encryptionPolicy) {
        const result = await encryptionPolicy.evaluate(mockContext);
        expect(result.passed).toBe(true);
        expect(result.evidenceRefs).toContain('package.json');
      }
    });

    it('should evaluate config-value check correctly', async () => {
      const policies = loader.loadPolicies('soc2');
      const auditPolicy = policies.find(p => p.id.includes('CC6.6-002'));
      
      if (auditPolicy) {
        const result = await auditPolicy.evaluate(mockContext);
        expect(result.passed).toBe(true);
      }
    });

    it('should evaluate pattern-match check correctly', async () => {
      const policies = loader.loadPolicies('soc2');
      const tlsPolicy = policies.find(p => p.id.includes('CC6.7-002'));
      
      if (tlsPolicy) {
        const result = await tlsPolicy.evaluate(mockContext);
        expect(result).toHaveProperty('passed');
      }
    });

    it('should fail when dependency is missing', async () => {
      const contextWithoutDeps: EvaluationContext = {
        ...mockContext,
        dependencies: {}
      };

      const policies = loader.loadPolicies('soc2');
      const encryptionPolicy = policies.find(p => p.id.includes('CC6.7-001'));
      
      if (encryptionPolicy) {
        const result = await encryptionPolicy.evaluate(contextWithoutDeps);
        expect(result.passed).toBe(false);
      }
    });

    it('should fail when config value is incorrect', async () => {
      const contextWithoutAuth: EvaluationContext = {
        ...mockContext,
        config: { ...mockContext.config, hasAuth: false }
      };

      const policies = loader.loadPolicies('gdpr');
      const authPolicy = policies.find(p => p.id.includes('ART32-002'));
      
      if (authPolicy) {
        const result = await authPolicy.evaluate(contextWithoutAuth);
        expect(result.passed).toBe(false);
      }
    });
  });

  describe('severity levels', () => {
    it('should have critical severity for security controls', () => {
      const policies = loader.loadPolicies('soc2');
      const criticalPolicies = policies.filter(p => p.severity === 'critical');
      expect(criticalPolicies.length).toBeGreaterThan(0);
    });

    it('should include all severity levels', () => {
      const policies = loader.loadPolicies('soc2');
      const severities = new Set(policies.map(p => p.severity));
      expect(severities.size).toBeGreaterThan(1);
    });
  });
});
