/**
 * Real-Time Features
 * 
 * What AI app builders forget: Real-time updates, notifications, live data
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

export interface RealTimeConfig {
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  namespace?: string;
}

class RealTimeManager {
  private io: SocketIOServer | null = null;

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer: HTTPServer, config: RealTimeConfig = {}) {
    this.io = new SocketIOServer(httpServer, {
      cors: config.cors || {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
      },
      path: '/socket.io',
    });

    this.setupHandlers();
    return this.io;
  }

  /**
   * Setup Socket.IO handlers
   */
  private setupHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Join user room
      socket.on('join:user', (userId: string) => {
        socket.join(`user:${userId}`);
        console.log(`User ${userId} joined their room`);
      });

      // Join room
      socket.on('join:room', (roomId: string) => {
        socket.join(`room:${roomId}`);
        console.log(`Client joined room: ${roomId}`);
      });

      // Leave room
      socket.on('leave:room', (roomId: string) => {
        socket.leave(`room:${roomId}`);
        console.log(`Client left room: ${roomId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  /**
   * Emit to user
   */
  emitToUser(userId: string, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit to room
   */
  emitToRoom(roomId: string, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`room:${roomId}`).emit(event, data);
  }

  /**
   * Broadcast to all
   */
  broadcast(event: string, data: any) {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  /**
   * Get connected users count
   */
  getConnectedCount(): number {
    if (!this.io) return 0;
    return this.io.sockets.sockets.size;
  }
}

export const realTimeManager = new RealTimeManager();

/**
 * Example usage in Express app:
 * 
 * const httpServer = http.createServer(app);
 * const io = realTimeManager.initialize(httpServer);
 * 
 * // In your route handlers:
 * realTimeManager.emitToUser(userId, 'notification', { message: 'New message!' });
 */

