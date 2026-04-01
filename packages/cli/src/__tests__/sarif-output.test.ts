/**
 * Tests for SARIF v2.1.0 output
 */

import { secretsToSarif, vulnerabilitiesToSarif, combinedToSarif } from '../formatters/sarif-v2';
import { STRIPE_TEST_PREFIX } from 'guardrail-security/secrets/stripe-placeholder-prefix';

describe('SARIF v2.1.0 Output', () => {
  describe('secretsToSarif', () => {
    it('should generate valid SARIF v2.1.0 for secrets scan', () => {
      const secretsResult = {
        projectPath: '/test/project',
        scanType: 'secrets',
        filesScanned: 42,
        patterns: ['API_KEY', 'AWS_SECRET'],
        findings: [
          {
            type: 'api_key',
            file: 'src/config.ts',
            line: 10,
            risk: 'high',
            confidence: 0.95,
            entropy: 4.5,
            match: `${STRIPE_TEST_PREFIX}***`,
            isTest: false,
            recommendation: {
              remediation: 'Move to environment variables',
            },
          },
        ],
        summary: {
          total: 1,
          highEntropy: 1,
          lowEntropy: 0,
          byRisk: { high: 1, medium: 0, low: 0 },
        },
      };

      const sarif = secretsToSarif(secretsResult);

      expect(sarif.$schema).toBe('https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json');
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs).toHaveLength(1);

      const run = sarif.runs[0]!;
      expect(run.tool.driver.name).toBe('guardrail');
      expect(run.tool.driver.rules).toBeDefined();
      expect(run.tool.driver.rules!.length).toBeGreaterThan(0);
      expect(run.results).toHaveLength(1);

      const result = run.results[0]!;
      expect(result.ruleId).toBe('api_key');
      expect(result.level).toBe('error');
      expect(result.message.text).toContain('api_key');
      expect(result.locations).toBeDefined();
      expect(result.locations![0]!.physicalLocation?.artifactLocation.uri).toBe('src/config.ts');
      expect(result.locations![0]!.physicalLocation?.region?.startLine).toBe(10);
      expect(result.fingerprints).toBeDefined();
      expect(result.properties).toBeDefined();
      expect(result.properties!.confidence).toBe(0.95);
    });

    it('should handle multiple findings with different types', () => {
      const secretsResult = {
        projectPath: '/test/project',
        scanType: 'secrets',
        filesScanned: 42,
        patterns: ['API_KEY', 'AWS_SECRET', 'JWT_TOKEN'],
        findings: [
          {
            type: 'api_key',
            file: 'src/config.ts',
            line: 10,
            risk: 'high',
            confidence: 0.95,
            entropy: 4.5,
            match: `${STRIPE_TEST_PREFIX}***`,
            isTest: false,
          },
          {
            type: 'aws_secret',
            file: 'src/aws.ts',
            line: 5,
            risk: 'high',
            confidence: 0.9,
            entropy: 5.0,
            match: 'AKIA***',
            isTest: false,
          },
          {
            type: 'jwt_token',
            file: 'src/auth.ts',
            line: 20,
            risk: 'medium',
            confidence: 0.7,
            entropy: 3.5,
            match: 'eyJ***',
            isTest: true,
          },
        ],
        summary: {
          total: 3,
          highEntropy: 2,
          lowEntropy: 1,
          byRisk: { high: 2, medium: 1, low: 0 },
        },
      };

      const sarif = secretsToSarif(secretsResult);

      expect(sarif.runs[0]!.tool.driver.rules).toHaveLength(3);
      expect(sarif.runs[0]!.results).toHaveLength(3);

      const ruleIds = sarif.runs[0]!.tool.driver.rules!.map(r => r.id);
      expect(ruleIds).toContain('api_key');
      expect(ruleIds).toContain('aws_secret');
      expect(ruleIds).toContain('jwt_token');
    });
  });

  describe('vulnerabilitiesToSarif', () => {
    it('should generate valid SARIF v2.1.0 for vulnerability scan', () => {
      const vulnResult = {
        projectPath: '/test/project',
        scanType: 'vulnerabilities',
        packagesScanned: 150,
        auditSource: 'npm',
        findings: [
          {
            package: 'lodash',
            version: '4.17.20',
            severity: 'high',
            cve: 'CVE-2021-23337',
            title: 'Command Injection',
            fixedIn: '4.17.21',
          },
        ],
        summary: {
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
        },
      };

      const sarif = vulnerabilitiesToSarif(vulnResult);

      expect(sarif.$schema).toBe('https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json');
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs).toHaveLength(1);

      const run = sarif.runs[0]!;
      expect(run.tool.driver.name).toBe('guardrail');
      expect(run.tool.driver.rules).toHaveLength(1);
      expect(run.results).toHaveLength(1);

      const result = run.results[0]!;
      expect(result.ruleId).toBe('vulnerable-dependency');
      expect(result.level).toBe('error');
      expect(result.message.text).toContain('CVE-2021-23337');
      expect(result.message.text).toContain('lodash');
      expect(result.properties!.cve).toBe('CVE-2021-23337');
      expect(result.properties!.fixedIn).toBe('4.17.21');
      expect(result.fixes).toBeDefined();
    });
  });

  describe('combinedToSarif', () => {
    it('should combine secrets and vulnerabilities into single SARIF', () => {
      const combinedResult = {
        secrets: {
          projectPath: '/test/project',
          scanType: 'secrets',
          filesScanned: 42,
          patterns: ['API_KEY'],
          findings: [
            {
              type: 'api_key',
              file: 'src/config.ts',
              line: 10,
              risk: 'high',
              confidence: 0.95,
              entropy: 4.5,
              match: `${STRIPE_TEST_PREFIX}***`,
              isTest: false,
            },
          ],
          summary: {
            total: 1,
            highEntropy: 1,
            lowEntropy: 0,
            byRisk: { high: 1, medium: 0, low: 0 },
          },
        },
        vulnerabilities: {
          projectPath: '/test/project',
          scanType: 'vulnerabilities',
          packagesScanned: 150,
          auditSource: 'npm',
          findings: [
            {
              package: 'lodash',
              version: '4.17.20',
              severity: 'high',
              cve: 'CVE-2021-23337',
              title: 'Command Injection',
              fixedIn: '4.17.21',
            },
          ],
          summary: {
            critical: 0,
            high: 1,
            medium: 0,
            low: 0,
          },
        },
        duration: 5000,
      };

      const sarif = combinedToSarif(combinedResult);

      expect(sarif.runs).toHaveLength(1);
      const run = sarif.runs[0]!;

      expect(run.tool.driver.rules!.length).toBeGreaterThanOrEqual(2);
      expect(run.results.length).toBe(2);

      const ruleIds = run.tool.driver.rules!.map(r => r.id);
      expect(ruleIds).toContain('api_key');
      expect(ruleIds).toContain('vulnerable-dependency');
    });

    it('should handle empty results', () => {
      const emptyResult = {
        secrets: {
          projectPath: '/test/project',
          scanType: 'secrets',
          filesScanned: 42,
          patterns: [],
          findings: [],
          summary: {
            total: 0,
            highEntropy: 0,
            lowEntropy: 0,
            byRisk: { high: 0, medium: 0, low: 0 },
          },
        },
        duration: 1000,
      };

      const sarif = combinedToSarif(emptyResult);

      expect(sarif.runs).toHaveLength(1);
      expect(sarif.runs[0]!.results).toHaveLength(0);
    });
  });

  describe('SARIF schema compliance', () => {
    it('should include required tool metadata', () => {
      const secretsResult = {
        projectPath: '/test/project',
        scanType: 'secrets',
        filesScanned: 42,
        patterns: ['API_KEY'],
        findings: [],
        summary: {
          total: 0,
          highEntropy: 0,
          lowEntropy: 0,
          byRisk: { high: 0, medium: 0, low: 0 },
        },
      };

      const sarif = secretsToSarif(secretsResult);
      const driver = sarif.runs[0]!.tool.driver;

      expect(driver.name).toBeDefined();
      expect(driver.version).toBeDefined();
      expect(driver.semanticVersion).toBeDefined();
      expect(driver.informationUri).toBeDefined();
      expect(driver.organization).toBe('guardrail Security');
    });

    it('should include invocation metadata', () => {
      const secretsResult = {
        projectPath: '/test/project',
        scanType: 'secrets',
        filesScanned: 42,
        patterns: ['API_KEY'],
        findings: [],
        summary: {
          total: 0,
          highEntropy: 0,
          lowEntropy: 0,
          byRisk: { high: 0, medium: 0, low: 0 },
        },
      };

      const sarif = secretsToSarif(secretsResult);
      const invocation = sarif.runs[0]!.invocations![0]!;

      expect(invocation.executionSuccessful).toBe(true);
      expect(invocation.startTimeUtc).toBeDefined();
      expect(invocation.endTimeUtc).toBeDefined();
      expect(invocation.workingDirectory).toBeDefined();
      expect(invocation.exitCode).toBe(0);
    });

    it('should include rule metadata with help', () => {
      const secretsResult = {
        projectPath: '/test/project',
        scanType: 'secrets',
        filesScanned: 42,
        patterns: ['API_KEY'],
        findings: [
          {
            type: 'api_key',
            file: 'src/config.ts',
            line: 10,
            risk: 'high',
            confidence: 0.95,
            entropy: 4.5,
            match: `${STRIPE_TEST_PREFIX}***`,
            isTest: false,
            recommendation: {
              remediation: 'Move to environment variables',
            },
          },
        ],
        summary: {
          total: 1,
          highEntropy: 1,
          lowEntropy: 0,
          byRisk: { high: 1, medium: 0, low: 0 },
        },
      };

      const sarif = secretsToSarif(secretsResult);
      const rule = sarif.runs[0]!.tool.driver.rules![0]!;

      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.shortDescription).toBeDefined();
      expect(rule.fullDescription).toBeDefined();
      expect(rule.help).toBeDefined();
      expect(rule.help!.text).toBeDefined();
      expect(rule.help!.markdown).toBeDefined();
      expect(rule.helpUri).toBeDefined();
      expect(rule.defaultConfiguration).toBeDefined();
      expect(rule.properties).toBeDefined();
    });
  });
});
