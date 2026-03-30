/**
 * Project Service
 * 
 * Manages project CRUD operations with database integration
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CreateProjectData {
  name: string;
  description?: string;
  path?: string;
  repositoryUrl?: string;
  userId: string;
}

interface UpdateProjectData {
  name?: string;
  description?: string;
  path?: string;
  repositoryUrl?: string;
}

interface ProjectStats {
  fileCount: number;
  lineCount: number;
  lastScanned: Date;
  languages: string[];
  frameworks: string[];
}

class ProjectService {
  /**
   * Create a new project
   */
  async createProject(data: CreateProjectData) {
    // Validate project path if provided
    if (data.path) {
      await this.validateProjectPath(data.path);
    }

    // Create project in database
    const project = await prisma.project.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description,
        path: data.path,
        repositoryUrl: data.repositoryUrl,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    // Initial scan if path provided
    if (data.path) {
      await this.scanProject(project.id, data.path);
    }

    return project;
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string, includeStats = false) {
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: includeStats ? {
        _count: {
          select: {
            usageRecords: true
          }
        }
      } : undefined
    });

    return projects;
  }

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string, userId?: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(userId && { userId })
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        usageRecords: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    return project;
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, userId: string, data: UpdateProjectData) {
    // Validate project path if provided
    if (data.path) {
      await this.validateProjectPath(data.path);
    }

    const project = await prisma.project.updateMany({
      where: {
        id: projectId,
        userId
      },
      data
    });

    if (project.count === 0) {
      throw new Error('Project not found or access denied');
    }

    // Re-scan if path changed
    if (data.path) {
      await this.scanProject(projectId, data.path);
    }

    return this.getProject(projectId);
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string, userId: string) {
    const result = await prisma.project.deleteMany({
      where: {
        id: projectId,
        userId
      }
    });

    if (result.count === 0) {
      throw new Error('Project not found or access denied');
    }
  }

  /**
   * Scan project and update stats
   */
  async scanProject(projectId: string, projectPath: string): Promise<ProjectStats> {
    const stats = await this.analyzeProject(projectPath);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        fileCount: stats.fileCount,
        // Store additional stats as JSON (lastScanned tracked via updatedAt)
        // Note: lineCount stored in sizeBytes for now as schema doesn't have lineCount
        sizeBytes: BigInt(stats.lineCount),
      }
    });

    // Record usage
    await this.recordUsage(projectId, 'scan', {
      fileCount: stats.fileCount,
      lineCount: stats.lineCount
    });

    return stats;
  }

  /**
   * Analyze project directory
   */
  private async analyzeProject(projectPath: string): Promise<ProjectStats> {
    const stats: ProjectStats = {
      fileCount: 0,
      lineCount: 0,
      lastScanned: new Date(),
      languages: [],
      frameworks: []
    };

    try {
      // Count files and lines
      const extensions = new Map<string, number>();
      const files = await this.getAllFiles(projectPath);

      stats.fileCount = files.length;

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n').length;
        stats.lineCount += lines;

        // Track languages
        const ext = path.extname(file);
        extensions.set(ext, (extensions.get(ext) || 0) + 1);
      }

      // Convert extensions to language names
      stats.languages = Array.from(extensions.keys())
        .map(ext => this.getLanguageFromExtension(ext))
        .filter((lang, index, arr) => arr.indexOf(lang) === index);

      // Detect frameworks
      stats.frameworks = await this.detectFrameworks(projectPath);

    } catch (error) {
      console.error('Error analyzing project:', error);
    }

    return stats;
  }

  /**
   * Get all files in directory recursively
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...await this.getAllFiles(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Get language name from file extension
   */
  private getLanguageFromExtension(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.cs': 'C#',
      '.cpp': 'C++',
      '.c': 'C',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sass': 'Sass',
      '.less': 'Less',
      '.json': 'JSON',
      '.xml': 'XML',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.md': 'Markdown',
      '.sql': 'SQL',
      '.sh': 'Shell',
      '.bash': 'Bash',
      '.zsh': 'Zsh'
    };

    return map[ext] || ext.substring(1).toUpperCase();
  }

  /**
   * Detect frameworks used in project
   */
  private async detectFrameworks(projectPath: string): Promise<string[]> {
    const frameworks: string[] = [];

    try {
      // Check package.json for Node.js frameworks
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Full-stack frameworks
        if (deps.next) frameworks.push('Next.js');
        if (deps.nuxt || deps['@nuxt/core']) frameworks.push('Nuxt');
        if (deps['@remix-run/node'] || deps['@remix-run/react']) frameworks.push('Remix');
        
        // Frontend frameworks
        if (deps.react || deps['react-dom']) frameworks.push('React');
        if (deps.vue) frameworks.push('Vue');
        if (deps['@angular/core']) frameworks.push('Angular');
        if (deps.svelte || deps['svelte-kit']) frameworks.push('Svelte');
        
        // Build tools
        if (deps.vite || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) {
          frameworks.push('Vite');
        }
        if (deps.webpack) frameworks.push('Webpack');
        if (deps.turbopack) frameworks.push('Turbopack');
        
        // Backend frameworks
        if (deps.express) frameworks.push('Express');
        if (deps.fastify) frameworks.push('Fastify');
        if (deps.koa) frameworks.push('Koa');
        if (deps['@nestjs/core']) frameworks.push('NestJS');
      }

      // Check for Python frameworks
      if (await this.fileExists(path.join(projectPath, 'requirements.txt'))) {
        const requirements = await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf-8');
        if (requirements.includes('django')) frameworks.push('Django');
        if (requirements.includes('flask')) frameworks.push('Flask');
        if (requirements.includes('fastapi')) frameworks.push('FastAPI');
      }

      // Check for Java frameworks
      if (await this.fileExists(path.join(projectPath, 'pom.xml'))) {
        frameworks.push('Maven');
      }
      if (await this.fileExists(path.join(projectPath, 'build.gradle'))) {
        frameworks.push('Gradle');
      }

    } catch (error) {
      console.error('Error detecting frameworks:', error);
    }

    return frameworks;
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate project path
   */
  private async validateProjectPath(projectPath: string): Promise<void> {
    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error('Path must be a directory');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error('Invalid project path: ' + message);
    }
  }

  /**
   * Record project usage
   */
  private async recordUsage(projectId: string, type: string, metadata?: any): Promise<void> {
    // Get userId from project for the usage record
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
    if (!project) return;
    
    await prisma.usageRecord.create({
      data: {
        projectId,
        userId: project.userId,
        type,
        metadata: metadata || {}
      }
    });
  }

  /**
   * Get project usage statistics
   */
  async getProjectStats(projectId: string, userId: string, days = 30) {
    const project = await this.getProject(projectId, userId);
    
    const usage = await prisma.usageRecord.groupBy({
      by: ['type'],
      where: {
        projectId,
        createdAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      },
      _count: true
    });

    return {
      project,
      usage: usage.map(u => ({
        type: u.type,
        count: u._count
      })),
      period: `${days} days`
    };
  }
}

// Export singleton instance
export const projectService = new ProjectService();
