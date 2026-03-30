import { ComplianceFramework, CheckResult } from './engine';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * SOC 2 Type II Compliance Framework
 * Focuses on Trust Services Criteria
 */
export const SOC2_FRAMEWORK: ComplianceFramework = {
  id: 'soc2',
  name: 'SOC 2 Type II',
  version: '2017',
  description: 'System and Organization Controls for Service Organizations',
  controls: [
    {
      id: 'CC6.1',
      title: 'Logical and Physical Access Controls',
      description: 'The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events',
      category: 'access-control',
      requirements: [
        'Identifies and manages the inventory of information assets',
        'Restricts logical access based on needs and authorization',
        'Identifies and authenticates users',
        'Considers network segmentation'
      ],
      automatedChecks: [
        {
          id: 'CC6.1-001',
          description: 'Verify authentication mechanisms in place',
          check: async (projectPath: string): Promise<CheckResult> => {
            // Check for authentication implementation
            const authFiles = [
              'src/auth',
              'src/middleware/auth',
              'config/auth'
            ];

            for (const authPath of authFiles) {
              if (existsSync(join(projectPath, authPath))) {
                return {
                  passed: true,
                  details: 'Authentication mechanisms found',
                  evidence: { path: authPath }
                };
              }
            }

            return {
              passed: false,
              details: 'No authentication mechanisms found in standard locations'
            };
          }
        },
        {
          id: 'CC6.1-002',
          description: 'Verify access control implementation',
          check: async (projectPath: string): Promise<CheckResult> => {
            // Check for role-based access control
            const rbacIndicators = ['role', 'permission', 'acl', 'authorization'];
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const hasRBAC = Object.keys(deps).some(dep =>
                rbacIndicators.some(indicator => dep.toLowerCase().includes(indicator))
              );

              if (hasRBAC) {
                return {
                  passed: true,
                  details: 'Access control libraries found',
                  evidence: { dependencies: Object.keys(deps).filter(d =>
                    rbacIndicators.some(i => d.toLowerCase().includes(i))
                  )}
                };
              }
            }

            return {
              passed: false,
              details: 'No access control libraries found'
            };
          }
        }
      ]
    },
    {
      id: 'CC6.6',
      title: 'Security Event Monitoring',
      description: 'The entity implements logical access security measures to protect against threats from sources outside its system boundaries',
      category: 'monitoring',
      requirements: [
        'Restricts access to protect against external threats',
        'Implements boundary protection systems',
        'Prevents and detects malicious software'
      ],
      automatedChecks: [
        {
          id: 'CC6.6-001',
          description: 'Verify logging implementation',
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
                  details: 'Logging library found',
                  evidence: { library: Object.keys(deps).find(d =>
                    loggingLibs.some(l => d.toLowerCase().includes(l))
                  )}
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
    },
    {
      id: 'CC6.7',
      title: 'Data Protection',
      description: 'The entity restricts the transmission, movement, and removal of information to authorized personnel',
      category: 'data-protection',
      requirements: [
        'Restricts data transmission',
        'Protects data at rest and in transit',
        'Implements encryption controls'
      ],
      automatedChecks: [
        {
          id: 'CC6.7-001',
          description: 'Verify encryption libraries in use',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const encryptionLibs = ['crypto', 'bcrypt', 'argon2', 'jose', 'jsonwebtoken'];
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
              details: 'No encryption libraries found'
            };
          }
        }
      ]
    },
    {
      id: 'CC7.2',
      title: 'System Component Monitoring',
      description: 'The entity monitors system components and the operation of those components',
      category: 'monitoring',
      requirements: [
        'Implements detection policies',
        'Monitors infrastructure and software',
        'Implements incident response'
      ],
      automatedChecks: [
        {
          id: 'CC7.2-001',
          description: 'Verify monitoring tools configured',
          check: async (projectPath: string): Promise<CheckResult> => {
            const packageJsonPath = join(projectPath, 'package.json');

            if (existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              const monitoringLibs = ['prometheus', 'datadog', 'newrelic', 'sentry', '@sentry'];
              const hasMonitoring = Object.keys(deps).some(dep =>
                monitoringLibs.some(lib => dep.toLowerCase().includes(lib))
              );

              if (hasMonitoring) {
                return {
                  passed: true,
                  details: 'Monitoring library found',
                  evidence: { library: Object.keys(deps).find(d =>
                    monitoringLibs.some(l => d.toLowerCase().includes(l))
                  )}
                };
              }
            }

            return {
              passed: false,
              details: 'No monitoring libraries found'
            };
          }
        }
      ]
    },
    {
      id: 'CC8.1',
      title: 'Change Management',
      description: 'The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures',
      category: 'change-management',
      requirements: [
        'Manages changes throughout the lifecycle',
        'Implements version control',
        'Tests changes before deployment'
      ],
      automatedChecks: [
        {
          id: 'CC8.1-001',
          description: 'Verify version control system in use',
          check: async (projectPath: string): Promise<CheckResult> => {
            const gitPath = join(projectPath, '.git');

            if (existsSync(gitPath)) {
              return {
                passed: true,
                details: 'Git version control found',
                evidence: { vcs: 'git' }
              };
            }

            return {
              passed: false,
              details: 'No version control system found'
            };
          }
        },
        {
          id: 'CC8.1-002',
          description: 'Verify CI/CD configuration',
          check: async (projectPath: string): Promise<CheckResult> => {
            const ciFiles = [
              '.github/workflows',
              '.gitlab-ci.yml',
              'jenkinsfile',
              '.circleci/config.yml'
            ];

            for (const ciFile of ciFiles) {
              if (existsSync(join(projectPath, ciFile))) {
                return {
                  passed: true,
                  details: 'CI/CD configuration found',
                  evidence: { config: ciFile }
                };
              }
            }

            return {
              passed: false,
              details: 'No CI/CD configuration found'
            };
          }
        }
      ]
    }
  ]
};
