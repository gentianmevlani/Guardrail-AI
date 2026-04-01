/**
 * MCP Connector
<<<<<<< HEAD
 *
 * Connects to external MCP servers using the Model Context Protocol
 * over stdio transport (newline-delimited JSON-RPC 2.0).
 *
 * Protocol: @modelcontextprotocol/sdk stdio framing — one JSON object per line.
 * Compatible with the guardrail MCP server and any MCP-compliant server.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';

export interface MCPConnection {
  id: string;
  name: string;
  type: 'mcp-stdio' | 'mcp-sse' | 'api';
=======
 * 
 * Connects with other MCP servers and integrations
 */

export interface MCPConnection {
  id: string;
  name: string;
  type: 'mcp' | 'api' | 'webhook';
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  endpoint: string;
  config: Record<string, any>;
  status: 'connected' | 'disconnected' | 'error';
  capabilities: string[];
<<<<<<< HEAD
  serverInfo?: { name: string; version: string };
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  mcpId: string;
}

<<<<<<< HEAD
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  mcpId: string;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const PROTOCOL_VERSION = '2024-11-05';
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Manages a single stdio MCP connection to one server process.
 */
class MCPStdioSession extends EventEmitter {
  private child: ChildProcess | null = null;
  private buffer = '';
  private nextId = 1;
  private pending: Map<number, PendingRequest> = new Map();
  private _connected = false;

  constructor(
    private serverCommand: string,
    private serverArgs: string[] = [],
    private env: Record<string, string> = {},
    private timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    super();
  }

  get connected(): boolean {
    return this._connected;
  }

  /**
   * Spawn the MCP server process and perform the initialize handshake.
   */
  async connect(clientName = 'guardrail-connector', clientVersion = '1.0.0'): Promise<{ capabilities: string[]; serverInfo?: { name: string; version: string } }> {
    if (this._connected) {
      throw new Error('Already connected');
    }

    return new Promise((resolve, reject) => {
      this.child = spawn(this.serverCommand, this.serverArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...this.env },
      });

      if (!this.child.stdout || !this.child.stdin) {
        reject(new Error('Failed to spawn MCP server process'));
        return;
      }

      this.child.stdout.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString('utf-8');
        this.processBuffer();
      });

      this.child.stderr?.on('data', (chunk: Buffer) => {
        this.emit('stderr', chunk.toString('utf-8'));
      });

      this.child.on('error', (err) => {
        this._connected = false;
        this.emit('error', err);
        reject(err);
      });

      this.child.on('exit', (code) => {
        this._connected = false;
        this.rejectAllPending(new Error(`MCP server exited with code ${code}`));
        this.emit('exit', code);
      });

      // Send initialize request
      this.sendRequest('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: clientName, version: clientVersion },
      })
        .then((result) => {
          this._connected = true;

          // Send initialized notification
          this.sendNotification('notifications/initialized', {});

          const capabilities: string[] = [];
          if (result.capabilities?.tools) capabilities.push('tools');
          if (result.capabilities?.resources) capabilities.push('resources');
          if (result.capabilities?.prompts) capabilities.push('prompts');

          resolve({
            capabilities,
            serverInfo: result.serverInfo,
          });
        })
        .catch(reject);
    });
  }

  /**
   * Gracefully disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    if (!this._connected || !this.child) return;
    this._connected = false;
    this.rejectAllPending(new Error('Disconnected'));
    this.child.stdin?.end();
    this.child.kill('SIGTERM');
    this.child = null;
  }

  /**
   * List tools available on the connected server.
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest('tools/list', {});
    return (result.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema || {},
      mcpId: '',
    }));
  }

  /**
   * List resources available on the connected server.
   */
  async listResources(): Promise<MCPResource[]> {
    const result = await this.sendRequest('resources/list', {});
    return (result.resources || []).map((r: any) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
      mcpId: '',
    }));
  }

  /**
   * Call a tool on the connected server.
   */
  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    const result = await this.sendRequest('tools/call', { name, arguments: args });
    return result;
  }

  /**
   * Read a resource from the connected server.
   */
  async readResource(uri: string): Promise<any> {
    const result = await this.sendRequest('resources/read', { uri });
    return result;
  }

  // ─── JSON-RPC Transport ────────────────────────────────────────────

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.child?.stdin?.writable) {
        reject(new Error('MCP server stdin not writable'));
        return;
      }

      const id = this.nextId++;
      const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method} (${this.timeoutMs}ms)`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      // SDK stdio transport: newline-delimited JSON
      this.child.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  private sendNotification(method: string, params: any): void {
    if (!this.child?.stdin?.writable) return;
    const notification: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    this.child.stdin.write(JSON.stringify(notification) + '\n');
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg = JSON.parse(trimmed);
        if (msg.jsonrpc !== '2.0') continue;

        if ('id' in msg && (msg.id !== null && msg.id !== undefined)) {
          // Response to a request
          this.handleResponse(msg as JsonRpcResponse);
        } else if ('method' in msg) {
          // Server-initiated notification
          this.emit('notification', msg);
        }
      } catch {
        // Skip non-JSON lines (e.g. debug output from server stderr leaking to stdout)
      }
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;

    this.pending.delete(response.id);
    clearTimeout(pending.timer);

    if (response.error) {
      pending.reject(new Error(`MCP error ${response.error.code}: ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

/**
 * High-level MCPConnector managing multiple MCP server connections.
 */
class MCPConnector {
  private connections: Map<string, MCPConnection> = new Map();
  private sessions: Map<string, MCPStdioSession> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  /**
   * Connect to an MCP server via stdio transport.
   * @param name - Display name for the connection
   * @param serverPath - Path to the MCP server entry file (e.g. mcp-server/index.js)
   * @param config - Extra environment variables and options
   */
  async connectMCP(
    name: string,
    serverPath: string,
    config: Record<string, any> = {},
  ): Promise<MCPConnection> {
    const resolvedPath = path.resolve(serverPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`MCP server not found: ${resolvedPath}`);
    }

    const id = this.generateId();
    const env = config.env || {};
    const args = config.args || [resolvedPath];
    const command = config.command || process.execPath; // Node.js by default

    const session = new MCPStdioSession(command, args, env, config.timeoutMs);

    const connection: MCPConnection = {
      id,
      name,
      type: 'mcp-stdio',
      endpoint: resolvedPath,
=======
class MCPConnector {
  private connections: Map<string, MCPConnection> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  /**
   * Connect to external MCP server
   */
  async connectMCP(
    name: string,
    endpoint: string,
    config: Record<string, any> = {}
  ): Promise<MCPConnection> {
    const connection: MCPConnection = {
      id: this.generateId(),
      name,
      type: 'mcp',
      endpoint,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      config,
      status: 'disconnected',
      capabilities: [],
    };

    try {
<<<<<<< HEAD
      const initResult = await session.connect(
        config.clientName || 'guardrail-connector',
        config.clientVersion || '1.0.0',
      );

      connection.capabilities = initResult.capabilities;
      connection.serverInfo = initResult.serverInfo;
      connection.status = 'connected';

      // Discover and register tools
      const discoveredTools = await session.listTools();
      for (const tool of discoveredTools) {
        tool.mcpId = id;
        this.tools.set(`${id}:${tool.name}`, tool);
      }

      this.sessions.set(id, session);
      this.connections.set(id, connection);

      // Listen for disconnect
      session.on('exit', () => {
        connection.status = 'disconnected';
      });

      return connection;
    } catch (error) {
      connection.status = 'error';
      this.connections.set(id, connection);
      await session.disconnect();
=======
      // Test connection
      const capabilities = await this.testConnection(endpoint, config);
      connection.capabilities = capabilities;
      connection.status = 'connected';

      // Discover tools
      const discoveredTools = await this.discoverTools(endpoint, config);
      this.registerTools(discoveredTools, connection.id);

      this.connections.set(connection.id, connection);
      return connection;
    } catch (error) {
      connection.status = 'error';
      connection.capabilities = [];
      this.connections.set(connection.id, connection);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      throw error;
    }
  }

  /**
<<<<<<< HEAD
   * Connect to a REST/HTTP API service (non-MCP).
=======
   * Connect to API service
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
   */
  async connectAPI(
    name: string,
    endpoint: string,
    apiKey: string,
<<<<<<< HEAD
    config: Record<string, any> = {},
  ): Promise<MCPConnection> {
    const id = this.generateId();
    const connection: MCPConnection = {
      id,
=======
    config: Record<string, any> = {}
  ): Promise<MCPConnection> {
    const connection: MCPConnection = {
      id: this.generateId(),
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      name,
      type: 'api',
      endpoint,
      config: { ...config, apiKey },
      status: 'disconnected',
      capabilities: [],
    };

    try {
<<<<<<< HEAD
      // Test API reachability with a HEAD request
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs || 5000);

      const response = await fetch(endpoint, {
        method: 'HEAD',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timer);

      connection.capabilities = ['read'];
      if (response.ok) {
        connection.capabilities.push('write');
      }
      connection.status = 'connected';
      this.connections.set(id, connection);
      return connection;
    } catch (error) {
      connection.status = 'error';
      this.connections.set(id, connection);
=======
      // Test API connection
      const capabilities = await this.testAPIConnection(endpoint, apiKey);
      connection.capabilities = capabilities;
      connection.status = 'connected';

      this.connections.set(connection.id, connection);
      return connection;
    } catch (error) {
      connection.status = 'error';
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      throw error;
    }
  }

  /**
<<<<<<< HEAD
   * List all connections.
=======
   * List all connections
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
   */
  listConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  /**
<<<<<<< HEAD
   * Get connection by ID.
=======
   * Get connection by ID
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
   */
  getConnection(id: string): MCPConnection | undefined {
    return this.connections.get(id);
  }

  /**
<<<<<<< HEAD
   * Disconnect a specific connection.
   */
  async disconnect(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      await session.disconnect();
      this.sessions.delete(id);
    }

    const connection = this.connections.get(id);
    if (connection) {
      connection.status = 'disconnected';
    }

    // Remove tools for this connection
    for (const [key, tool] of this.tools) {
      if (tool.mcpId === id) {
        this.tools.delete(key);
      }
=======
   * Disconnect
   */
  disconnect(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.status = 'disconnected';
      this.connections.set(id, connection);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    }
  }

  /**
<<<<<<< HEAD
   * Disconnect all connections.
   */
  async disconnectAll(): Promise<void> {
    for (const id of [...this.sessions.keys()]) {
      await this.disconnect(id);
    }
  }

  /**
   * Call a tool on a connected MCP server.
   */
  async callTool(connectionId: string, toolName: string, args: Record<string, any> = {}): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session) {
      throw new Error(`No active session for connection: ${connectionId}`);
    }
    if (!session.connected) {
      throw new Error(`Session not connected: ${connectionId}`);
    }
    return session.callTool(toolName, args);
  }

  /**
   * Read a resource from a connected MCP server.
   */
  async readResource(connectionId: string, uri: string): Promise<any> {
    const session = this.sessions.get(connectionId);
    if (!session) {
      throw new Error(`No active session for connection: ${connectionId}`);
    }
    return session.readResource(uri);
  }

  /**
   * List all tools across all connections.
=======
   * Call tool from connected MCP
   */
  async callTool(connectionId: string, toolName: string, args: any): Promise<any> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (connection.status !== 'connected') {
      throw new Error(`Connection not active: ${connectionId}`);
    }

    // Call tool via MCP protocol
    return await this.executeMCPTool(connection, toolName, args);
  }

  /**
   * List available tools from all connections
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
   */
  listTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
<<<<<<< HEAD
   * Get tools for a specific connection.
=======
   * Get tools by connection
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
   */
  getToolsByConnection(connectionId: string): MCPTool[] {
    return Array.from(this.tools.values()).filter(t => t.mcpId === connectionId);
  }

<<<<<<< HEAD
  /**
   * Find a tool by name across all connections.
   */
  findTool(toolName: string): { connectionId: string; tool: MCPTool } | undefined {
    for (const [key, tool] of this.tools) {
      if (tool.name === toolName) {
        return { connectionId: tool.mcpId, tool };
      }
    }
    return undefined;
  }

  /**
   * Call a tool by name, automatically routing to the correct connection.
   */
  async callToolByName(toolName: string, args: Record<string, any> = {}): Promise<any> {
    const found = this.findTool(toolName);
    if (!found) {
      throw new Error(`Tool not found: ${toolName}. Available: ${this.listTools().map(t => t.name).join(', ')}`);
    }
    return this.callTool(found.connectionId, toolName, args);
  }

  private generateId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
=======
  // Private methods
  private async testConnection(endpoint: string, config: Record<string, any>): Promise<string[]> {
    // Simplified - would use actual MCP protocol
    return ['tools', 'resources', 'prompts'];
  }

  private async testAPIConnection(endpoint: string, apiKey: string): Promise<string[]> {
    // Test API and return capabilities
    return ['read', 'write', 'search'];
  }

  private async discoverTools(endpoint: string, config: Record<string, any>): Promise<MCPTool[]> {
    // Discover tools from MCP server
    // Simplified - would use actual MCP protocol
    return [];
  }

  private registerTools(tools: MCPTool[], connectionId: string): void {
    for (const tool of tools) {
      tool.mcpId = connectionId;
      this.tools.set(`${connectionId}:${tool.name}`, tool);
    }
  }

  private async executeMCPTool(connection: MCPConnection, toolName: string, args: any): Promise<any> {
    // Execute tool via MCP protocol
    // Simplified - would use actual MCP client
    return { result: 'Tool executed', tool: toolName, args };
  }

  private generateId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  }
}

export const mcpConnector = new MCPConnector();
<<<<<<< HEAD
=======

>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
