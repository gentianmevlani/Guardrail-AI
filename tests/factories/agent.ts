import { PrismaClient, AgentStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface AgentOverrides {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  status?: AgentStatus;
  projectId?: string;
  config?: any;
  capabilities?: string[];
}

export class AgentFactory {
  private static counter = 0;

  static async create(overrides: AgentOverrides = {}): Promise<any> {
    this.counter++;
    
    const agentData = {
      id: overrides.id || `test-agent-${this.counter}`,
      name: overrides.name || `Test Agent ${this.counter}`,
      description: overrides.description || `A test agent for ${this.counter}`,
      type: overrides.type || 'SECURITY',
      status: overrides.status || AgentStatus.ACTIVE,
      projectId: overrides.projectId || 'test-project-id',
      config: overrides.config || {
        scanInterval: 3600,
        sensitivity: 'medium',
        autoFix: false
      },
      capabilities: overrides.capabilities || [
        'secret-detection',
        'vulnerability-scan',
        'code-analysis'
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    return await prisma.agent.create({ data: agentData });
  }

  static async createMany(count: number, projectId: string, overrides: AgentOverrides = {}): Promise<any[]> {
    const agents = [];
    for (let i = 0; i < count; i++) {
      agents.push(await this.create({
        ...overrides,
        projectId,
        name: overrides.name || `Test Agent ${this.counter + i}`,
        description: overrides.description || `A test agent for ${this.counter + i}`
      }));
    }
    return agents;
  }

  static async createSecurityAgent(projectId: string, overrides: AgentOverrides = {}): Promise<any> {
    return await this.create({
      ...overrides,
      projectId,
      type: 'SECURITY',
      name: overrides.name || 'Security Agent',
      capabilities: [
        'secret-detection',
        'vulnerability-scan',
        'attack-surface-analysis'
      ]
    });
  }

  static async createComplianceAgent(projectId: string, overrides: AgentOverrides = {}): Promise<any> {
    return await this.create({
      ...overrides,
      projectId,
      type: 'COMPLIANCE',
      name: overrides.name || 'Compliance Agent',
      capabilities: [
        'gdpr-check',
        'hipaa-validation',
        'pci-scan'
      ]
    });
  }

  static async createAIAgent(projectId: string, overrides: AgentOverrides = {}): Promise<any> {
    return await this.create({
      ...overrides,
      projectId,
      type: 'AI',
      name: overrides.name || 'AI Guard Agent',
      capabilities: [
        'injection-detection',
        'prompt-validation',
        'content-filtering'
      ]
    });
  }
}
