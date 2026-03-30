import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ProjectOverrides {
  id?: string;
  name?: string;
  description?: string;
  repositoryUrl?: string;
  userId?: string;
  settings?: any;
}

export class ProjectFactory {
  private static counter = 0;

  static async create(overrides: ProjectOverrides = {}): Promise<any> {
    this.counter++;
    
    const projectData = {
      id: overrides.id || `test-project-${this.counter}`,
      name: overrides.name || `Test Project ${this.counter}`,
      description: overrides.description || `A test project for ${this.counter}`,
      repositoryUrl: overrides.repositoryUrl || `https://github.com/test/project-${this.counter}`,
      userId: overrides.userId || 'test-user-id',
      settings: overrides.settings || {
        scanOnPush: true,
        notifyOnFindings: true,
        autoFix: false
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    return await prisma.project.create({ data: projectData });
  }

  static async createMany(count: number, userId: string, overrides: ProjectOverrides = {}): Promise<any[]> {
    const projects = [];
    for (let i = 0; i < count; i++) {
      projects.push(await this.create({
        ...overrides,
        userId,
        name: overrides.name || `Test Project ${this.counter + i}`,
        repositoryUrl: overrides.repositoryUrl || `https://github.com/test/project-${this.counter + i}`
      }));
    }
    return projects;
  }

  static async createWithUser(userId: string, overrides: ProjectOverrides = {}): Promise<any> {
    return await this.create({
      ...overrides,
      userId
    });
  }
}
