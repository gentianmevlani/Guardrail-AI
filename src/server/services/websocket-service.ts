/**
 * WebSocket Service for Live Collaboration
 * 
 * Provides real-time collaboration features:
 * - Room management for projects
 * - Presence tracking (who's online, cursor positions)
 * - Real-time code editing broadcasts
 * - Activity feed updates
 */

import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';

// Types
interface User {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

interface CursorPosition {
  line: number;
  column: number;
  file?: string;
}

interface RoomMember {
  ws: WebSocket;
  user: User;
  status: 'online' | 'away' | 'offline';
  currentFile?: string;
  cursor?: CursorPosition;
  lastActivity: Date;
}

interface Room {
  id: string;
  name: string;
  members: Map<string, RoomMember>;
  activities: Activity[];
  createdAt: Date;
}

interface Activity {
  id: string;
  type: 'edit' | 'comment' | 'review' | 'commit' | 'join' | 'leave' | 'cursor';
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  file?: string;
  data?: Record<string, unknown>;
}

type MessageType = 
  | 'join'
  | 'leave'
  | 'presence'
  | 'cursor'
  | 'edit'
  | 'comment'
  | 'activity'
  | 'file_open'
  | 'file_close'
  | 'sync_request'
  | 'sync_response';

interface WSMessage {
  type: MessageType;
  roomId: string;
  userId: string;
  payload: Record<string, unknown>;
}

// Generate random color for user cursor
function generateUserColor(): string {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private rooms: Map<string, Room> = new Map();
  private userConnections: Map<string, Set<WebSocket>> = new Map();
  private wsToUser: Map<WebSocket, { userId: string; roomId: string }> = new Map();

  /**
   * Initialize WebSocket server attached to HTTP server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 New WebSocket connection');

      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log('✅ WebSocket server initialized');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: WebSocket, message: WSMessage): void {
    const { type, roomId, userId, payload } = message;

    switch (type) {
      case 'join':
        this.handleJoin(ws, roomId, userId, payload);
        break;
      case 'leave':
        this.handleLeave(ws, roomId, userId);
        break;
      case 'cursor':
        this.handleCursor(ws, roomId, userId, payload);
        break;
      case 'edit':
        this.handleEdit(ws, roomId, userId, payload);
        break;
      case 'comment':
        this.handleComment(ws, roomId, userId, payload);
        break;
      case 'file_open':
        this.handleFileOpen(ws, roomId, userId, payload);
        break;
      case 'file_close':
        this.handleFileClose(ws, roomId, userId, payload);
        break;
      case 'presence':
        this.handlePresence(ws, roomId, userId, payload);
        break;
      case 'sync_request':
        this.handleSyncRequest(ws, roomId, userId);
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  }

  /**
   * Handle user joining a room
   */
  private handleJoin(ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    // Create room if doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        name: (payload.roomName as string) || roomId,
        members: new Map(),
        activities: [],
        createdAt: new Date(),
      });
    }

    const room = this.rooms.get(roomId)!;
    const user: User = {
      id: userId,
      name: (payload.userName as string) || `User ${userId.slice(0, 4)}`,
      avatar: payload.avatar as string | undefined,
      color: generateUserColor(),
    };

    const member: RoomMember = {
      ws,
      user,
      status: 'online',
      lastActivity: new Date(),
    };

    room.members.set(userId, member);
    this.wsToUser.set(ws, { userId, roomId });

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(ws);

    // Add join activity
    const activity: Activity = {
      id: generateId(),
      type: 'join',
      userId,
      userName: user.name,
      message: `${user.name} joined the room`,
      timestamp: new Date(),
    };
    room.activities.push(activity);

    // Keep only last 100 activities
    if (room.activities.length > 100) {
      room.activities = room.activities.slice(-100);
    }

    // Send current room state to joining user
    ws.send(JSON.stringify({
      type: 'room_state',
      roomId,
      members: Array.from(room.members.values()).map(m => ({
        user: m.user,
        status: m.status,
        currentFile: m.currentFile,
        cursor: m.cursor,
      })),
      activities: room.activities.slice(-20),
    }));

    // Broadcast join to other members
    this.broadcastToRoom(roomId, {
      type: 'user_joined',
      roomId,
      user,
      activity,
    }, userId);

    console.log(`👤 User ${user.name} joined room ${roomId}`);
  }

  /**
   * Handle user leaving a room
   */
  private handleLeave(ws: WebSocket, roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    // Add leave activity
    const activity: Activity = {
      id: generateId(),
      type: 'leave',
      userId,
      userName: member.user.name,
      message: `${member.user.name} left the room`,
      timestamp: new Date(),
    };
    room.activities.push(activity);

    room.members.delete(userId);
    this.wsToUser.delete(ws);

    // Remove from user connections
    const connections = this.userConnections.get(userId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    // Broadcast leave to other members
    this.broadcastToRoom(roomId, {
      type: 'user_left',
      roomId,
      userId,
      activity,
    }, userId);

    // Clean up empty rooms
    if (room.members.size === 0) {
      this.rooms.delete(roomId);
      console.log(`🗑️ Room ${roomId} deleted (empty)`);
    }

    console.log(`👋 User ${member.user.name} left room ${roomId}`);
  }

  /**
   * Handle cursor position updates
   */
  private handleCursor(ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    member.cursor = {
      line: payload.line as number,
      column: payload.column as number,
      file: payload.file as string | undefined,
    };
    member.lastActivity = new Date();

    // Broadcast cursor to other members
    this.broadcastToRoom(roomId, {
      type: 'cursor_update',
      roomId,
      userId,
      cursor: member.cursor,
      userName: member.user.name,
      color: member.user.color,
    }, userId);
  }

  /**
   * Handle code edit events
   */
  private handleEdit(ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    member.lastActivity = new Date();

    const activity: Activity = {
      id: generateId(),
      type: 'edit',
      userId,
      userName: member.user.name,
      message: `Modified ${payload.file || 'a file'}`,
      timestamp: new Date(),
      file: payload.file as string | undefined,
      data: {
        changes: payload.changes,
        version: payload.version,
      },
    };
    room.activities.push(activity);

    // Broadcast edit to other members
    this.broadcastToRoom(roomId, {
      type: 'edit_update',
      roomId,
      userId,
      userName: member.user.name,
      file: payload.file,
      changes: payload.changes,
      version: payload.version,
      activity,
    }, userId);
  }

  /**
   * Handle comment events
   */
  private handleComment(ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    member.lastActivity = new Date();

    const activity: Activity = {
      id: generateId(),
      type: 'comment',
      userId,
      userName: member.user.name,
      message: payload.comment as string || 'Added a comment',
      timestamp: new Date(),
      file: payload.file as string | undefined,
      data: {
        line: payload.line,
        comment: payload.comment,
      },
    };
    room.activities.push(activity);

    // Broadcast comment to all members
    this.broadcastToRoom(roomId, {
      type: 'comment_update',
      roomId,
      userId,
      userName: member.user.name,
      activity,
    });
  }

  /**
   * Handle file open events
   */
  private handleFileOpen(ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    member.currentFile = payload.file as string;
    member.lastActivity = new Date();

    // Broadcast file open to other members
    this.broadcastToRoom(roomId, {
      type: 'file_opened',
      roomId,
      userId,
      userName: member.user.name,
      file: payload.file,
    }, userId);
  }

  /**
   * Handle file close events
   */
  private handleFileClose(ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    member.currentFile = undefined;
    member.cursor = undefined;
    member.lastActivity = new Date();

    // Broadcast file close to other members
    this.broadcastToRoom(roomId, {
      type: 'file_closed',
      roomId,
      userId,
      userName: member.user.name,
      file: payload.file,
    }, userId);
  }

  /**
   * Handle presence updates (status changes)
   */
  private handlePresence(ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    member.status = (payload.status as 'online' | 'away' | 'offline') || 'online';
    member.lastActivity = new Date();

    // Broadcast presence to other members
    this.broadcastToRoom(roomId, {
      type: 'presence_update',
      roomId,
      userId,
      userName: member.user.name,
      status: member.status,
    }, userId);
  }

  /**
   * Handle sync request (get current room state)
   */
  private handleSyncRequest(ws: WebSocket, roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    ws.send(JSON.stringify({
      type: 'sync_response',
      roomId,
      members: Array.from(room.members.values()).map(m => ({
        user: m.user,
        status: m.status,
        currentFile: m.currentFile,
        cursor: m.cursor,
      })),
      activities: room.activities.slice(-20),
    }));
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(ws: WebSocket): void {
    const mapping = this.wsToUser.get(ws);
    if (mapping) {
      this.handleLeave(ws, mapping.roomId, mapping.userId);
    }
    console.log('🔌 WebSocket connection closed');
  }

  /**
   * Broadcast message to all members in a room
   */
  private broadcastToRoom(roomId: string, message: Record<string, unknown>, excludeUserId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    room.members.forEach((member, memberId) => {
      if (excludeUserId && memberId === excludeUserId) return;
      if (member.ws.readyState === WebSocket.OPEN) {
        member.ws.send(messageStr);
      }
    });
  }

  /**
   * Get room info (for REST API)
   */
  getRoomInfo(roomId: string): {
    id: string;
    name: string;
    memberCount: number;
    members: Array<{
      user: User;
      status: string;
      currentFile?: string;
    }>;
    activities: Activity[];
  } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      name: room.name,
      memberCount: room.members.size,
      members: Array.from(room.members.values()).map(m => ({
        user: m.user,
        status: m.status,
        currentFile: m.currentFile,
      })),
      activities: room.activities.slice(-50),
    };
  }

  /**
   * Get all active rooms (for REST API)
   */
  getActiveRooms(): Array<{
    id: string;
    name: string;
    memberCount: number;
    createdAt: Date;
  }> {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      memberCount: room.members.size,
      createdAt: room.createdAt,
    }));
  }

  /**
   * Create a new room (for REST API)
   */
  createRoom(roomId: string, name: string): { id: string; name: string } {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        name,
        members: new Map(),
        activities: [],
        createdAt: new Date(),
      });
    }
    return { id: roomId, name };
  }

  /**
   * Delete a room (for REST API)
   */
  deleteRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Notify all members
    this.broadcastToRoom(roomId, {
      type: 'room_deleted',
      roomId,
      message: 'Room has been deleted',
    });

    // Close all connections
    room.members.forEach((member) => {
      member.ws.close();
    });

    this.rooms.delete(roomId);
    return true;
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeRooms: number;
    activeConnections: number;
    totalUsers: number;
  } {
    let totalConnections = 0;
    this.rooms.forEach(room => {
      totalConnections += room.members.size;
    });

    return {
      activeRooms: this.rooms.size,
      activeConnections: totalConnections,
      totalUsers: this.userConnections.size,
    };
  }
}

export const webSocketService = new WebSocketService();
