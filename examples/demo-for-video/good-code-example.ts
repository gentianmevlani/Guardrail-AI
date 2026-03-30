/**
 * This file shows CLEAN code after guardrail fixes.
 * Use this for the "after" comparison in the demo video.
 */

import express from 'express';
import { logger } from './logger';

// Mock database client for demo
const db = {
  users: {
    findMany: async () => []
  }
};

const app = express();

// Real data fetching from database
async function getUsers() {
  return db.users.findMany();
}

// Proper API URL from environment
const API_URL = process.env.API_URL || '';

// Proper error handling
async function fetchData() {
  try {
    const response = await fetch(API_URL);
    return response.json();
  } catch (error) {
    logger.error('Failed to fetch data:', error);
    throw new Error('Data fetch failed');
  }
}

// Proper TypeScript types
interface DataPayload {
  id: string;
  content: string;
  timestamp: Date;
}

function processData(data: DataPayload): DataPayload {
  logger.info('Processing data', { id: data.id });
  return {
    ...data,
    timestamp: new Date(),
  };
}

// Real content
const welcomeMessage = 'Welcome to our application!';

// Clean conditional logic
function getStatus(isActive: boolean, isPremium: boolean): string {
  if (isPremium) {
    return 'premium';
  }
  if (isActive) {
    return 'active';
  }
  return 'inactive';
}

// API keys from environment
const stripeKey = process.env.STRIPE_SECRET_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

export { getUsers, fetchData, processData };
