/**
 * WebSocket Collaboration Test Script
 * 
 * This script tests the WebSocket collaboration features
 * Run with: npm run test:websocket
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3000/ws';
const TEST_ROOM = 'test-room-' + Date.now();

// Test configuration
const TEST_USERS = [
  { id: 'alice', name: 'Alice Johnson', color: '#3B82F6' },
  { id: 'bob', name: 'Bob Smith', color: '#10B981' },
  { id: 'charlie', name: 'Charlie Brown', color: '#F59E0B' }
];

let connections: WebSocket[] = [];
let testResults = {
  passed: 0,
  failed: 0,
  errors: [] as string[]
};

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  console.log(`${timestamp} ${prefix} ${message}`);
}

function assert(condition: boolean, message: string) {
  if (condition) {
    testResults.passed++;
    log(message, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    log(message, 'error');
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testConnection() {
  log('Testing WebSocket connection...');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    connections.push(ws);
    
    ws.on('open', () => {
      log('WebSocket connected successfully', 'success');
      resolve(ws);
    });
    
    ws.on('error', (error) => {
      log(`WebSocket connection failed: ${error.message}`, 'error');
      reject(error);
    });
    
    setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 5000);
  });
}

async function testRoomJoin() {
  log('Testing room join functionality...');
  
  const results = await Promise.all(
    TEST_USERS.map(async (user, index) => {
      return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);
        connections.push(ws);
        
        let joined = false;
        
        ws.on('open', () => {
          // Send join message
          ws.send(JSON.stringify({
            type: 'join',
            roomId: TEST_ROOM,
            userId: user.id,
            payload: {
              userName: user.name,
              permissions: ['read', 'write', 'comment']
            }
          }));
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'room_state') {
            joined = true;
            assert(
              message.members && message.members.length === index + 1,
              `User ${user.name} joined room successfully`
            );
            resolve({ user: user.name, joined });
          }
        });
        
        setTimeout(() => {
          resolve({ user: user.name, joined: false });
        }, 2000);
      });
    })
  );
  
  const allJoined = results.every((r: any) => r.joined);
  assert(allJoined, 'All users joined the room');
}

async function testCursorTracking() {
  log('Testing cursor position tracking...');
  
  const aliceWs = connections[0];
  let cursorReceived = false;
  
  // Set up listener for Bob's connection
  connections[1]!.on('message', (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === 'cursor_update' && message.userId === 'alice') {
      cursorReceived = true;
      assert(
        message.cursor.line === 10 && message.cursor.column === 20,
        'Cursor position broadcasted correctly'
      );
    }
  });
  
  // Send cursor update from Alice
  aliceWs!.send(JSON.stringify({
    type: 'cursor',
    roomId: TEST_ROOM,
    userId: 'alice',
    payload: {
      line: 10,
      column: 20,
      file: 'src/test.ts'
    }
  }));
  
  await sleep(1000);
  assert(cursorReceived, 'Cursor tracking working');
}

async function testCodeEdit() {
  log('Testing code edit with analysis...');
  
  const bobWs = connections[1];
  let editReceived = false;
  
  // Listen for edits on Charlie's connection
  connections[2]!.on('message', (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === 'edit_update' && message.userId === 'bob') {
      editReceived = true;
      assert(
        message.file === 'src/test.ts',
        'Code edit broadcasted correctly'
      );
    }
  });
  
  // Send code edit from Bob
  bobWs!.send(JSON.stringify({
    type: 'edit',
    roomId: TEST_ROOM,
    userId: 'bob',
    payload: {
      file: 'src/test.ts',
      content: 'function test() { console.log("Hello World"); }',
      changes: { type: 'insert', position: 0 }
    }
  }));
  
  await sleep(1000);
  assert(editReceived, 'Code edit broadcasting working');
}

async function testNotifications() {
  log('Testing notification system...');
  
  let notificationReceived = false;
  
  // Listen for notifications on all connections
  connections.forEach(ws => {
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'notification') {
        notificationReceived = true;
        assert(
          message.notification.type === 'info',
          'Notification received successfully'
        );
      }
    });
  });
  
  // Simulate server sending notification
  // In real scenario, this would come from the server
  await sleep(500);
  assert(notificationReceived, 'Notification system working');
}

async function testTypingIndicators() {
  log('Testing typing indicators...');
  
  let typingReceived = false;
  
  // Listen for typing on Alice's connection
  connections[0]!.on('message', (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === 'user_typing' && message.userId === 'bob') {
      typingReceived = true;
      assert(
        message.userName === 'Bob Smith',
        'Typing indicator received correctly'
      );
    }
  });
  
  // Send typing start from Bob
  connections[1]!.send(JSON.stringify({
    type: 'typing_start',
    roomId: TEST_ROOM,
    userId: 'bob',
    payload: {
      file: 'src/test.ts'
    }
  }));
  
  await sleep(500);
  
  // Send typing stop from Bob
  connections[1]!.send(JSON.stringify({
    type: 'typing_stop',
    roomId: TEST_ROOM,
    userId: 'bob',
    payload: {}
  }));
  
  await sleep(500);
  assert(typingReceived, 'Typing indicators working');
}

async function cleanup() {
  log('Cleaning up connections...');
  
  // Leave room and close connections
  connections.forEach((ws, index) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'leave',
        roomId: TEST_ROOM,
        userId: TEST_USERS[index]!.id,
        payload: {}
      }));
      
      ws.close();
    }
  });
  
  await sleep(1000);
}

async function runTests() {
  log('Starting WebSocket Collaboration Tests\n');
  
  try {
    await testConnection();
    await sleep(500);
    
    await testRoomJoin();
    await sleep(500);
    
    await testCursorTracking();
    await sleep(500);
    
    await testCodeEdit();
    await sleep(500);
    
    await testNotifications();
    await sleep(500);
    
    await testTypingIndicators();
    await sleep(500);
    
  } catch (error) {
    log(`Test suite failed: ${(error as Error).message}`, 'error');
    testResults.errors.push((error as Error).message);
  } finally {
    await cleanup();
    
    // Print results
    log('\n=== Test Results ===');
    log(`Passed: ${testResults.passed}`, 'success');
    log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
    
    if (testResults.errors.length > 0) {
      log('\nErrors:', 'error');
      testResults.errors.forEach(error => log(`  - ${error}`, 'error'));
    }
    
    log(`\nTotal: ${testResults.passed + testResults.failed} tests`);
    
    if (testResults.failed === 0) {
      log('All tests passed! 🎉', 'success');
      process.exit(0);
    } else {
      log('Some tests failed. Please check the errors above.', 'error');
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

export { runTests };
