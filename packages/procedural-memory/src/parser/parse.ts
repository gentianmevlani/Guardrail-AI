/**
 * Transcript Parser
 * =================
 * Reads Claude Code JSONL transcripts from ~/.claude/projects/
 * and transforms them into DecisionGraphs.
 *
 * This is the foundational layer — everything else builds on these graphs.
 *
 * Key design decisions:
 * - We skip sidechain messages (subagent work) — they have their own transcripts
 * - We classify each turn into a NodeType using heuristics first, LLM fallback later
 * - We detect corrections by looking for user messages that redirect after agent action
 * - We detect backtracks by looking for agent messages that acknowledge failure
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import {
  type TranscriptRecord,
  type UserRecord,
  type AssistantRecord,
  type SummaryRecord,
  type MessageContent,
  type ToolUseContent,
  type TextContent,
  type SessionMetadata,
} from '../types/transcript';
import {
  type DecisionGraph,
  type DecisionNode,
  type DecisionEdge,
  type NodeType,
  type EdgeType,
  type SessionMetrics,
} from '../types/decision-graph';

// ─── JSONL File Discovery ────────────────────────────────────────────────────

/**
 * Find all session JSONL files in a Claude Code project directory.
 * Skips agent-*.jsonl (subagent files) and subagents/ subdirectories.
 */
export function discoverSessions(projectDir: string): string[] {
  const files = readdirSync(projectDir);
  return files
    .filter(f =>
      f.endsWith('.jsonl') &&
      !f.startsWith('agent-') &&
      // UUID format: 8-4-4-4-12 hex chars
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/.test(f)
    )
    .map(f => join(projectDir, f))
    .sort((a, b) => {
      // Sort by modification time, newest first
      const aStat = statSync(a);
      const bStat = statSync(b);
      return bStat.mtimeMs - aStat.mtimeMs;
    });
}

/**
 * Find all project directories under ~/.claude/projects/
 */
export function discoverProjects(claudeDir: string): Array<{ path: string; name: string }> {
  const projectsDir = join(claudeDir, 'projects');
  const dirs = readdirSync(projectsDir);
  return dirs
    .map(d => ({
      path: join(projectsDir, d),
      // Decode the path encoding: -Users-sam-Projects-myapp → /Users/sam/Projects/myapp
      name: d.replace(/^-/, '/').replace(/-/g, '/'),
    }))
    .filter(d => statSync(d.path).isDirectory());
}

// ─── JSONL Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a JSONL file into typed transcript records.
 * Filters out sidechain messages and API error messages.
 */
export function parseJSONL(filePath: string): TranscriptRecord[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const records: TranscriptRecord[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as TranscriptRecord;

      // Skip sidechain (subagent) messages — they have their own transcripts
      if ('isSidechain' in record && record.isSidechain) continue;

      // Skip API error messages
      if ('isApiErrorMessage' in record && record.isApiErrorMessage) continue;

      records.push(record);
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return records;
}

// ─── Node Classification ─────────────────────────────────────────────────────

/**
 * Correction indicators in user messages.
 *
 * These must be SPECIFIC to user-redirecting-agent behavior, not general
 * conversation. False positives inflate userCorrectionCount, which cascades
 * into narrative identity (failure episodes), user model (low patience),
 * and pre-mortem (escalation-avoidance). Be conservative.
 */
const CORRECTION_PATTERNS = [
  /\bno\b[,.]?\s*(try|use|do|check|look|instead|don't|stop|wait)/i,
  /\bthat's not (right|correct|what I)/i,
  /\bwrong (file|approach|direction|way)\b/i,
  /\bforget that\b/i,
  /\bdon't do that\b/i,
  /\bnot what I (asked|wanted|meant)\b/i,
  /\bgo back to\b/i,
  /\brevert (that|this|the)\b/i,
  /\bundo (that|this|the)\b/i,
  /\bthat broke\b/i,
  /\btry .+ instead/i,
  /\blook at .+ instead/i,
  /\bthe (issue|problem|bug) (is|is actually) in\b/i,
  /\bstop (doing|changing|modifying|editing)\b/i,
];

/** Backtrack indicators in assistant messages */
const BACKTRACK_PATTERNS = [
  /\blet me try a different/i,
  /\bthat didn't work/i,
  /\bI see the( real)? (issue|problem|error)/i,
  /\bactually,? (I think|let me|the issue)/i,
  /\bapproach (isn't|didn't|wasn't) working/i,
  /\blet me reconsider/i,
  /\bI was wrong/i,
  /\bprevious approach/i,
  /\bgoing back to/i,
  /\binstead,? let me/i,
  /\berror (suggests|indicates|means)/i,
];

/**
 * Extract text from a user message content (can be string or content array)
 */
function getUserText(content: string | MessageContent[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((c): c is TextContent => c.type === 'text')
    .map(c => c.text)
    .join('\n');
}

/**
 * Extract text from an assistant message content array
 */
function getAssistantText(content: MessageContent[]): string {
  return content
    .filter((c): c is TextContent => c.type === 'text')
    .map(c => c.text)
    .join('\n');
}

/**
 * Extract tool_use blocks from an assistant message
 */
function getToolUses(content: MessageContent[]): ToolUseContent[] {
  return content.filter((c): c is ToolUseContent => c.type === 'tool_use');
}

/**
 * Classify a user message as either a correction, escalation request, or regular request.
 */
function classifyUserMessage(
  text: string,
  previousNodeType?: NodeType
): 'correction' | 'user_request' | 'escalation' {
  // If the previous node was an action/observation and user is redirecting → correction
  if (previousNodeType && ['action', 'observation', 'hypothesis'].includes(previousNodeType)) {
    for (const pattern of CORRECTION_PATTERNS) {
      if (pattern.test(text)) return 'correction';
    }
  }
  // Questions from user → might be escalation
  if (text.trim().endsWith('?') && text.length < 200) {
    return 'escalation';
  }
  return 'user_request';
}

/**
 * Classify an assistant message as hypothesis, action, observation, backtrack, or resolution.
 */
function classifyAssistantMessage(
  text: string,
  toolUses: ToolUseContent[],
  isLastAssistant: boolean
): NodeType {
  // Check for backtracking first
  for (const pattern of BACKTRACK_PATTERNS) {
    if (pattern.test(text)) return 'backtrack';
  }

  // Has tool calls → action
  if (toolUses.length > 0) return 'action';

  // Final message with no tool calls → likely resolution
  if (isLastAssistant) return 'resolution';

  // Short message analyzing results → observation
  // Longer message reasoning about approach → hypothesis
  return text.length > 300 ? 'hypothesis' : 'observation';
}

// ─── File Tracking ───────────────────────────────────────────────────────────

/** Extract file paths from tool calls */
function extractFilesFromToolCall(toolUse: ToolUseContent): string[] {
  const files: string[] = [];
  const input = toolUse.input as Record<string, unknown>;

  switch (toolUse.name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      if (typeof input.file_path === 'string') files.push(input.file_path);
      if (typeof input.path === 'string') files.push(input.path);
      break;
    case 'Bash': {
      // Try to extract file references from bash commands
      const cmd = String(input.command || '');
      // Match common file patterns in commands
      const fileMatches = cmd.match(/(?:cat|vim|nano|code|less|head|tail|grep -[a-z]*\s+\S+\s+|sed\s+\S+\s+)(\S+\.(ts|js|tsx|jsx|py|rs|go|md|json|yaml|yml|toml|css|html|sql))/g);
      if (fileMatches) {
        for (const match of fileMatches) {
          const parts = match.split(/\s+/);
          const filePart = parts[parts.length - 1];
          if (filePart && !filePart.startsWith('-')) files.push(filePart);
        }
      }
      break;
    }
    case 'Glob':
    case 'Grep':
      if (typeof input.pattern === 'string') files.push(input.pattern);
      break;
  }

  return files;
}

// ─── Decision Graph Construction ─────────────────────────────────────────────

/**
 * Build a DecisionGraph from parsed transcript records.
 * This is the core transformation.
 */
export function buildDecisionGraph(
  records: TranscriptRecord[],
  projectName: string
): DecisionGraph {
  const nodes: DecisionNode[] = [];
  const edges: DecisionEdge[] = [];

  let sessionId = '';
  let gitBranch = '';
  let cwd = '';
  let version = '';
  let summary: string | undefined;
  let startTime = '';
  let endTime = '';

  // Metrics tracking
  let totalToolCalls = 0;
  const toolsUsed = new Set<string>();
  let backtrackCount = 0;
  let userCorrectionCount = 0;
  let userPromptCount = 0;
  const allFilesTouched = new Set<string>();
  const resolutionFiles = new Set<string>();
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;

  let previousNodeId: string | null = null;
  let previousNodeType: NodeType | undefined;
  let nodeIndex = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Extract summary
    if (record.type === 'summary') {
      summary = (record as SummaryRecord).summary;
      continue;
    }

    // Skip non-message records
    if (record.type !== 'user' && record.type !== 'assistant') continue;

    // Extract session metadata from first message
    if ('sessionId' in record && record.sessionId && !sessionId) {
      sessionId = record.sessionId;
      gitBranch = record.gitBranch || '';
      cwd = record.cwd || '';
      version = record.version || '';
    }

    if ('timestamp' in record && record.timestamp) {
      if (!startTime) startTime = record.timestamp;
      endTime = record.timestamp;
    }

    const nodeId = `node_${nodeIndex++}`;

    if (record.type === 'user' && 'message' in record) {
      const userRecord = record as UserRecord;
      const text = getUserText(userRecord.message.content);

      if (!text.trim()) continue;

      const classification = classifyUserMessage(text, previousNodeType);
      userPromptCount++;

      if (classification === 'correction') {
        userCorrectionCount++;
      }

      const node: DecisionNode = {
        id: nodeId,
        type: classification,
        timestamp: record.timestamp,
        reasoning: text.slice(0, 500), // Truncate for storage efficiency
        filesTouched: [],
        sourceUuids: [record.uuid],
      };

      nodes.push(node);

      // Create edge from previous node
      if (previousNodeId) {
        const edgeType: EdgeType =
          classification === 'correction' ? 'correction_forced' : 'user_initiated';
        edges.push({ from: previousNodeId, to: nodeId, type: edgeType });
      }

      previousNodeId = nodeId;
      previousNodeType = classification;
    }

    if (record.type === 'assistant' && 'message' in record) {
      const assistantRecord = record as AssistantRecord;
      const content = assistantRecord.message.content;
      const text = getAssistantText(content);
      const toolUses = getToolUses(content);

      const isLastAssistant = !records
        .slice(i + 1)
        .some(r => r.type === 'assistant');

      const classification = classifyAssistantMessage(text, toolUses, isLastAssistant);

      if (classification === 'backtrack') backtrackCount++;

      // Track tool usage
      const filesTouched: string[] = [];
      for (const tu of toolUses) {
        totalToolCalls++;
        toolsUsed.add(tu.name);
        const files = extractFilesFromToolCall(tu);
        filesTouched.push(...files);
        files.forEach(f => allFilesTouched.add(f));

        // Track ALL write operations — we'll use the latest ones as resolution
        if (['Write', 'Edit', 'MultiEdit'].includes(tu.name)) {
          files.forEach(f => resolutionFiles.add(f));
        }
      }

      // Track token usage
      if (assistantRecord.message.usage) {
        const u = assistantRecord.message.usage;
        inputTokens = Math.max(inputTokens, u.input_tokens || 0);
        outputTokens += u.output_tokens || 0;
        cacheReadTokens = Math.max(cacheReadTokens, u.cache_read_input_tokens || 0);
        cacheCreationTokens += u.cache_creation_input_tokens || 0;
      }

      const node: DecisionNode = {
        id: nodeId,
        type: classification,
        timestamp: record.timestamp,
        reasoning: text.slice(0, 500),
        toolCall: toolUses.length > 0 ? {
          name: toolUses[0].name,
          input: toolUses[0].input,
          outputSummary: '', // Filled from next tool_result record
          succeeded: true,   // Updated if error in tool_result
        } : undefined,
        filesTouched,
        sourceUuids: [record.uuid],
      };

      nodes.push(node);

      // Create edge from previous node
      if (previousNodeId) {
        let edgeType: EdgeType;
        if (classification === 'backtrack' && previousNodeType === 'correction') {
          edgeType = 'correction_forced';
        } else if (classification === 'backtrack') {
          edgeType = 'self_correction';
        } else if (previousNodeType === 'backtrack') {
          edgeType = 'retry';
        } else if (previousNodeType === 'user_request' || previousNodeType === 'correction') {
          edgeType = 'user_initiated';
        } else if (classification === 'action' && previousNodeType === 'hypothesis') {
          edgeType = 'hypothesis_driven';
        } else if (classification === 'hypothesis' && previousNodeType === 'observation') {
          edgeType = 'evidence_based';
        } else {
          edgeType = 'sequential';
        }
        edges.push({ from: previousNodeId, to: nodeId, type: edgeType });
      }

      previousNodeId = nodeId;
      previousNodeType = classification;
    }
  }

  // Compute duration
  const durationSeconds = startTime && endTime
    ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
    : 0;

  // Files investigated but not in resolution = false leads
  const investigatedNotResolution = [...allFilesTouched].filter(f => !resolutionFiles.has(f));

  const metrics: SessionMetrics = {
    totalToolCalls,
    toolsUsed: [...toolsUsed],
    backtrackCount,
    userCorrectionCount,
    userPromptCount,
    durationSeconds,
    filesModifiedAsResolution: [...resolutionFiles],
    filesInvestigatedNotResolution: investigatedNotResolution,
    toolCallsToResolution: totalToolCalls, // Refined later with better analysis
    apparentSuccess: userCorrectionCount < 3 && backtrackCount < 5,
    tokenUsage: { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens },
  };

  return {
    sessionId,
    project: projectName,
    gitBranch,
    startTime,
    endTime,
    summary,
    nodes,
    edges,
    metrics,
  };
}

// ─── High-Level API ──────────────────────────────────────────────────────────

/**
 * Parse a single session file into a DecisionGraph.
 */
export function parseSession(filePath: string, projectName?: string): DecisionGraph {
  const project = projectName || basename(filePath, '.jsonl');
  const records = parseJSONL(filePath);
  return buildDecisionGraph(records, project);
}

/**
 * Parse all sessions in a project directory.
 */
export function parseProject(projectDir: string, projectName?: string): DecisionGraph[] {
  const name = projectName || basename(projectDir);
  const sessionFiles = discoverSessions(projectDir);
  return sessionFiles.map(f => parseSession(f, name));
}

/**
 * Parse all projects in the Claude Code directory.
 */
export function parseAll(claudeDir: string = `${process.env.HOME}/.claude`): DecisionGraph[] {
  const projects = discoverProjects(claudeDir);
  const graphs: DecisionGraph[] = [];

  for (const project of projects) {
    try {
      const projectGraphs = parseProject(project.path, project.name);
      graphs.push(...projectGraphs);
    } catch {
      // Skip projects that fail to parse
      continue;
    }
  }

  return graphs;
}

/**
 * Quick stats for a parsed session — useful for the CLI output.
 */
export function sessionSummary(graph: DecisionGraph): string {
  const m = graph.metrics;
  const duration = m.durationSeconds > 60
    ? `${Math.round(m.durationSeconds / 60)}m`
    : `${Math.round(m.durationSeconds)}s`;

  return [
    `Session: ${graph.sessionId.slice(0, 8)}...`,
    `Project: ${graph.project}`,
    `Duration: ${duration}`,
    `Tool calls: ${m.totalToolCalls}`,
    `Backtracks: ${m.backtrackCount}`,
    `User corrections: ${m.userCorrectionCount}`,
    `Files modified: ${m.filesModifiedAsResolution.length}`,
    `False leads: ${m.filesInvestigatedNotResolution.length}`,
    `Success: ${m.apparentSuccess ? '✓' : '✗'}`,
    graph.summary ? `Summary: ${graph.summary.slice(0, 100)}...` : '',
  ].filter(Boolean).join('\n');
}
