#!/usr/bin/env node

/**
 * Connect MCP
 * 
 * Connect to external MCP servers
 */

const { mcpConnector } = require('../src/lib/mcp-connector.js');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🔗 guardrail AI - MCP Connector                     ║
║                                                              ║
║  Connect with other MCP servers and integrations            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const command = process.argv[2];

  if (command === 'list') {
    await listConnections();
  } else if (command === 'connect') {
    await connectMCP();
  } else if (command === 'disconnect') {
    await disconnectMCP();
  } else {
    console.log('Usage:');
    console.log('  guardrail connect-mcp list        - List all connections');
    console.log('  guardrail connect-mcp connect     - Connect to MCP server');
    console.log('  guardrail connect-mcp disconnect - Disconnect from MCP server');
  }

  rl.close();
}

async function listConnections() {
  const connections = mcpConnector.listConnections();
  
  if (connections.length === 0) {
    console.log('\nNo connections found.\n');
    return;
  }

  console.log('\n📋 Connected MCPs:\n');
  connections.forEach(conn => {
    const statusIcon = conn.status === 'connected' ? '✅' : conn.status === 'error' ? '❌' : '⚠️';
    console.log(`   ${statusIcon} ${conn.name} (${conn.type})`);
    console.log(`      Endpoint: ${conn.endpoint}`);
    console.log(`      Status: ${conn.status}`);
    if (conn.capabilities.length > 0) {
      console.log(`      Capabilities: ${conn.capabilities.join(', ')}`);
    }
    console.log('');
  });
}

async function connectMCP() {
  console.log('\n🔌 Connect to MCP Server\n');

  const name = await question('Name: ');
  const endpoint = await question('Endpoint: ');
  const apiKey = await question('API Key (optional): ');

  try {
    let connection;
    if (apiKey) {
      connection = await mcpConnector.connectAPI(name, endpoint, apiKey);
    } else {
      connection = await mcpConnector.connectMCP(name, endpoint);
    }

    console.log(`\n✅ Connected to ${name}!\n`);
    console.log(`   Connection ID: ${connection.id}`);
    console.log(`   Status: ${connection.status}`);
    console.log(`   Capabilities: ${connection.capabilities.join(', ')}\n`);
  } catch (error) {
    console.error(`\n❌ Failed to connect: ${error.message}\n`);
  }
}

async function disconnectMCP() {
  const connections = mcpConnector.listConnections();
  
  if (connections.length === 0) {
    console.log('\nNo connections to disconnect.\n');
    return;
  }

  console.log('\n📋 Select connection to disconnect:\n');
  connections.forEach((conn, i) => {
    console.log(`   ${i + 1}. ${conn.name} (${conn.id})`);
  });

  const choice = await question('\nEnter number: ');
  const index = parseInt(choice) - 1;

  if (index >= 0 && index < connections.length) {
    mcpConnector.disconnect(connections[index].id);
    console.log(`\n✅ Disconnected from ${connections[index].name}\n`);
  } else {
    console.log('\n❌ Invalid selection\n');
  }
}

main();

