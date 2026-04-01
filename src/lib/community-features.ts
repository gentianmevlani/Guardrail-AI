/**
 * Community Features
 * 
 * Foundation for sharing workflows, templates, and best practices
 */

export interface SharedWorkflow {
  id: string;
  name: string;
  description: string;
  author: string;
  workflow: Record<string, unknown>;
  tags: string[];
  downloads: number;
  rating: number;
  createdAt: string;
}

export interface SharedTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  template: Record<string, unknown>;
  tags: string[];
  downloads: number;
  rating: number;
}

class CommunityFeatures {
  private sharedWorkflows: SharedWorkflow[] = [];
  private sharedTemplates: SharedTemplate[] = [];

  /**
   * Share workflow
   */
  async shareWorkflow(
    name: string,
    description: string,
    workflow: Record<string, unknown>,
    tags: string[] = []
  ): Promise<SharedWorkflow> {
    const shared: SharedWorkflow = {
      id: this.generateId(),
      name,
      description,
      author: 'local-user', // Would be actual user in production
      workflow,
      tags,
      downloads: 0,
      rating: 0,
      createdAt: new Date().toISOString(),
    };

    this.sharedWorkflows.push(shared);
    return shared;
  }

  /**
   * Share template
   */
  async shareTemplate(
    name: string,
    description: string,
    category: string,
    template: Record<string, unknown>,
    tags: string[] = []
  ): Promise<SharedTemplate> {
    const shared: SharedTemplate = {
      id: this.generateId(),
      name,
      description,
      category,
      author: 'local-user',
      template,
      tags,
      downloads: 0,
      rating: 0,
    };

    this.sharedTemplates.push(shared);
    return shared;
  }

  /**
   * Browse shared workflows
   */
  browseWorkflows(filters?: {
    tags?: string[];
    author?: string;
    minRating?: number;
  }): SharedWorkflow[] {
    let filtered = [...this.sharedWorkflows];

    if (filters?.tags && filters.tags.length > 0) {
      filtered = filtered.filter(w => 
        filters.tags!.some(tag => w.tags.includes(tag))
      );
    }

    if (filters?.author) {
      filtered = filtered.filter(w => w.author === filters.author);
    }

    if (filters?.minRating) {
      filtered = filtered.filter(w => w.rating >= filters.minRating!);
    }

    return filtered.sort((a, b) => b.downloads - a.downloads);
  }

  /**
   * Browse shared templates
   */
  browseTemplates(filters?: {
    category?: string;
    tags?: string[];
  }): SharedTemplate[] {
    let filtered = [...this.sharedTemplates];

    if (filters?.category) {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    if (filters?.tags && filters.tags.length > 0) {
      filtered = filtered.filter(t => 
        filters.tags!.some(tag => t.tags.includes(tag))
      );
    }

    return filtered.sort((a, b) => b.downloads - a.downloads);
  }

  /**
   * Import shared workflow
   */
  async importWorkflow(workflowId: string): Promise<Record<string, unknown>> {
    const workflow = this.sharedWorkflows.find(w => w.id === workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Increment downloads
    workflow.downloads += 1;

    return workflow.workflow;
  }

  /**
   * Import shared template
   */
  async importTemplate(templateId: string): Promise<Record<string, unknown>> {
    const template = this.sharedTemplates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    template.downloads += 1;
    return template.template;
  }

  private generateId(): string {
    return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const communityFeatures = new CommunityFeatures();

