export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IssueType = 
  | 'mock_data' 
  | 'placeholder_api' 
  | 'hardcoded_secret' 
  | 'todo_fixme' 
  | 'console_log'
  | 'debug_code';

export interface ScanIssue {
  type: IssueType;
  severity: IssueSeverity;
  line: number;
  column: number;
  message: string;
  snippet: string;
  autoFixAvailable: boolean;
  suggestedFix?: string;
  ruleId: string;
}

export interface LocalScanResult {
  file: string;
  relativePath: string;
  language: string;
  issues: ScanIssue[];
  scannedAt: number;
  parseTime: number;
}

export interface ScanSummary {
  totalFiles: number;
  totalIssues: number;
  bySeverity: Record<IssueSeverity, number>;
  byType: Record<IssueType, number>;
  scanDuration: number;
  filesWithIssues: number;
}

export interface ScanProgress {
  phase: 'validating' | 'parsing' | 'scanning' | 'complete' | 'error';
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
  issuesFound: number;
  percentage: number;
}

export interface FileValidationResult {
  valid: boolean;
  file: File;
  error?: string;
  relativePath: string;
}

export interface ValidationError {
  file: string;
  reason: 'size' | 'type' | 'count' | 'total_size';
  message: string;
}

export interface ScannerConfig {
  maxFiles: number;
  maxTotalSize: number;
  maxFileSize: number;
  allowedExtensions: string[];
  enabledRules: string[];
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  maxFiles: 50,
  maxTotalSize: 10 * 1024 * 1024, // 10MB
  maxFileSize: 1 * 1024 * 1024, // 1MB per file
  allowedExtensions: [
    '.js', '.jsx', '.ts', '.tsx',
    '.py',
    '.json', '.env',
    '.yaml', '.yml'
  ],
  enabledRules: [
    'mock-data',
    'placeholder-api',
    'hardcoded-secret',
    'todo-fixme',
    'console-log',
    'debug-code'
  ]
};

export interface WorkerMessage {
  type: 'scan' | 'cancel';
  files?: { name: string; content: string; relativePath: string }[];
  config?: ScannerConfig;
}

export interface WorkerResponse {
  type: 'progress' | 'result' | 'error' | 'complete';
  progress?: ScanProgress;
  result?: LocalScanResult;
  error?: string;
  summary?: ScanSummary;
}

export interface ExportFormat {
  type: 'json' | 'sarif' | 'csv';
  filename: string;
}

export function getLanguageFromExtension(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  const langMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.json': 'json',
    '.env': 'env',
    '.yaml': 'yaml',
    '.yml': 'yaml'
  };
  return langMap[ext] || 'text';
}

export function getSeverityColor(severity: IssueSeverity): string {
  const colors: Record<IssueSeverity, string> = {
    critical: 'text-red-500',
    high: 'text-orange-500',
    medium: 'text-yellow-500',
    low: 'text-blue-500'
  };
  return colors[severity];
}

export function getSeverityBgColor(severity: IssueSeverity): string {
  const colors: Record<IssueSeverity, string> = {
    critical: 'bg-red-500/10 border-red-500/20',
    high: 'bg-orange-500/10 border-orange-500/20',
    medium: 'bg-yellow-500/10 border-yellow-500/20',
    low: 'bg-blue-500/10 border-blue-500/20'
  };
  return colors[severity];
}
