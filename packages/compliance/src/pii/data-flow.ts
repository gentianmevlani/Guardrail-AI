export interface PIIFinding {
  category: string;
  value: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  context: string;
  severity: 'high' | 'medium' | 'low';
}

export interface Origin {
  type: 'input' | 'database' | 'api' | 'file' | 'environment';
  location: string;
  description: string;
}

export interface FlowPath {
  from: string;
  to: string;
  operation: string;
  line: number;
}

export interface Storage {
  type: 'database' | 'file' | 'memory' | 'cache' | 'external';
  location: string;
  encrypted: boolean;
}

export interface DataFlow {
  piiCategory: string;
  origins: Origin[];
  paths: FlowPath[];
  storage: Storage[];
  externalTransfers: string[];
}

export class DataFlowTracker {
  /**
   * Track where PII originates
   */
  trackOrigin(_finding: PIIFinding, _ast: any): Origin[] {
    const origins: Origin[] = [];

    // Simplified - in production would analyze AST deeply
    // Check if in request handler
    if (_finding.context.includes('req.body') || _finding.context.includes('request')) {
      origins.push({
        type: 'input',
        location: _finding.location.file,
        description: 'User input from HTTP request'
      });
    }

    // Check if from database query
    if (_finding.context.includes('db.') || _finding.context.includes('query') || _finding.context.includes('findMany')) {
      origins.push({
        type: 'database',
        location: _finding.location.file,
        description: 'Retrieved from database'
      });
    }

    // Check if from API call
    if (_finding.context.includes('fetch') || _finding.context.includes('axios') || _finding.context.includes('http.get')) {
      origins.push({
        type: 'api',
        location: _finding.location.file,
        description: 'Fetched from external API'
      });
    }

    // Check if from file
    if (_finding.context.includes('readFile') || _finding.context.includes('fs.')) {
      origins.push({
        type: 'file',
        location: _finding.location.file,
        description: 'Read from file system'
      });
    }

    // Check if from environment
    if (_finding.context.includes('process.env') || _finding.context.includes('env.')) {
      origins.push({
        type: 'environment',
        location: 'Environment variables',
        description: 'Loaded from environment variables'
      });
    }

    return origins;
  }

  /**
   * Track where PII flows through the codebase
   */
  trackFlow(_finding: PIIFinding, _ast: any): FlowPath[] {
    const paths: FlowPath[] = [];

    // Simplified - would analyze actual data flow in AST
    // This is a placeholder implementation

    return paths;
  }

  /**
   * Track where PII is stored
   */
  trackStorage(_finding: PIIFinding, _ast: any): Storage[] {
    const storage: Storage[] = [];

    // Check for database storage
    if (_finding.context.includes('save') || _finding.context.includes('insert') || _finding.context.includes('create')) {
      storage.push({
        type: 'database',
        location: 'Database (inferred)',
        encrypted: false // Would check encryption settings
      });
    }

    // Check for file storage
    if (_finding.context.includes('writeFile') || _finding.context.includes('fs.write')) {
      storage.push({
        type: 'file',
        location: _finding.location.file,
        encrypted: false
      });
    }

    // Check for cache storage
    if (_finding.context.includes('cache') || _finding.context.includes('redis')) {
      storage.push({
        type: 'cache',
        location: 'Cache (inferred)',
        encrypted: false
      });
    }

    return storage;
  }

  /**
   * Generate Mermaid diagram for data flows
   */
  generateDiagram(flows: DataFlow[]): string {
    let diagram = 'graph LR\n';

    for (const flow of flows) {
      const piiNode = `PII_${flow.piiCategory.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Origins
      for (const origin of flow.origins) {
        const originNode = `${origin.type}_${flow.piiCategory}`;
        diagram += `    ${originNode}[${origin.type}: ${origin.description}] --> ${piiNode}[${flow.piiCategory}]\n`;
      }

      // Storage
      for (const store of flow.storage) {
        const storeNode = `${store.type}_${flow.piiCategory}`;
        const encrypted = store.encrypted ? '🔒' : '🔓';
        diagram += `    ${piiNode} --> ${storeNode}[${encrypted} ${store.type}]\n`;
      }

      // External transfers
      for (const transfer of flow.externalTransfers) {
        const transferNode = `EXT_${transfer.replace(/[^a-zA-Z0-9]/g, '_')}`;
        diagram += `    ${piiNode} --> ${transferNode}[External: ${transfer}]\n`;
      }
    }

    return diagram;
  }

  /**
   * Analyze data flows for a project
   */
  analyzeDataFlows(findings: PIIFinding[]): DataFlow[] {
    const flowsByCategory = new Map<string, DataFlow>();

    for (const finding of findings) {
      if (!flowsByCategory.has(finding.category)) {
        flowsByCategory.set(finding.category, {
          piiCategory: finding.category,
          origins: [],
          paths: [],
          storage: [],
          externalTransfers: []
        });
      }

      const flow = flowsByCategory.get(finding.category)!;

      // Track origins (simplified without AST)
      const origins = this.trackOrigin(finding, null);
      for (const origin of origins) {
        if (!flow.origins.some(o => o.type === origin.type && o.location === origin.location)) {
          flow.origins.push(origin);
        }
      }

      // Track storage (simplified without AST)
      const storage = this.trackStorage(finding, null);
      for (const store of storage) {
        if (!flow.storage.some(s => s.type === store.type && s.location === store.location)) {
          flow.storage.push(store);
        }
      }
    }

    return Array.from(flowsByCategory.values());
  }
}

export const dataFlowTracker = new DataFlowTracker();
