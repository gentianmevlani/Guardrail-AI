import { ComplianceFramework, CheckResult } from './engine';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * HIPAA (Health Insurance Portability and Accountability Act) Compliance Framework
 */
export const HIPAA_FRAMEWORK: ComplianceFramework = {
  id: 'hipaa',
  name: 'HIPAA Security Rule',
  version: '2013',
  description: 'Health Insurance Portability and Accountability Act',
  controls: [
    {
      id: 'HIPAA-AC',
      title: 'Access Controls',
      description: 'Implement technical policies and procedures for electronic information systems',
      category: 'access-control',
      requirements: [
        'Unique user identification',
        'Emergency access procedure',
        'Automatic logoff',
        'Encryption and decryption'
      ],
      automatedChecks: [
        {
          id: 'HIPAA-AC-001',
          description: 'Verify user authentication',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const authLibs = ['passport', 'jsonwebtoken', 'jose', 'auth0', 'okta'];
              const hasAuth = Object.keys(deps).some(dep =>
                authLibs.some(lib => dep.toLowerCase().includes(lib))
              );

              if (hasAuth) {
                return {
                  passed: true,
                  details: 'Authentication library found',
                  evidence: { libraries: Object.keys(deps).filter(d =>
                    authLibs.some(l => d.toLowerCase().includes(l))
                  )}
                };
              }
            }

            return {
              passed: false,
              details: 'No authentication library found'
            };
          }
        },
        {
          id: 'HIPAA-AC-002',
          description: 'Check for session management',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const sessionLibs = ['express-session', 'cookie-session', 'session'];
              const hasSession = Object.keys(deps).some(dep =>
                sessionLibs.some(lib => dep.toLowerCase().includes(lib))
              );

              if (hasSession) {
                return {
                  passed: true,
                  details: 'Session management library found'
                };
              }
            }

            return {
              passed: false,
              details: 'No session management library found'
            };
          }
        }
      ]
    },
    {
      id: 'HIPAA-AUDIT',
      title: 'Audit Controls',
      description: 'Implement hardware, software, and/or procedural mechanisms that record and examine activity',
      category: 'logging',
      requirements: [
        'Record and examine system activity',
        'Log access to ePHI',
        'Maintain audit logs'
      ],
      automatedChecks: [
        {
          id: 'HIPAA-AUDIT-001',
          description: 'Verify audit logging',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const loggingLibs = ['winston', 'pino', 'bunyan', 'morgan'];
              const hasLogging = Object.keys(deps).some(dep =>
                loggingLibs.some(lib => dep.toLowerCase().includes(lib))
              );

              if (hasLogging) {
                return {
                  passed: true,
                  details: 'Audit logging library found'
                };
              }
            }

            return {
              passed: false,
              details: 'No audit logging library found'
            };
          }
        }
      ]
    },
    {
      id: 'HIPAA-INTEGRITY',
      title: 'Integrity Controls',
      description: 'Implement policies and procedures to protect ePHI from improper alteration or destruction',
      category: 'data-protection',
      requirements: [
        'Mechanism to authenticate ePHI',
        'Protect against unauthorized modification'
      ],
      automatedChecks: [
        {
          id: 'HIPAA-INTEGRITY-001',
          description: 'Check for data validation',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const validationLibs = ['zod', 'joi', 'yup', 'validator', 'ajv'];
              const hasValidation = Object.keys(deps).some(dep =>
                validationLibs.some(lib => dep.toLowerCase().includes(lib))
              );

              if (hasValidation) {
                return {
                  passed: true,
                  details: 'Data validation library found'
                };
              }
            }

            return {
              passed: false,
              details: 'No data validation library found'
            };
          }
        }
      ]
    },
    {
      id: 'HIPAA-TRANSMISSION',
      title: 'Transmission Security',
      description: 'Implement technical security measures to guard against unauthorized access to ePHI',
      category: 'security',
      requirements: [
        'Integrity controls',
        'Encryption during transmission'
      ],
      automatedChecks: [
        {
          id: 'HIPAA-TRANSMISSION-001',
          description: 'Verify encryption in transit',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const tlsLibs = ['https', 'tls', 'helmet'];
              const hasTLS = Object.keys(deps).some(dep =>
                tlsLibs.some(lib => dep.toLowerCase().includes(lib))
              );

              if (hasTLS) {
                return {
                  passed: true,
                  details: 'TLS/HTTPS library found'
                };
              }
            }

            return {
              passed: false,
              details: 'No TLS/HTTPS library found'
            };
          }
        }
      ]
    }
  ]
};
