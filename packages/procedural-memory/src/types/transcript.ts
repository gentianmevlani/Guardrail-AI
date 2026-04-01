/**
 * Claude Code JSONL Transcript Types
 * ===================================
 * Mapped directly from the ~/.claude/projects/{project}/{sessionId}.jsonl schema.
 * Each line in the JSONL file is one of these record types.
 *
 * Source: https://gist.github.com/samkeen/dc6a9771a78d1ecee7eb9ec1307f1b52
 * Validated against: claude-code-log, claude-code-transcripts, and claude-code issues #20531, #24148
 */

// ─── Base Fields (present on every JSONL line) ───────────────────────────────

export interface TranscriptRecordBase {
  /** UUID of the parent message in the conversation tree, null for root */
  parentUuid: string | null;
  /** Whether this message is part of a subagent sidechain */
  isSidechain: boolean;
  /** Whether this is a meta/system message */
  isMeta?: boolean;
  /** 'external' for user input, 'internal' for system-generated */
  userType?: 'external' | 'internal';
  /** Current working directory at time of message */
  cwd: string;
  /** Session UUID — maps to the .jsonl filename */
  sessionId: string;
  /** Claude Code version string (e.g. "2.1.37") */
  version: string;
  /** Git branch at time of message */
  gitBranch?: string;
  /** Agent ID for subagent sessions */
  agentId?: string;
  /** Human-readable agent slug */
  slug?: string;
  /** Unique ID for this message */
  uuid: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Thinking level configuration */
  thinkingMetadata?: {
    level: 'none' | 'low' | 'medium' | 'high';
    disabled: boolean;
  };
  /** Active todo items at this point */
  todos?: TodoItem[];
  /** Whether this is an API error message */
  isApiErrorMessage?: boolean;
}

// ─── Message Content Types (inside message.content array) ────────────────────

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
}

export type MessageContent = TextContent | ThinkingContent | ToolUseContent | ToolResultContent;

// ─── Token Usage (on assistant messages) ─────────────────────────────────────

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// ─── User Message Record ─────────────────────────────────────────────────────

export interface UserRecord extends TranscriptRecordBase {
  type: 'user';
  message: {
    role: 'user';
    content: string | MessageContent[];
  };
}

// ─── Assistant Message Record ────────────────────────────────────────────────

export interface AssistantRecord extends TranscriptRecordBase {
  type: 'assistant';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: MessageContent[];
    stop_reason?: string;
    stop_sequence?: string | null;
    usage?: TokenUsage;
  };
}

// ─── Tool Result Record (user turn containing tool results) ──────────────────

export interface ToolResultRecord extends TranscriptRecordBase {
  type: 'user';
  toolUseResult?: {
    tool_use_id: string;
    content: string | Array<{ type: string; text?: string }>;
    is_error?: boolean;
  };
  message: {
    role: 'user';
    content: Array<ToolResultContent>;
  };
}

// ─── Summary Record (session summary, often first or last line) ──────────────

export interface SummaryRecord {
  type: 'summary';
  summary: string;
  leafUuid: string;
}

// ─── File History Snapshot ────────────────────────────────────────────────────

export interface FileHistorySnapshot {
  type: 'file-history-snapshot';
  messageId: string;
  trackedFileBackups: Record<string, {
    backupFileName: string | null;
    version: number;
    backupTime: string;
  }>;
}

// ─── Queue Operation ─────────────────────────────────────────────────────────

export interface QueueOperation {
  type: 'queue-operation';
  [key: string]: unknown;
}

// ─── Todo Items ──────────────────────────────────────────────────────────────

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'P0' | 'P1' | 'P2';
}

// ─── Union Type for All Records ──────────────────────────────────────────────

export type TranscriptRecord =
  | UserRecord
  | AssistantRecord
  | ToolResultRecord
  | SummaryRecord
  | FileHistorySnapshot
  | QueueOperation;

// ─── Known Tool Names in Claude Code ─────────────────────────────────────────

export type ClaudeCodeTool =
  | 'Bash'
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'MultiEdit'
  | 'Glob'
  | 'Grep'
  | 'LS'
  | 'TodoRead'
  | 'TodoWrite'
  | 'WebFetch'
  | 'WebSearch'
  | 'NotebookRead'
  | 'NotebookEdit'
  | 'Task'
  | 'TaskOutput'
  | string; // extensible for MCP tools, custom tools

// ─── Session Metadata (derived, not in JSONL directly) ───────────────────────

export interface SessionMetadata {
  sessionId: string;
  project: string;          // derived from folder path
  gitBranch: string;
  cwd: string;
  version: string;
  startTime: string;
  endTime: string;
  totalRecords: number;
  summary?: string;
}
