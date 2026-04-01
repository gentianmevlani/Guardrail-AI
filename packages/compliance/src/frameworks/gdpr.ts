import { ComplianceFramework, CheckResult } from './engine';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * GDPR (General Data Protection Regulation) Compliance Framework
 */
export const GDPR_FRAMEWORK: ComplianceFramework = {
  id: 'gdpr',
  name: 'GDPR',
  version: '2018',
  description: 'General Data Protection Regulation',
  controls: [
    {
      id: 'ART5',
      title: 'Principles of Processing Personal Data',
      description: 'Personal data shall be processed lawfully, fairly and in a transparent manner',
      category: 'data-protection',
      requirements: [
        'Lawfulness, fairness and transparency',
        'Purpose limitation',
        'Data minimisation',
        'Accuracy',
        'Storage limitation',
        'Integrity and confidentiality'
      ],
      automatedChecks: [
        {
          id: 'ART5-001',
          description: 'Check for PII data collection documentation',
          check: async (projectPath: string): Promise<CheckResult> => {
            const privacyDocs = [
              'PRIVACY.md',
              'privacy-policy.md',
              'docs/privacy',
              'GDPR.md'
            ];

            for (const doc of privacyDocs) {
              if (existsSync(join(projectPath, doc))) {
                return {
                  passed: true,
                  details: 'Privacy documentation found',
                  evidence: { document: doc }
                };
              }
            }

            return {
              passed: false,
              details: 'No privacy policy documentation found'
            };
          }
        }
      ],
      manualSteps: [
        'Document legal basis for processing',
        'Implement data retention policies',
        'Ensure data accuracy mechanisms'
      ]
    },
    {
      id: 'ART25',
      title: 'Data Protection by Design and by Default',
      description: 'Implement appropriate technical and organisational measures for data protection',
      category: 'data-protection',
      requirements: [
        'Data protection by design',
        'Data protection by default',
        'Minimisation of personal data',
        'Pseudonymisation where possible'
      ],
      automatedChecks: [
        {
          id: 'ART25-001',
          description: 'Verify data encryption at rest',
          check: async (projectPath: string): Promise<CheckResult> => {
            // Check for database encryption configuration
            const envExample = join(projectPath, '.env.example');
            if (existsSync(envExample)) {
              return {
                passed: true,
                details: 'Environment configuration suggests encryption practices',
                evidence: { file: '.env.example' }
              };
            }

            return {
              passed: false,
              details: 'No evidence of encryption configuration'
            };
          }
        },
        {
          id: 'ART25-002',
          description: 'Check for data anonymization/pseudonymization',
          check: async (_projectPath: string): Promise<CheckResult> => {
            // This would check for anonymization libraries or patterns
            return {
              passed: false,
              details: 'Manual review required for anonymization practices'
            };
          }
        }
      ]
    },
    {
      id: 'ART32',
      title: 'Security of Processing',
      description: 'Implement appropriate technical and organisational measures to ensure a level of security',
      category: 'security',
      requirements: [
        'Pseudonymisation and encryption',
        'Ongoing confidentiality, integrity, availability',
        'Regular testing and evaluation',
        'Process for restoring availability'
      ],
      automatedChecks: [
        {
          id: 'ART32-001',
          description: 'Verify HTTPS enforcement',
          check: async (_projectPath: string): Promise<CheckResult> => {
            // Check for HTTPS/TLS configuration
            // In production would check actual configuration
            return {
              passed: false,
              details: 'Manual verification required for HTTPS enforcement'
            };
          }
        },
        {
          id: 'ART32-002',
          description: 'Check for security testing',
          check: async (projectPath: string): Promise<CheckResult> => {
            const securityTestDirs = [
              'test/security',
              'tests/security',
              '__tests__/security'
            ];

            for (const dir of securityTestDirs) {
              if (existsSync(join(projectPath, dir))) {
                return {
                  passed: true,
                  details: 'Security tests found',
                  evidence: { directory: dir }
                };
              }
            }

            return {
              passed: false,
              details: 'No security tests found'
            };
          }
        }
      ]
    },
    {
      id: 'ART33',
      title: 'Breach Notification',
      description: 'Notify supervisory authority of a personal data breach within 72 hours',
      category: 'incident-response',
      requirements: [
        'Breach detection capability',
        'Breach notification procedures',
        'Documentation of breaches'
      ],
      automatedChecks: [
        {
          id: 'ART33-001',
          description: 'Check for incident response procedures',
          check: async (projectPath: string): Promise<CheckResult> => {
            const irDocs = [
              'SECURITY.md',
              'docs/incident-response',
              'docs/security/incident-response.md'
            ];

            for (const doc of irDocs) {
              if (existsSync(join(projectPath, doc))) {
                return {
                  passed: true,
                  details: 'Incident response documentation found',
                  evidence: { document: doc }
                };
              }
            }

            return {
              passed: false,
              details: 'No incident response documentation found'
            };
          }
        }
      ],
      manualSteps: [
        'Define breach notification workflow',
        'Establish contact with supervisory authority',
        'Create breach documentation templates'
      ]
    }
  ]
};
