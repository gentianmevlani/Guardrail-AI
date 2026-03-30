/**
 * Enhanced WebSocket Service for Live Collaboration
 * 
 * Provides real-time collaboration features:
 * - Room management for projects
 * - Presence tracking (who's online, cursor positions)
 * - Real-time code editing broadcasts
 * - Live code analysis
 * - Real-time notifications
 * - Activity feed updates
 */

import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { realTimeQualityService } from './realtime-quality-service';
import { predictiveQualityService } from './predictive-quality-service';
import { EventEmitter } from 'events';

// Types
export interface User {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  email?: string;
}

interface CursorPosition {
  line: number;
  column: number;
  file?: string;
}

export interface CodeAnalysis {
  file: string;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    line: number;
    column: number;
    rule?: string;
  }>;
  metrics: {
    complexity: number;
    maintainability: number;
    testCoverage?: number;
  };
  suggestions: string[];
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  userId?: string;
  roomId?: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
}

export interface RoomMember {
  ws: WebSocket;
  user: User;
  status: 'online' | 'away' | 'offline';
  currentFile?: string;
  cursor?: CursorPosition;
  lastActivity: Date;
  permissions: string[];
}

export interface Room {
  id: string;
  name: string;
  projectId?: string;
  members: Map<string, RoomMember>;
  activities: Activity[];
  notifications: Notification[];
  codeAnalysis: Map<string, CodeAnalysis>;
  createdAt: Date;
  settings: {
    autoAnalysis: boolean;
    notifyOnJoin: boolean;
    allowAnonymous: boolean;
  };
}

export interface Activity {
  id: string;
  type: 'edit' | 'comment' | 'review' | 'commit' | 'join' | 'leave' | 'cursor' | 'analysis' | 'notification';
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
  | 'sync_response'
  | 'code_analysis'
  | 'analysis_request'
  | 'notification'
  | 'mark_notification_read'
  | 'typing_start'
  | 'typing_stop';

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
  return colors[Math.floor(Math.random() * colors.length)] || '#3B82F6';
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

class EnhancedWebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private rooms: Map<string, Room> = new Map();
  private userConnections: Map<string, Set<WebSocket>> = new Map();
  private wsToUser: Map<WebSocket, { userId: string; roomId: string }> = new Map();
  private notificationQueue: Notification[] = [];
  private analysisQueue: Array<{ roomId: string; file: string; code: string }> = [];
  private isProcessingQueue = false;

  /**
   * Initialize WebSocket server attached to HTTP server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log(' New WebSocket connection');

      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error: unknown) {
          console.error('Failed to parse WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
      });
    });

    // Start processing queues
    this.startQueueProcessors();

    console.log(' Enhanced WebSocket server initialized');
  }

  /**
   * Start background processors for analysis and notifications
   */
  private startQueueProcessors(): void {
    // Process analysis queue
    setInterval(() => {
      if (!this.isProcessingQueue && this.analysisQueue.length > 0) {
        this.processAnalysisQueue();
      }
    }, 500);

    // Process notification queue
    setInterval(() => {
      if (this.notificationQueue.length > 0) {
        this.processNotificationQueue();
      }
    }, 1000);
  }

  /**
   * Process queued code analysis requests
   */
  private async processAnalysisQueue(): Promise<void> {
    this.isProcessingQueue = true;
    
    while (this.analysisQueue.length > 0) {
      const item = this.analysisQueue.shift();
      if (!item) continue;

      try {
        // Perform code analysis
        const analysis = realTimeQualityService.analyzeCode(item.code, item.file);
        const qualityScore = realTimeQualityService.getQualityScore(item.code);
        const suggestions = predictiveQualityService.analyzeContent(item.code, item.file);

        const codeAnalysis: CodeAnalysis = {
          file: item.file,
          issues: (analysis as any).issues ? (analysis as any).issues.map((issue: any) => ({
            type: issue.severity as 'error' | 'warning' | 'info',
            message: issue.message,
            line: issue.line || 0,
            column: issue.column || 0,
            rule: issue.rule
          })) : [],
          metrics: {
            complexity: (analysis as any).metrics?.complexity || 0,
            maintainability: typeof qualityScore === 'number' ? qualityScore : 0,
            testCoverage: (analysis as any).metrics?.testCoverage
          },
          suggestions: (suggestions as any)?.suggestions || []
        };

        // Store analysis in room
        const room = this.rooms.get(item.roomId);
        if (room) {
          room.codeAnalysis.set(item.file, codeAnalysis);

          // Broadcast analysis to room members
          this.broadcastToRoom(item.roomId, {
            type: 'code_analysis',
            roomId: item.roomId,
            file: item.file,
            analysis: codeAnalysis
          });

          // Add activity
          const activity: Activity = {
            id: generateId(),
            type: 'analysis',
            userId: 'system',
            userName: 'guardrail AI',
            message: `Analyzed ${item.file}: ${(analysis as any).issues?.length || 0} issues found`,
            timestamp: new Date(),
            file: item.file,
            data: { issues: (analysis as any).issues?.length || 0, score: typeof qualityScore === 'number' ? qualityScore : 0 }
          };
          room.activities.push(activity);

          // Send notification if critical issues found
          const criticalIssues = (analysis as any).issues ? (analysis as any).issues.filter((i: any) => i.severity === 'error') : [];
          if (criticalIssues.length > 0) {
            this.queueNotification({
              id: generateId(),
              type: 'error',
              title: 'Critical Issues Detected',
              message: `${criticalIssues.length} critical issue(s) found in ${item.file}`,
              roomId: item.roomId,
              timestamp: new Date(),
              read: false,
              data: { file: item.file, issues: criticalIssues }
            });
          }
        }
      } catch (error: unknown) {
        console.error('Error processing analysis queue:', error);
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Process notification queue
   */
  private processNotificationQueue(): void {
    const notifications = this.notificationQueue.splice(0, 10); // Process 10 at a time
    
    notifications.forEach(notification => {
      // Store notification
      if (notification.roomId) {
        const room = this.rooms.get(notification.roomId);
        if (room) {
          room.notifications.push(notification);
          // Keep only last 100 notifications
          if (room.notifications.length > 100) {
            room.notifications = room.notifications.slice(-100);
          }
        }
      }

      // Send to specific user or broadcast to room
      if (notification.userId) {
        this.sendToUser(notification.userId, {
          type: 'notification',
          notification
        });
      } else if (notification.roomId) {
        this.broadcastToRoom(notification.roomId, {
          type: 'notification',
          notification
        });
      }
    });
  }

  /**
   * Queue a notification
   */
  private queueNotification(notification: Notification): void {
    this.notificationQueue.push(notification);
  }

  /**
   * Handle incoming WebSocket messages
   */
  public handleMessage(ws: WebSocket, message: WSMessage): void {
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
      case 'analysis_request':
        this.handleAnalysisRequest(ws, roomId, userId, payload);
        break;
      case 'mark_notification_read':
        this.handleMarkNotificationRead(ws, roomId, userId, payload);
        break;
      case 'typing_start':
        this.handleTypingStart(ws, roomId, userId, payload);
        break;
      case 'typing_stop':
        this.handleTypingStop(ws, roomId, userId, payload);
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
        name: (payload['roomName'] as string) || roomId,
        projectId: payload['projectId'] as string | undefined,
        members: new Map(),
        activities: [],
        notifications: [],
        codeAnalysis: new Map(),
        createdAt: new Date(),
        settings: {
          autoAnalysis: payload['autoAnalysis'] as boolean ?? true,
          notifyOnJoin: payload['notifyOnJoin'] as boolean ?? true,
          allowAnonymous: payload['allowAnonymous'] as boolean ?? false
        }
      });
    }

    const room = this.rooms.get(roomId)!;
    const user: User = {
      id: userId,
      name: (payload['userName'] as string) || `User ${userId.slice(0, 4)}`,
      avatar: payload['avatar'] as string | undefined,
      color: generateUserColor(),
      email: payload['email'] as string | undefined,
    };

    const member: RoomMember = {
      ws,
      user,
      status: 'online',
      lastActivity: new Date(),
      permissions: (payload['permissions'] as string[]) || ['read', 'comment'],
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
        permissions: m.permissions,
      })),
      activities: room.activities.slice(-20),
      notifications: room.notifications.filter(n => !n.read).slice(-10),
      codeAnalysis: Array.from(room.codeAnalysis.entries()).slice(-10),
    }));

    // Broadcast join to other members
    this.broadcastToRoom(roomId, {
      type: 'user_joined',
      roomId,
      user,
      activity,
    }, userId);

    // Send welcome notification if enabled
    if (room.settings.notifyOnJoin) {
      this.queueNotification({
        id: generateId(),
        type: 'info',
        title: 'Welcome to the room!',
        message: `${user.name} has joined the collaboration room`,
        roomId,
        timestamp: new Date(),
        read: false,
      });
    }

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
  private handleCursor(_ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    member.cursor = {
      line: payload['line'] as number,
      column: payload['column'] as number,
      file: payload['file'] as string | undefined,
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
   * Handle code edit events with live analysis
   */
  private handleEdit(_ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
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
      message: `Modified ${payload['file'] || 'a file'}`,
      timestamp: new Date(),
      file: payload['file'] as string | undefined,
      data: {
        changes: payload['changes'],
        version: payload['version'],
      },
    };
    room.activities.push(activity);

    // Broadcast edit to other members
    this.broadcastToRoom(roomId, {
      type: 'edit_update',
      roomId,
      userId,
      userName: member.user.name,
      file: payload['file'],
      changes: payload['changes'],
      version: payload['version'],
      activity,
    }, userId);

    // Queue code analysis if enabled
    if (room.settings.autoAnalysis && payload['file'] && payload['content']) {
      this.analysisQueue.push({
        roomId,
        file: payload['file'] as string,
        code: payload['content'] as string,
      });
    }
  }

  /**
   * Handle comment events
   */
  private handleComment(_ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
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
      message: payload['comment'] as string || 'Added a comment',
      timestamp: new Date(),
      file: payload['file'] as string | undefined,
      data: {
        line: payload['line'],
        comment: payload['comment'],
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

    // Notify mentioned users
    const comment = payload['comment'] as string || '';
    const mentions = comment.match(/@(\w+)/g);
    if (mentions) {
      mentions.forEach(mention => {
        const mentionedUserId = mention.slice(1);
        this.sendToUser(mentionedUserId, {
          type: 'notification',
          notification: {
            id: generateId(),
            type: 'info',
            title: 'You were mentioned',
            message: `${member.user.name} mentioned you in a comment`,
            userId: mentionedUserId,
            roomId,
            timestamp: new Date(),
            read: false,
            data: { comment: payload['comment'], file: payload['file'] }
          }
        });
      });
    }
  }

  /**
   * Handle file open events
   */
  private handleFileOpen(ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    member.currentFile = payload['file'] as string;
    member.lastActivity = new Date();

    // Broadcast file open to other members
    this.broadcastToRoom(roomId, {
      type: 'file_opened',
      roomId,
      userId,
      userName: member.user.name,
      file: payload['file'],
    }, userId);

    // Send existing analysis if available
    const file = payload['file'] as string;
    if (file && room.codeAnalysis.has(file)) {
      ws.send(JSON.stringify({
        type: 'code_analysis',
        roomId,
        file,
        analysis: room.codeAnalysis.get(file),
      }));
    }
  }

  /**
   * Handle file close events
   */
  private handleFileClose(_ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
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
      file: payload['file'],
    }, userId);
  }

  /**
   * Handle presence updates (status changes)
   */
  private handlePresence(_ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    member.status = (payload['status'] as 'online' | 'away' | 'offline') || 'online';
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
  private handleSyncRequest(ws: WebSocket, roomId: string, _userId: string): void {
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
        userId: m.user.id,
      })),
      activities: room.activities.slice(-20),
      notifications: room.notifications.filter(n => !n.read).slice(-10),
      codeAnalysis: Array.from(room.codeAnalysis.entries()).slice(-10),
    }));
  }

  /**
   * Handle analysis request
   */
  private handleAnalysisRequest(ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member || !member.permissions.includes('analyze')) {
      ws.send(JSON.stringify({ type: 'error', message: 'Permission denied' }));
      return;
    }

    if (payload['file'] && payload['content']) {
      this.analysisQueue.push({
        roomId,
        file: payload['file'] as string,
        code: payload['content'] as string,
      });
    }
  }

  /**
   * Handle marking notification as read
   */
  private handleMarkNotificationRead(ws: WebSocket, roomId: string, _userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const notificationId = payload['notificationId'] as string;
    const notification = room.notifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
      ws.send(JSON.stringify({
        type: 'notification_marked_read',
        notificationId,
      }));
    }
  }

  /**
   * Handle typing start
   */
  private handleTypingStart(_ws: WebSocket, roomId: string, userId: string, payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(userId);
    if (!member) return;

    // Broadcast typing indicator to other members
    this.broadcastToRoom(roomId, {
      type: 'user_typing',
      roomId,
      userId,
      userName: member.user.name,
      file: payload['file'],
    }, userId);
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(_ws: WebSocket, roomId: string, userId: string, _payload: Record<string, unknown>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Broadcast typing stop to other members
    this.broadcastToRoom(roomId, {
      type: 'user_stop_typing',
      roomId,
      userId,
    }, userId);
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
   * Get room information
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
    notifications: Notification[];
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
      notifications: room.notifications.slice(-20),
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
  createRoom(roomId: string, name: string, settings?: Partial<Room['settings']>): { id: string; name: string } {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        name,
        members: new Map(),
        activities: [],
        notifications: [],
        codeAnalysis: new Map(),
        createdAt: new Date(),
        settings: {
          autoAnalysis: settings?.autoAnalysis ?? true,
          notifyOnJoin: settings?.notifyOnJoin ?? true,
          allowAnonymous: settings?.allowAnonymous ?? false,
        },
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
    queuedAnalysis: number;
    queuedNotifications: number;
  } {
    let totalConnections = 0;
    this.rooms.forEach(room => {
      totalConnections += room.members.size;
    });

    return {
      activeRooms: this.rooms.size,
      activeConnections: totalConnections,
      totalUsers: this.userConnections.size,
      queuedAnalysis: this.analysisQueue.length,
      queuedNotifications: this.notificationQueue.length,
    };
  }

  /**
   * Send global notification to all users
   */
  sendGlobalNotification(type: 'info' | 'warning' | 'error' | 'success', title: string, message: string): void {
    const notification: Notification = {
      id: generateId(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
    };

    this.rooms.forEach((room) => {
      this.broadcastToRoom(room.id, {
        type: 'notification',
        notification: { ...notification, roomId: room.id },
      });
    });
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
   * Send message to a specific user
   */
  private sendToUser(userId: string, message: Record<string, unknown>): void {
    const connections = this.userConnections.get(userId);
    if (!connections) return;

    const messageStr = JSON.stringify(message);
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  /**
   * Send to user (legacy method for compatibility)
   */
  sendToUserLegacy(userId: string, type: string, data: any): void {
    const connections = this.userConnections.get(userId);
    if (!connections) return;

    const message = JSON.stringify({ type, data });
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Broadcast message (legacy method for compatibility)
   */
  broadcast(type: string, data: any, room?: string): void {
    if (room) {
      this.broadcastToRoom(room, { type, data });
    } else {
      // Broadcast to all rooms
      this.rooms.forEach((r) => {
        this.broadcastToRoom(r.id, { type, data });
      });
    }
  }

  /**
   * Get connected users (legacy method for compatibility)
   */
  getConnectedUsers(): string[] {
    return Array.from(this.userConnections.keys());
  }

  /**
   * Join room (legacy method for compatibility)
   */
  joinRoom(_ws: WebSocket, roomId: string): void {
    // This is handled by the enhanced service's handleJoin method
    console.log(`Legacy joinRoom called for room: ${roomId}`);
  }

  /**
   * Leave all rooms (legacy method for compatibility)
   */
  leaveAllRooms(_ws: WebSocket): void {
    // This is handled by the enhanced service's handleDisconnect method
    console.log('Legacy leaveAllRooms called');
  }
}

export const enhancedWebSocketService = new EnhancedWebSocketService();
