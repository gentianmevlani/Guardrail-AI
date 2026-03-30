#!/usr/bin/env node

/**
 * guardrail API Server Entry Point
 * 
 * Start the server with: node src/server/start.js
 * Or with npm: npm run server
 */

// Load environment variables
import 'dotenv/config';

import { startServer } from './index';

startServer();
