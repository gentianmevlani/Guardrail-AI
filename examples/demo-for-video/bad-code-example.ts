/**
 * This file has INTENTIONAL issues for the guardrail demo video.
 * DO NOT FIX THESE - they are here to show what guardrail catches!
 */

// TODO: Remove this before production
// FIXME: This is broken

import express from 'express';

const app = express();

// Mock data that shouldn't be in production
const mockUsers = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Doe', email: 'jane@example.com' },
];

const fakeApiKey = 'sk-fake-api-key-12345';
const dummyData = { placeholder: true };

// Console.log statements that should be removed
console.log('Server starting...');
console.log('Debug mode enabled');

// Hardcoded localhost URL
const API_URL = 'http://localhost:3000/api';

// Empty catch block
async function fetchData() {
  try {
    const response = await fetch(API_URL);
    return response.json();
  } catch (error) {
    // Empty catch - bad practice!
  }
}

// Using 'any' type - bad TypeScript
function processData(data: any): any {
  console.log('Processing:', data);
  return data;
}

// @ts-ignore - suppressing type errors
// @ts-ignore
const badVariable = undefined.something;

// Lorem ipsum placeholder text
const placeholderText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

// Nested ternary - hard to read
const status = true ? (false ? 'a' : 'b') : 'c';

// Inline styles (React example)
const buttonStyle = { style: { color: 'red', padding: '10px' } };

// Hardcoded API key (security issue!)
// NOTE: These are FAKE keys for demo purposes - DO NOT use real keys!
const STRIPE_LIVE_PREFIX = String.fromCharCode(
  115, 107, 95, 108, 105, 118, 101, 95,
);
const stripeKey = `${STRIPE_LIVE_PREFIX}FAKE_KEY_FOR_DEMO_ONLY`;
const openaiKey = 'FAKE_OPENAI_KEY_FOR_DEMO_ONLY';

// debugger statement left in code
function brokenFunction() {
  debugger;
  return 'test';
}

// eslint-disable comment
// eslint-disable-next-line
const unusedVariable = 'this should be caught';

export { mockUsers, fetchData, processData };
