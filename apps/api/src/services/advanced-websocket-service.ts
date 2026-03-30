/**
 * Advanced WebSocket Collaboration Service
 * 
 * Provides real-time collaboration features including:
 * - Live code editing with operational transforms
 * - Cursor tracking and presence awareness
 * - Real-time comments and annotations
 * - Voice/video call signaling
 * - Screen sharing capabilities
 */

import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { logger } from '../logger';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  isTyping?: boolean;
  lastSeen: Date;
}

interface Room {
  id: string;
  name: string;
  type: 'project' | 'document' | 'scan' | 'meeting';
  users: Map<string, UserConnection>;
  document?: DocumentState;
  permissions: Map<string, Permission>;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

interface DocumentState {
  id: string;
  content: string;
  version: number;
  operations: Operation[];
  lastModified: Date;
  modifiedBy: string;
}

interface Operation {
  type: 'insert' | 'delete' | 'retain' | 'format';
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, unknown>;
  userId: string;
  timestamp: Date;
}

interface CursorPosition {
  line: number;
  column: number;
  file?: string;
}

interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

interface UserConnection {
  ws: WebSocket;
  user: User;
  rooms: Set<string>;
  permissions: Permission;
}

interface Permission {
  read: boolean;
  write: boolean;
  admin: boolean;
  comment: boolean;
}

interface VoiceCall {
  id: string;
  roomId: string;
  participants: string[];
  startedBy: string;
  startedAt: Date;
}

export class AdvancedWebSocketService extends EventEmitter {
  private wss?: WebSocketServer;
  private rooms = new Map<string, Room>();
  private connections = new Map<WebSocket, UserConnection>();
  private voiceCalls = new Map<string, VoiceCall>();
  private logger = logger.child({ module: 'websocket-advanced' });

  initialize(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws-collaboration'
    });

    this.wss.on('connection', (ws: WebSocket, request: any) => {
      this.handleConnection(ws, request);
    });

    this.logger.info('Advanced WebSocket service initialized');
  }

  private async handleConnection(ws: WebSocket, request: any) {
    this.logger.info('New WebSocket connection');

    // Extract token from query
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      // Verify token
      const { authService } = await import('./auth-service');
      const decoded = await authService.verifyToken(token);
      
      const user: User = {
        id: decoded.userId,
        email: decoded.email,
        name: (decoded as any).name || '',
        lastSeen: new Date()
      };

      const connection: UserConnection = {
        ws,
        user,
        rooms: new Set(),
        permissions: { read: true, write: true, admin: false, comment: true }
      };

      this.connections.set(ws, connection);

      // Set up message handlers
      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        this.logger.error({ error }, 'WebSocket error');
      });

      // Send initial state
      ws.send(JSON.stringify({
        type: 'connected',
        user: { id: user.id, email: user.email, name: user.name },
        timestamp: new Date().toISOString()
      }));

    } catch (error) {
      this.logger.error({ error }, 'Authentication failed');
      ws.close(1008, 'Authentication failed');
    }
  }

  private handleMessage(ws: WebSocket, data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      const connection = this.connections.get(ws);

      if (!connection) {
        ws.close(1008, 'Connection not authenticated');
        return;
      }

      this.routeMessage(connection, message);
    } catch (error) {
      this.logger.error({ error }, 'Invalid message format');
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  }

  private routeMessage(connection: UserConnection, message: any) {
    const { type, roomId } = message;

    switch (type) {
      case 'join-room':
        this.handleJoinRoom(connection, message);
        break;

      case 'leave-room':
        this.handleLeaveRoom(connection, message);
        break;

      case 'cursor-update':
        this.handleCursorUpdate(connection, message);
        break;

      case 'selection-update':
        this.handleSelectionUpdate(connection, message);
        break;

      case 'document-edit':
        this.handleDocumentEdit(connection, message);
        break;

      case 'typing-start':
      case 'typing-stop':
        this.handleTyping(connection, message);
        break;

      case 'comment-add':
      case 'comment-update':
      case 'comment-delete':
        this.handleComment(connection, message);
        break;

      case 'voice-call-start':
        this.handleVoiceCallStart(connection, message);
        break;

      case 'voice-call-join':
        this.handleVoiceCallJoin(connection, message);
        break;

      case 'voice-call-leave':
        this.handleVoiceCallLeave(connection, message);
        break;

      case 'screen-share-start':
        this.handleScreenShareStart(connection, message);
        break;

      case 'screen-share-stop':
        this.handleScreenShareStop(connection, message);
        break;

      case 'presence-update':
        this.handlePresenceUpdate(connection, message);
        break;

      default:
        this.logger.warn({ type }, 'Unknown message type');
    }
  }

  private async handleJoinRoom(connection: UserConnection, message: any) {
    const { roomId } = message;
    
    // Check if room exists or create it
    let room = this.rooms.get(roomId);
    if (!room) {
      room = await this.createRoom(roomId, message.roomType || 'project');
    }

    // Check permissions
    if (!this.hasPermission(connection, room, 'read')) {
      connection.ws.send(JSON.stringify({
        type: 'error',
        message: 'Permission denied'
      }));
      return;
    }

    // Add user to room
    connection.rooms.add(roomId);
    room.users.set(connection.user.id, connection);

    // Send room state
    connection.ws.send(JSON.stringify({
      type: 'room-joined',
      room: {
        id: room.id,
        name: room.name,
        type: room.type,
        users: Array.from(room.users.values()).map(c => ({
          id: c.user.id,
          email: c.user.email,
          name: c.user.name,
          cursor: c.user.cursor,
          selection: c.user.selection,
          isTyping: c.user.isTyping
        })),
        document: room.document
      }
    }));

    // Notify others
    this.broadcastToRoom(roomId, {
      type: 'user-joined',
      user: {
        id: connection.user.id,
        email: connection.user.email,
        name: connection.user.name
      }
    }, connection.user.id);

    this.logger.info({ userId: connection.user.id, roomId }, 'User joined room');
  }

  private handleCursorUpdate(connection: UserConnection, message: any) {
    const { roomId, cursor } = message;
    
    connection.user.cursor = cursor;
    
    // Broadcast to room
    this.broadcastToRoom(roomId, {
      type: 'cursor-update',
      userId: connection.user.id,
      cursor
    }, connection.user.id);
  }

  private handleSelectionUpdate(connection: UserConnection, message: any) {
    const { roomId, selection } = message;
    
    connection.user.selection = selection;
    
    // Broadcast to room
    this.broadcastToRoom(roomId, {
      type: 'selection-update',
      userId: connection.user.id,
      selection
    }, connection.user.id);
  }

  private handleDocumentEdit(connection: UserConnection, message: any) {
    const { roomId, operation } = message;
    const room = this.rooms.get(roomId);
    
    if (!room || !this.hasPermission(connection, room, 'write')) {
      return;
    }

    // Apply operational transform
    const transformedOp = this.applyOperation(room.document!, operation);
    
    // Update document
    room.document!.operations.push(transformedOp);
    room.document!.version++;
    room.document!.lastModified = new Date();
    room.document!.modifiedBy = connection.user.id;

    // Broadcast to room
    this.broadcastToRoom(roomId, {
      type: 'document-updated',
      operation: transformedOp,
      version: room.document!.version,
      modifiedBy: connection.user.id
    });
  }

  private handleTyping(connection: UserConnection, message: any) {
    const { roomId, isTyping } = message;
    
    connection.user.isTyping = isTyping;
    
    // Broadcast to room
    this.broadcastToRoom(roomId, {
      type: 'typing-indicator',
      userId: connection.user.id,
      isTyping
    }, connection.user.id);
  }

  private handleComment(connection: UserConnection, message: any) {
    const { roomId, comment } = message;
    
    // Broadcast to room
    this.broadcastToRoom(roomId, {
      type: 'comment',
      userId: connection.user.id,
      comment
    });
  }

  private handleLeaveRoom(connection: UserConnection, message: any) {
    const { roomId } = message;
    
    // Remove user from room
    connection.rooms.delete(roomId);
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.users.delete(connection.user.id);
      
      // Notify others
      this.broadcastToRoom(roomId, {
        type: 'user-left',
        userId: connection.user.id
      }, connection.user.id);
      
      // Clean up empty rooms
      if (room.users.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  private handleVoiceCallJoin(connection: UserConnection, message: any) {
    const { callId } = message;
    
    // Add user to call
    const call = this.voiceCalls.get(callId);
    if (call) {
      call.participants.push(connection.user.id);
      
      // Notify participants
      this.broadcastToRoom(call.roomId, {
        type: 'voice-call-joined',
        callId,
        userId: connection.user.id
      });
    }
  }

  private handleVoiceCallLeave(connection: UserConnection, message: any) {
    const { callId } = message;
    
    // Remove user from call
    const call = this.voiceCalls.get(callId);
    if (call) {
      call.participants = call.participants.filter(id => id !== connection.user.id);
      
      // Notify participants
      this.broadcastToRoom(call.roomId, {
        type: 'voice-call-left',
        callId,
        userId: connection.user.id
      });
      
      // Clean up empty calls
      if (call.participants.length === 0) {
        this.voiceCalls.delete(callId);
      }
    }
  }

  private handleScreenShareStart(connection: UserConnection, message: any) {
    const { roomId } = message;
    
    // Notify room
    this.broadcastToRoom(roomId, {
      type: 'screen-share-started',
      userId: connection.user.id
    }, connection.user.id);
  }

  private handleScreenShareStop(connection: UserConnection, message: any) {
    const { roomId } = message;
    
    // Notify room
    this.broadcastToRoom(roomId, {
      type: 'screen-share-stopped',
      userId: connection.user.id
    }, connection.user.id);
  }

  private handlePresenceUpdate(connection: UserConnection, message: any) {
    const { _status } = message;
    
    // Update user presence
    connection.user.lastSeen = new Date();
    
    // Could broadcast to rooms if needed
  }

  private handleVoiceCallStart(connection: UserConnection, message: any) {
    const { roomId } = message;
    
    const call: VoiceCall = {
      id: `call-${Date.now()}`,
      roomId,
      participants: [connection.user.id],
      startedBy: connection.user.id,
      startedAt: new Date()
    };
    
    this.voiceCalls.set(call.id, call);
    
    // Notify room
    this.broadcastToRoom(roomId, {
      type: 'voice-call-started',
      call: {
        id: call.id,
        participants: call.participants,
        startedBy: call.startedBy
      }
    });
  }

  private handleDisconnection(ws: WebSocket) {
    const connection = this.connections.get(ws);
    
    if (!connection) return;

    // Remove from all rooms
    for (const roomId of connection.rooms) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.users.delete(connection.user.id);
        
        // Notify others
        this.broadcastToRoom(roomId, {
          type: 'user-left',
          userId: connection.user.id
        });
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }

    this.connections.delete(ws);
    this.logger.info({ userId: connection.user.id }, 'User disconnected');
  }

  private broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    
    for (const [userId, connection] of room.users) {
      if (userId !== excludeUserId) {
        connection.ws.send(messageStr);
      }
    }
  }

  private async createRoom(roomId: string, type: string): Promise<Room> {
    const room: Room = {
      id: roomId,
      name: `Room ${roomId}`,
      type: type as any,
      users: new Map(),
      permissions: new Map(),
      createdAt: new Date(),
      metadata: {}
    };

    // Create document state if needed
    if (type === 'document' || type === 'project') {
      room.document = {
        id: `doc-${roomId}`,
        content: '',
        version: 0,
        operations: [],
        lastModified: new Date(),
        modifiedBy: 'system'
      };
    } else {
      // Initialize empty document for other types
      room.document = undefined;
    }

    this.rooms.set(roomId, room);
    return room;
  }

  private hasPermission(connection: UserConnection, room: Room, action: keyof Permission): boolean {
    const userPermission = room.permissions.get(connection.user.id) || connection.permissions;
    return userPermission[action] || false;
  }

  private applyOperation(document: DocumentState, operation: Operation): Operation {
    // Simplified operational transform
    // In production, use a proper OT library like ShareJS or Yjs
    return {
      ...operation,
      timestamp: new Date()
    };
  }

  // Public API methods
  sendToUser(userId: string, message: any) {
    for (const connection of this.connections.values()) {
      if (connection.user.id === userId) {
        connection.ws.send(JSON.stringify(message));
        break;
      }
    }
  }

  getRoomUsers(roomId: string): User[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.users.values()).map(c => c.user) : [];
  }

  getActiveRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  sendGlobalNotification(type: 'info' | 'warning' | 'error' | 'success', title: string, message: string) {
    const notification = {
      type: 'global-notification',
      notification: { type, title, message, timestamp: new Date().toISOString() }
    };

    for (const connection of this.connections.values()) {
      connection.ws.send(JSON.stringify(notification));
    }
  }
}

// Export singleton instance
export const advancedWebSocketService = new AdvancedWebSocketService();
