/**
 * Complete Express App Example
 * 
 * Shows how to wire up all the essential middleware
 * that AI agents often miss
 */

import express, { Application } from 'express';
import { corsMiddleware, securityHeaders } from './middleware/cors.middleware';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware';
import { standardRateLimit } from './middleware/rate-limit.middleware';
import healthRoutes from './routes/health.route';
import { initDatabase } from './utils/database.util';
import { env } from './config/env.config';

const app: Application = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Essential middleware (order matters!)
app.use(requestIdMiddleware); // Add request ID first
app.use(corsMiddleware); // CORS before routes
app.use(securityHeaders); // Security headers
app.use(standardRateLimit); // Rate limiting

// Health check routes (before auth)
app.use(healthRoutes);

// Your API routes here
// app.use('/api/users', userRoutes);
// app.use('/api/posts', postRoutes);

// Error handling (must be last)
app.use(notFoundHandler); // 404 handler
app.use(errorHandler); // Error handler

// Initialize database
initDatabase(env.DATABASE_URL);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  // Close database connections
  // Close server
  process.exit(0);
});

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;

