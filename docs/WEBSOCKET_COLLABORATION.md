# WebSocket Collaboration Features

This document describes the WebSocket-based real-time collaboration features implemented in guardrail, including live code analysis, real-time notifications, and activity feeds.

## Overview

The WebSocket collaboration system enables multiple users to work together on code projects in real-time. It provides:

- **Live Presence Tracking**: See who's online and what they're working on
- **Real-time Code Analysis**: Get instant feedback on code quality as you type
- **Activity Feeds**: Track all collaboration activities with detailed logs
- **Notifications System**: Real-time alerts for important events
- **Cursor Sharing**: See other users' cursor positions in the code
- **Typing Indicators**: Know when someone is typing a message or code

## Architecture

### Backend Components

#### 1. Enhanced WebSocket Service
Located at `src/server/services/enhanced-websocket-service.ts`

Key features:
- Room-based collaboration
- User presence management
- Real-time code analysis queue
- Notification system
- Activity tracking

#### 2. WebSocket Plugin
Located at `apps/api/src/plugins/websocket.ts`

Integrates WebSocket server with Fastify and handles:
- Authentication via JWT tokens
- Message routing
- Connection management

#### 3. Collaboration API Routes
Located at `apps/api/src/routes/collaboration.ts`

REST endpoints for:
- Creating and managing rooms
- Joining rooms with authentication
- Sending notifications
- Retrieving activity feeds

### Frontend Components

#### 1. Enhanced WebSocket Hook
Located at `web-ui/src/hooks/useEnhancedWebSocket.ts`

React hook that provides:
- WebSocket connection management
- Automatic reconnection
- State management for rooms, users, activities
- Methods for sending messages

#### 2. Live Collaboration Panel
Located at `web-ui/src/components/LiveCollaborationPanel.tsx`

UI component displaying:
- Active users list
- Real-time activity feed
- Notifications panel
- Code analysis results

## API Reference

### WebSocket Messages

#### Connection Messages
```typescript
// Join a room
{
  type: 'join',
  roomId: string,
  userId: string,
  payload: {
    userName: string,
    avatar?: string,
    permissions?: string[],
    projectId?: string
  }
}

// Leave a room
{
  type: 'leave',
  roomId: string,
  userId: string,
  payload: {}
}
```

#### Real-time Features
```typescript
// Cursor position update
{
  type: 'cursor',
  roomId: string,
  userId: string,
  payload: {
    line: number,
    column: number,
    file?: string
  }
}

// Code edit with analysis
{
  type: 'edit',
  roomId: string,
  userId: string,
  payload: {
    file: string,
    content: string,
    changes?: any,
    version?: number
  }
}

// Comment with mentions
{
  type: 'comment',
  roomId: string,
  userId: string,
  payload: {
    file: string,
    line: number,
    comment: string
  }
}

// Typing indicators
{
  type: 'typing_start' | 'typing_stop',
  roomId: string,
  userId: string,
  payload: {
    file?: string
  }
}
```

#### Analysis and Notifications
```typescript
// Request code analysis
{
  type: 'analysis_request',
  roomId: string,
  userId: string,
  payload: {
    file: string,
    content: string
  }
}

// Analysis results
{
  type: 'code_analysis',
  roomId: string,
  file: string,
  analysis: {
    issues: Array<{
      type: 'error' | 'warning' | 'info',
      message: string,
      line: number,
      column: number,
      rule?: string
    }>,
    metrics: {
      complexity: number,
      maintainability: number,
      testCoverage?: number
    },
    suggestions: string[]
  }
}

// Notification
{
  type: 'notification',
  notification: {
    id: string,
    type: 'info' | 'warning' | 'error' | 'success',
    title: string,
    message: string,
    timestamp: Date,
    read: boolean,
    data?: any
  }
}
```

### REST API Endpoints

#### Rooms
```http
GET /api/collaboration/rooms          # List active rooms
GET /api/collaboration/rooms/:id      # Get room details
POST /api/collaboration/rooms         # Create new room
DELETE /api/collaboration/rooms/:id   # Delete room
```

#### Authentication
```http
POST /api/collaboration/join          # Get WebSocket auth token
```

#### Notifications
```http
POST /api/collaboration/notify        # Send notification
GET /api/collaboration/activity/:id   # Get activity feed
GET /api/collaboration/stats          # Get statistics
```

## Usage Examples

### 1. Setting up a Collaboration Session

```typescript
// Backend: Create a room
const room = enhancedWebSocketService.createRoom(
  'project-123-room-1',
  'Frontend Development',
  {
    autoAnalysis: true,
    notifyOnJoin: true,
    allowAnonymous: false
  }
);

// Frontend: Join the room
const { joinRoom } = useEnhancedWebSocket('ws://localhost:3000/ws');

joinRoom('project-123-room-1', userId, userName, {
  permissions: ['read', 'write', 'comment'],
  projectId: 'project-123'
});
```

### 2. Real-time Code Analysis

```typescript
// When code is edited
const { sendEdit } = useEnhancedWebSocket(wsUrl);

sendEdit(roomId, userId, 'src/app.tsx', newCode, {
  operation: 'insert',
  position: { line: 10, column: 5 }
});

// Analysis results are automatically broadcasted
// and can be accessed from the hook
const { codeAnalysis } = useEnhancedWebSocket(wsUrl);

const analysis = codeAnalysis.get('src/app.tsx');
console.log(analysis.issues); // Array of issues
console.log(analysis.metrics); // Quality metrics
```

### 3. Sending Notifications

```typescript
// Backend: Send notification to room
enhancedWebSocketService.sendGlobalNotification(
  'warning',
  'Code Quality Alert',
  'High complexity detected in component'
);

// Frontend: Mark notification as read
const { markNotificationRead } = useEnhancedWebSocket(wsUrl);
markNotificationRead(notificationId);
```

## Configuration

### Environment Variables

```env
# WebSocket server configuration
WS_URL=ws://localhost:3000
WS_PATH=/ws

# Collaboration settings
COLLABORATION_MAX_ROOMS=100
COLLABORATION_MAX_USERS_PER_ROOM=50
ANALYSIS_QUEUE_SIZE=1000
NOTIFICATION_QUEUE_SIZE=500
```

### Room Settings

```typescript
interface RoomSettings {
  autoAnalysis: boolean;    // Enable automatic code analysis
  notifyOnJoin: boolean;    // Notify when users join
  allowAnonymous: boolean;  // Allow anonymous users
}
```

## Performance Considerations

1. **Analysis Queue**: Code analysis is queued and processed asynchronously to prevent blocking
2. **Rate Limiting**: WebSocket messages are rate-limited per user
3. **Memory Management**: Old activities and notifications are automatically cleaned up
4. **Connection Pooling**: WebSocket connections are efficiently managed with automatic cleanup

## Security Features

1. **Authentication**: All WebSocket connections require valid JWT tokens
2. **Authorization**: Room permissions are enforced for all actions
3. **Input Validation**: All messages are validated before processing
4. **Rate Limiting**: Prevents abuse with configurable rate limits

## Monitoring and Debugging

### Statistics Endpoint
```http
GET /api/collaboration/stats
```

Returns:
- Active rooms count
- Active connections
- Queued analysis requests
- Queued notifications

### Logging
All WebSocket events are logged with:
- Connection ID
- User ID
- Room ID
- Message type
- Timestamp

## Testing

### Unit Tests
```bash
# Test WebSocket service
npm test src/server/services/enhanced-websocket-service.test.ts

# Test API routes
npm test apps/api/src/routes/collaboration.test.ts
```

### Integration Tests
```bash
# Test end-to-end collaboration
npm test tests/collaboration.integration.test.ts
```

## Troubleshooting

### Common Issues

1. **Connection Fails**
   - Check WebSocket URL is correct
   - Verify JWT token is valid
   - Check CORS configuration

2. **Messages Not Received**
   - Verify user has joined the room
   - Check message format
   - Review room permissions

3. **Analysis Not Working**
   - Check if auto-analysis is enabled
   - Verify analysis queue isn't full
   - Check code analysis service logs

### Debug Mode

Enable debug logging:
```typescript
// In development
process.env.WS_DEBUG = 'true';
```

This will log all WebSocket messages and events.

## Future Enhancements

1. **Video/Audio Chat**: Integration with WebRTC for voice/video collaboration
2. **Screen Sharing**: Real-time screen sharing for pair programming
3. **AI Assistant**: AI-powered suggestions during collaboration
4. **Version Control**: Git integration with real-time sync
5. **Mobile Support**: React Native app for mobile collaboration

## Contributing

When contributing to the WebSocket collaboration system:

1. Follow the existing message format conventions
2. Add proper TypeScript types for new messages
3. Include unit tests for new features
4. Update documentation for API changes
5. Consider performance impact of new features

## License

This WebSocket collaboration system is part of guardrail and follows the same license terms.
