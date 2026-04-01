import { ComplianceFramework, CheckResult } from './engine';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * PCI-DSS (Payment Card Industry Data Security Standard) Compliance Framework
 */
export const PCI_FRAMEWORK: ComplianceFramework = {
  id: 'pci',
  name: 'PCI-DSS',
  version: '4.0',
  description: 'Payment Card Industry Data Security Standard',
  controls: [
    {
      id: 'PCI-REQ1',
      title: 'Install and Maintain Network Security Controls',
      description: 'Network security controls protect the cardholder data environment',
      category: 'network-security',
      requirements: [
        'Install and configure network security controls',
        'Configure network security controls to prevent unauthorized access',
        'Deny all traffic by default'
      ],
      automatedChecks: [
        {
          id: 'PCI-REQ1-001',
          description: 'Check for firewall configuration',
          check: async (projectPath: string): Promise<CheckResult> => {
            // Check for network security configuration files
            const securityConfigs = [
              'firewall.rules',
              'security-groups.tf',
              'network-policy.yaml'
            ];

            for (const config of securityConfigs) {
              if (existsSync(join(projectPath, config))) {
                return {
                  passed: true,
                  details: 'Network security configuration found',
                  evidence: { config }
                };
              }
            }

            return {
              passed: false,
              details: 'No network security configuration found'
            };
          }
        }
      ]
    },
    {
      id: 'PCI-REQ3',
      title: 'Protect Stored Account Data',
      description: 'Protection methods must be in place to protect stored account data',
      category: 'data-protection',
      requirements: [
        'Keep cardholder data storage to a minimum',
        'Do not store sensitive authentication data after authorization',
        'Render PAN unreadable',
        'Manage cryptographic keys used for encryption'
      ],
      automatedChecks: [
        {
          id: 'PCI-REQ3-001',
          description: 'Check for encryption libraries',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const encryptionLibs = ['crypto', 'bcrypt', 'argon2', 'node-forge'];
              const hasEncryption = Object.keys(deps).some(dep =>
                encryptionLibs.some(lib => dep.toLowerCase().includes(lib))
              );

              if (hasEncryption) {
                return {
                  passed: true,
                  details: 'Encryption library found',
                  evidence: { libraries: Object.keys(deps).filter(d =>
                    encryptionLibs.some(l => d.toLowerCase().includes(l))
                  )}
                };
              }
            }

            return {
              passed: false,
              details: 'No encryption library found'
            };
          }
        },
        {
          id: 'PCI-REQ3-002',
          description: 'Scan for potential PAN storage',
          check: async (_projectPath: string): Promise<CheckResult> => {
            // This would scan for credit card patterns in code
            // Simplified for demonstration
            return {
              passed: false,
              details: 'Manual review required for PAN storage practices'
            };
          }
        }
      ]
    },
    {
      id: 'PCI-REQ6',
      title: 'Develop and Maintain Secure Systems',
      description: 'Security vulnerabilities in systems and applications provide criminals with potential access',
      category: 'secure-development',
      requirements: [
        'Define and implement secure development processes',
        'Develop software securely',
        'Security vulnerabilities are identified and addressed',
        'Public-facing web applications are protected'
      ],
      automatedChecks: [
        {
          id: 'PCI-REQ6-001',
          description: 'Check for security testing',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const scripts = packageJson.scripts || {};
              const hasSecurityTests = Object.keys(scripts).some(script =>
                script.includes('security') || script.includes('audit')
              );

              if (hasSecurityTests) {
                return {
                  passed: true,
                  details: 'Security testing scripts found',
                  evidence: { scripts: Object.keys(scripts).filter(s =>
                    s.includes('security') || s.includes('audit')
                  )}
                };
              }
            }

            return {
              passed: false,
              details: 'No security testing scripts found'
            };
          }
        },
        {
          id: 'PCI-REQ6-002',
          description: 'Check for dependency vulnerability scanning',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const scanningLibs = ['snyk', 'audit', 'npm-check'];
              const hasScanning = Object.keys(deps).some(dep =>
                scanningLibs.some(lib => dep.toLowerCase().includes(lib))
              );

              if (hasScanning) {
                return {
                  passed: true,
                  details: 'Vulnerability scanning tool found'
                };
              }
            }

            return {
              passed: false,
              details: 'No vulnerability scanning tool found'
            };
          }
        }
      ]
    },
    {
      id: 'PCI-REQ10',
      title: 'Log and Monitor All Access',
      description: 'Logging mechanisms and the ability to track user activities are critical',
      category: 'logging',
      requirements: [
        'Log all access to system components and cardholder data',
        'Perform audit log reviews to identify anomalies',
        'Retain audit logs for at least 12 months',
        'Protect log data from unauthorized modification'
      ],
      automatedChecks: [
        {
          id: 'PCI-REQ10-001',
          description: 'Verify comprehensive logging',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const loggingLibs = ['winston', 'pino', 'bunyan', 'morgan', 'log4js'];
              const hasLogging = Object.keys(deps).some(dep =>
                loggingLibs.some(lib => dep.toLowerCase().includes(lib))
              );

              if (hasLogging) {
                return {
                  passed: true,
                  details: 'Comprehensive logging library found'
                };
              }
            }

            return {
              passed: false,
              details: 'No logging library found'
            };
          }
        }
      ]
    }
  ]
};
