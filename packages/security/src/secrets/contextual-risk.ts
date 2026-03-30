/**
 * contextual-risk.ts
 * Adjust risk levels based on file context (examples, templates, production code)
 */

import { RiskLevel } from './patterns';

export interface RiskContext {
  filePath: string;
  entropy: number;
  originalRisk: RiskLevel;
}

/**
 * Adjust risk based on file context
 */
export function adjustRiskByContext(context: RiskContext): RiskLevel {
  const { filePath, entropy, originalRisk } = context;
  const lowerPath = filePath.toLowerCase();

  // Example/template files: downgrade unless extremely high entropy
  if (isExampleOrTemplate(lowerPath)) {
    if (entropy >= 5.0) {
      // Extremely high entropy in example file - suspicious, keep original risk
      return originalRisk;
    }
    
    // Downgrade risk for example/template files
    if (originalRisk === 'high') return 'medium';
    if (originalRisk === 'medium') return 'low';
    return 'low';
  }

  // Production-like files: upgrade risk for medium findings
  if (isProductionContext(lowerPath)) {
    if (originalRisk === 'medium' && entropy >= 4.5) {
      return 'high';
    }
  }

  return originalRisk;
}

/**
 * Check if file is an example or template
 */
function isExampleOrTemplate(filePath: string): boolean {
  const patterns = [
    /\.example$/,
    /\.template$/,
    /\.sample$/,
    /\.dist$/,
    /\.example\./,
    /\.template\./,
    /\.sample\./,
    /env\.example/,
    /config\.example/,
    /settings\.example/,
    /\/examples?\//,
    /\/templates?\//,
    /\/samples?\//,
    /\/demo\//,
    /\/fixtures?\//,
  ];

  return patterns.some(p => p.test(filePath));
}

/**
 * Check if file is in production context
 */
function isProductionContext(filePath: string): boolean {
  const patterns = [
    /^\.env$/,
    /\/\.env$/,
    /\/config\/production\./,
    /\/config\/prod\./,
    /production\.config/,
    /prod\.config/,
    /\/src\/config\//,
    /\/lib\/config\//,
    /\/app\/config\//,
  ];

  return patterns.some(p => p.test(filePath));
}

/**
 * Get context description for reporting
 */
export function getContextDescription(filePath: string): string {
  const lowerPath = filePath.toLowerCase();
  
  if (isExampleOrTemplate(lowerPath)) {
    return 'example/template file';
  }
  
  if (isProductionContext(lowerPath)) {
    return 'production configuration';
  }
  
  return 'source file';
}
