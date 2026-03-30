/**
 * guardrail API Server
 * 
 * Express server providing:
 * - Real mock data detection
 * - Project analysis
 * - AI-powered code explanation
 * - User authentication
 * - Database integration with Prisma
 */

import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AuthenticatedRequest, authMiddleware, rateLimit } from './middleware/auth';
import { authRateLimitMiddleware, recordAuthFailure, recordAuthSuccess } from './middleware/auth-rate-limiter';
import { aiExplainer } from './services/ai-explainer';
import { authService } from './services/auth-service';
import { codeRelationshipsService } from './services/code-relationships-service';
import { codeSearchService } from './services/code-search-service';
import { databaseService } from './services/database-service';
import { dependencyAnalyzerService } from './services/dependency-analyzer-service';
import { gitHistoryService } from './services/git-history-service';
import { metricsService } from './services/metrics-service';
import { mockDataScanner } from './services/mock-data-scanner';
import { predictiveQualityService } from './services/predictive-quality-service';
import { productionPredictorService } from './services/production-predictor-service';
import { projectAnalyzer } from './services/project-analyzer';
import { realTimeQualityService } from './services/realtime-quality-service';

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting configuration
const standardRateLimit = rateLimit(100, 60 * 1000); // 100 requests per minute
const authRateLimit = rateLimit(10, 60 * 1000); // 10 auth requests per minute
const aiRateLimit = rateLimit(20, 60 * 1000); // 20 AI requests per minute

// Helper to sanitize error messages before sending to client
const sanitizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // Remove file system paths from error messages
    let message = error.message;
    // Remove absolute paths (Unix and Windows)
    message = message.replace(/(?:\/[^\s:]+)+/g, '[path]');
    message = message.replace(/(?:[A-Z]:\\[^\s:]+)+/gi, '[path]');
    return message;
  }
  return 'An unexpected error occurred';
};

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ===========================================
// MOCK DATA DETECTION - Real Implementation
// ===========================================

/**
 * Scan a directory for mock data patterns
 */
app.post('/api/scan/mock-data', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const results = await mockDataScanner.scanDirectory(directory);
    return res.json(results);
  } catch (error) {
    console.error('Mock data scan error:', error);
    return res.status(500).json({ 
      error: 'Failed to scan for mock data',
      message: sanitizeErrorMessage(error)
    });
  }
});

/**
 * Scan specific code content for mock data patterns
 */
app.post('/api/scan/mock-data/content', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { code, filename } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code content is required' });
    }

    const results = mockDataScanner.scanContent(code, filename || 'unknown');
    return res.json(results);
  } catch (error) {
    console.error('Mock data content scan error:', error);
    return res.status(500).json({ 
      error: 'Failed to scan content for mock data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// PROJECT ANALYSIS - Dashboard Data
// ===========================================

/**
 * Analyze a project and return real metrics
 */
app.post('/api/analyze/project', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const analysis = await projectAnalyzer.analyzeProject(directory);
    return res.json(analysis);
  } catch (error) {
    console.error('Project analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get project validation results
 */
app.post('/api/validate/project', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const validation = await projectAnalyzer.validateProject(directory);
    return res.json(validation);
  } catch (error) {
    console.error('Project validation error:', error);
    return res.status(500).json({ 
      error: 'Failed to validate project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// AI CODE EXPLANATION - Real AI Integration
// ===========================================

/**
 * Explain code using AI (OpenAI or Anthropic)
 */
app.post('/api/ai/explain', aiRateLimit, async (req: Request, res: Response) => {
  try {
    const { code, experienceLevel, provider } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const explanation = await aiExplainer.explainCode(code, {
      experienceLevel: experienceLevel || 'intermediate',
      provider: provider || 'openai',
    });
    
    return res.json(explanation);
  } catch (error) {
    console.error('AI explanation error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate explanation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Ask a question about code using AI
 */
app.post('/api/ai/ask', aiRateLimit, async (req: Request, res: Response) => {
  try {
    const { code, question, provider } = req.body;
    
    if (!code || !question) {
      return res.status(400).json({ error: 'Code and question are required' });
    }

    const answer = await aiExplainer.askQuestion(code, question, {
      provider: provider || 'openai',
    });
    
    return res.json(answer);
  } catch (error) {
    console.error('AI question error:', error);
    return res.status(500).json({ 
      error: 'Failed to answer question',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// NATURAL LANGUAGE CODE SEARCH
// ===========================================

/**
 * Index a codebase for search
 */
app.post('/api/search/index', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const stats = await codeSearchService.indexCodebase(directory);
    return res.json(stats);
  } catch (error) {
    console.error('Index error:', error);
    return res.status(500).json({ 
      error: 'Failed to index codebase',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Search codebase using natural language
 */
app.post('/api/search/query', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { query, limit } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await codeSearchService.search(query, limit || 10);
    return res.json({ results, query, count: results.length });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ 
      error: 'Failed to search codebase',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Find similar code
 */
app.post('/api/search/similar', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { code, limit } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code snippet is required' });
    }

    const results = await codeSearchService.findSimilar(code, limit || 10);
    return res.json({ results, count: results.length });
  } catch (error) {
    console.error('Similar search error:', error);
    return res.status(500).json({ 
      error: 'Failed to find similar code',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get search index stats
 */
app.get('/api/search/stats', standardRateLimit, (_req: Request, res: Response) => {
  try {
    const stats = codeSearchService.getStats();
    if (!stats) {
      return res.json({ indexed: false, message: 'No codebase indexed yet' });
    }
    return res.json({ indexed: true, ...stats });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ 
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// DEPENDENCY ANALYZER
// ===========================================

/**
 * Analyze project dependencies
 */
app.post('/api/dependencies/analyze', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const analysis = await dependencyAnalyzerService.analyzeProject(directory);
    return res.json(analysis);
  } catch (error) {
    console.error('Dependency analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze dependencies',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze package.json content directly
 */
app.post('/api/dependencies/analyze-content', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { packageJson } = req.body;
    
    if (!packageJson) {
      return res.status(400).json({ error: 'Package.json content is required' });
    }

    const analysis = dependencyAnalyzerService.analyzePackageJson(packageJson);
    return res.json(analysis);
  } catch (error) {
    console.error('Dependency analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze dependencies',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// CODE RELATIONSHIPS
// ===========================================

/**
 * Analyze code relationships/dependencies
 */
app.post('/api/relationships/analyze', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const analysis = await codeRelationshipsService.analyzeRelationships(directory);
    return res.json(analysis);
  } catch (error) {
    console.error('Relationships analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze code relationships',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Export relationship graph in different formats
 */
app.post('/api/relationships/export', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory, format } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const analysis = await codeRelationshipsService.analyzeRelationships(directory);
    const exported = codeRelationshipsService.exportGraph(
      analysis.graph, 
      format || 'json'
    );
    
    return res.json({ format: format || 'json', data: exported });
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ 
      error: 'Failed to export graph',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// PREDICTIVE QUALITY
// ===========================================

/**
 * Analyze project for quality predictions
 */
app.post('/api/quality/predict', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const analysis = await predictiveQualityService.analyzeProject(directory);
    return res.json(analysis);
  } catch (error) {
    console.error('Quality prediction error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze quality',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze code content for quality predictions
 */
app.post('/api/quality/predict-content', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { code, filename } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code content is required' });
    }

    const predictions = predictiveQualityService.analyzeContent(code, filename || 'unknown');
    return res.json({ predictions, filename: filename || 'unknown' });
  } catch (error) {
    console.error('Quality prediction error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze code quality',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// GIT HISTORY / TEMPORAL INTELLIGENCE
// ===========================================

/**
 * Analyze git history for a file
 */
app.post('/api/temporal/analyze', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory, file } = req.body;
    
    if (!directory || !file) {
      return res.status(400).json({ error: 'Directory and file path are required' });
    }

    const analysis = await gitHistoryService.analyzeFile(directory, file);
    return res.json(analysis);
  } catch (error) {
    console.error('Temporal analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze file history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get tracked files in a project
 */
app.post('/api/temporal/files', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const files = await gitHistoryService.getTrackedFiles(directory);
    return res.json({ files, count: files.length });
  } catch (error) {
    console.error('Get files error:', error);
    return res.status(500).json({ 
      error: 'Failed to get tracked files',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// REAL-TIME QUALITY GUARDIAN
// ===========================================

/**
 * Analyze code in real-time
 */
app.post('/api/realtime/analyze', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { code, filename } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code content is required' });
    }

    const analysis = realTimeQualityService.analyzeCode(code, filename || 'unknown');
    return res.json(analysis);
  } catch (error) {
    console.error('Real-time analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze code',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get quality score for code
 */
app.post('/api/realtime/score', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code content is required' });
    }

    const score = realTimeQualityService.getQualityScore(code);
    return res.json({ score });
  } catch (error) {
    console.error('Quality score error:', error);
    return res.status(500).json({ 
      error: 'Failed to calculate quality score',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Auto-fix code issues
 */
app.post('/api/realtime/autofix', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code content is required' });
    }

    const result = realTimeQualityService.applyAutoFixes(code);
    metricsService.recordFix(true, result.fixCount);
    return res.json(result);
  } catch (error) {
    console.error('Auto-fix error:', error);
    return res.status(500).json({ 
      error: 'Failed to apply auto-fixes',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// PRODUCTION PREDICTOR
// ===========================================

/**
 * Analyze project for production readiness
 */
app.post('/api/production/analyze', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const analysis = await productionPredictorService.analyzeProject(directory);
    metricsService.recordScan('Production', analysis.anomalies.length);
    return res.json(analysis);
  } catch (error) {
    console.error('Production analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze production readiness',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze code content for production issues
 */
app.post('/api/production/analyze-content', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { code, filename } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code content is required' });
    }

    const anomalies = productionPredictorService.analyzeContent(code, filename || 'unknown');
    return res.json({ anomalies, filename: filename || 'unknown' });
  } catch (error) {
    console.error('Production analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze code',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// METRICS
// ===========================================

/**
 * Get metrics for a time range
 */
app.get('/api/metrics', standardRateLimit, (req: Request, res: Response) => {
  try {
    const timeRange = (req.query.range as '7d' | '30d' | '90d') || '7d';
    const metrics = metricsService.getMetrics(timeRange);
    return res.json(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    return res.status(500).json({ 
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get project statistics
 */
app.post('/api/metrics/project', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const stats = await metricsService.getProjectStats(directory);
    return res.json(stats);
  } catch (error) {
    console.error('Project stats error:', error);
    return res.status(500).json({ 
      error: 'Failed to get project statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// AUTHENTICATION
// ===========================================

/**
 * Register a new user
 */
app.post('/api/auth/register', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const result = await authService.register(email, password, name);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({ 
      error: 'Registration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Login
 * Uses dual-track rate limiting (account + IP) with escalating cooldowns
 */
app.post('/api/auth/login', authRateLimitMiddleware(), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.login(email, password);
    recordAuthSuccess(req);
    return res.json(result);
  } catch (error) {
    recordAuthFailure(req);
    console.error('Login error:', error);
    // Safe error message - don't reveal if account exists
    return res.status(401).json({ 
      error: 'Invalid credentials',
      message: 'The email or password you entered is incorrect'
    });
  }
});

/**
 * Get current user profile
 */
app.get('/api/auth/me', standardRateLimit, authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.json({ user: req.user });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * Logout
 */
app.post('/api/auth/logout', standardRateLimit, authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await authService.logout(token);
    }
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Failed to logout' });
  }
});

// ===========================================
// USER PROJECTS
// ===========================================

/**
 * Create a new project
 */
app.post('/api/projects', standardRateLimit, authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name, description, path, repositoryUrl } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await databaseService.createProject({
      userId: req.user.id,
      name,
      description,
      path,
      repositoryUrl,
    });
    
    return res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ 
      error: 'Failed to create project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get user's projects
 */
app.get('/api/projects', standardRateLimit, authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const projects = await databaseService.getUserProjects(req.user.id);
    return res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({ 
      error: 'Failed to get projects',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get a specific project
 */
app.get('/api/projects/:id', standardRateLimit, authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const project = await databaseService.getProject(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    return res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({ 
      error: 'Failed to get project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update a project
 */
app.put('/api/projects/:id', standardRateLimit, authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name, description, path, repositoryUrl } = req.body;
    
    const project = await databaseService.updateProject(req.params.id, req.user.id, {
      name,
      description,
      path,
      repositoryUrl,
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    return res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({ 
      error: 'Failed to update project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a project
 */
app.delete('/api/projects/:id', standardRateLimit, authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await databaseService.deleteProject(req.params.id, req.user.id);
    return res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ 
      error: 'Failed to delete project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// USAGE TRACKING
// ===========================================

/**
 * Track usage
 */
app.post('/api/usage/track', standardRateLimit, authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { type, projectId, metadata } = req.body;
    
    if (!type) {
      return res.status(400).json({ error: 'Usage type is required' });
    }

    await databaseService.trackUsage({
      userId: req.user.id,
      type,
      projectId,
      metadata,
    });
    
    return res.json({ message: 'Usage tracked successfully' });
  } catch (error) {
    console.error('Usage tracking error:', error);
    return res.status(500).json({ 
      error: 'Failed to track usage',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get usage statistics
 */
app.get('/api/usage/stats', standardRateLimit, authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const stats = await databaseService.getUsageStats(req.user.id);
    return res.json(stats);
  } catch (error) {
    console.error('Usage stats error:', error);
    return res.status(500).json({ 
      error: 'Failed to get usage stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// LIVE COLLABORATION (WebSocket)
// ===========================================

import { webSocketService } from './services/websocket-service';

/**
 * Get active collaboration rooms
 */
app.get('/api/collaboration/rooms', standardRateLimit, (_req: Request, res: Response) => {
  try {
    const rooms = webSocketService.getActiveRooms();
    return res.json({ rooms, count: rooms.length });
  } catch (error) {
    console.error('Get rooms error:', error);
    return res.status(500).json({
      error: 'Failed to get rooms',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get room details
 */
app.get('/api/collaboration/rooms/:roomId', standardRateLimit, (req: Request, res: Response) => {
  try {
    const room = webSocketService.getRoomInfo(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    return res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    return res.status(500).json({
      error: 'Failed to get room',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create a collaboration room
 */
app.post('/api/collaboration/rooms', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { roomId, name } = req.body;
    if (!roomId || !name) {
      return res.status(400).json({ error: 'Room ID and name are required' });
    }
    const room = webSocketService.createRoom(roomId, name);
    return res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({
      error: 'Failed to create room',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a collaboration room
 */
app.delete('/api/collaboration/rooms/:roomId', standardRateLimit, (req: Request, res: Response) => {
  try {
    const deleted = webSocketService.deleteRoom(req.params.roomId);
    if (!deleted) {
      return res.status(404).json({ error: 'Room not found' });
    }
    return res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    return res.status(500).json({
      error: 'Failed to delete room',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get WebSocket statistics
 */
app.get('/api/collaboration/stats', standardRateLimit, (_req: Request, res: Response) => {
  try {
    const stats = webSocketService.getStats();
    return res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// CROSS-REPO INTELLIGENCE (GitHub API)
// ===========================================

import { githubAPIService } from './services/github-api-service';

// Initialize GitHub API service
githubAPIService.initialize();

/**
 * Get repository information
 */
app.get('/api/github/repo/:owner/:repo', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const repository = await githubAPIService.getRepository(owner, repo);
    return res.json(repository);
  } catch (error) {
    console.error('Get repo error:', error);
    return res.status(500).json({
      error: 'Failed to get repository',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get user repositories
 */
app.get('/api/github/user/:username/repos', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const limit = parseInt(req.query.limit as string) || 30;
    const repos = await githubAPIService.getUserRepositories(username, { limit });
    return res.json({ repositories: repos, count: repos.length });
  } catch (error) {
    console.error('Get user repos error:', error);
    return res.status(500).json({
      error: 'Failed to get user repositories',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze a repository
 */
app.post('/api/github/analyze', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.body;
    if (!owner || !repo) {
      return res.status(400).json({ error: 'Owner and repo are required' });
    }
    const analysis = await githubAPIService.analyzeRepository(owner, repo);
    return res.json(analysis);
  } catch (error) {
    console.error('Analyze repo error:', error);
    return res.status(500).json({
      error: 'Failed to analyze repository',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Analyze multiple repositories for cross-repo intelligence
 */
app.post('/api/github/analyze-multiple', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { repositories } = req.body;
    if (!repositories || !Array.isArray(repositories)) {
      return res.status(400).json({ error: 'Repositories array is required' });
    }
    const analysis = await githubAPIService.analyzeMultipleRepositories(repositories);
    return res.json(analysis);
  } catch (error) {
    console.error('Analyze multiple repos error:', error);
    return res.status(500).json({
      error: 'Failed to analyze repositories',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Search code across repositories
 */
app.post('/api/github/search', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { query, language, user, org } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const results = await githubAPIService.searchCode(query, { language, user, org });
    return res.json({ results, count: results.length });
  } catch (error) {
    console.error('Search code error:', error);
    return res.status(500).json({
      error: 'Failed to search code',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get GitHub API rate limit status
 */
app.get('/api/github/rate-limit', standardRateLimit, async (_req: Request, res: Response) => {
  try {
    const rateLimit = await githubAPIService.getRateLimit();
    return res.json(rateLimit);
  } catch (error) {
    console.error('Rate limit error:', error);
    return res.status(500).json({
      error: 'Failed to get rate limit',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// DESIGN SYSTEM BUILDER (AST Parsing)
// ===========================================

import { astParsingService } from './services/ast-parsing-service';

/**
 * Analyze design system from a directory
 */
app.post('/api/design-system/analyze', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory } = req.body;
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }
    const analysis = await astParsingService.analyzeDirectory(directory);
    return res.json(analysis);
  } catch (error) {
    console.error('Design system analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze design system',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Extract components from code content
 */
app.post('/api/design-system/extract-components', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { code, filename } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code content is required' });
    }
    const sourceFile = astParsingService.parseContent(code, filename || 'temp.tsx');
    const components = astParsingService.extractComponents(sourceFile);
    return res.json({ components, count: components.length });
  } catch (error) {
    console.error('Extract components error:', error);
    return res.status(500).json({
      error: 'Failed to extract components',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Extract design tokens from code content
 */
app.post('/api/design-system/extract-tokens', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { code, filename } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code content is required' });
    }
    const tokens = astParsingService.extractDesignTokens(code, filename || 'temp.tsx');
    return res.json(tokens);
  } catch (error) {
    console.error('Extract tokens error:', error);
    return res.status(500).json({
      error: 'Failed to extract tokens',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate design tokens file
 */
app.post('/api/design-system/generate-tokens', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { directory, format } = req.body;
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }
    const analysis = await astParsingService.analyzeDirectory(directory);
    const tokensFile = astParsingService.generateTokensFile(analysis, format || 'css');
    return res.json({ tokens: tokensFile, format: format || 'css' });
  } catch (error) {
    console.error('Generate tokens error:', error);
    return res.status(500).json({
      error: 'Failed to generate tokens',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===========================================
// CODE EVOLUTION (Historical Data)
// ===========================================

import { codeEvolutionService } from './services/code-evolution-service';

/**
 * Create a code snapshot
 */
app.post('/api/evolution/snapshot', standardRateLimit, async (req: Request, res: Response) => {
  try {
    const { projectId, directory, metadata } = req.body;
    if (!projectId || !directory) {
      return res.status(400).json({ error: 'Project ID and directory are required' });
    }
    const snapshot = await codeEvolutionService.createSnapshot(projectId, directory, metadata);
    return res.status(201).json(snapshot);
  } catch (error) {
    console.error('Create snapshot error:', error);
    return res.status(500).json({
      error: 'Failed to create snapshot',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get snapshots for a project
 */
app.get('/api/evolution/:projectId/snapshots', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit as string) || undefined;
    const since = req.query.since as string | undefined;
    const until = req.query.until as string | undefined;
    
    const snapshots = codeEvolutionService.getSnapshots(projectId, { limit, since, until });
    return res.json({ snapshots, count: snapshots.length });
  } catch (error) {
    console.error('Get snapshots error:', error);
    return res.status(500).json({
      error: 'Failed to get snapshots',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get latest snapshot for a project
 */
app.get('/api/evolution/:projectId/latest', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const snapshot = codeEvolutionService.getLatestSnapshot(projectId);
    if (!snapshot) {
      return res.status(404).json({ error: 'No snapshots found for this project' });
    }
    return res.json(snapshot);
  } catch (error) {
    console.error('Get latest snapshot error:', error);
    return res.status(500).json({
      error: 'Failed to get latest snapshot',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get trends for a project
 */
app.get('/api/evolution/:projectId/trends', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const trends = codeEvolutionService.getTrends(projectId);
    return res.json({ trends, count: trends.length });
  } catch (error) {
    console.error('Get trends error:', error);
    return res.status(500).json({
      error: 'Failed to get trends',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get full project evolution
 */
app.get('/api/evolution/:projectId', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const projectName = req.query.name as string | undefined;
    const evolution = codeEvolutionService.getProjectEvolution(projectId, projectName);
    if (!evolution) {
      return res.status(404).json({ error: 'No evolution data found for this project' });
    }
    return res.json(evolution);
  } catch (error) {
    console.error('Get evolution error:', error);
    return res.status(500).json({
      error: 'Failed to get evolution',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Compare two snapshots
 */
app.post('/api/evolution/compare', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { projectId, snapshotId1, snapshotId2 } = req.body;
    if (!projectId || !snapshotId1 || !snapshotId2) {
      return res.status(400).json({ error: 'Project ID and two snapshot IDs are required' });
    }
    const comparison = codeEvolutionService.compareSnapshots(projectId, snapshotId1, snapshotId2);
    if (!comparison) {
      return res.status(404).json({ error: 'One or both snapshots not found' });
    }
    return res.json(comparison);
  } catch (error) {
    console.error('Compare snapshots error:', error);
    return res.status(500).json({
      error: 'Failed to compare snapshots',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all tracked projects
 */
app.get('/api/evolution', standardRateLimit, (_req: Request, res: Response) => {
  try {
    const projects = codeEvolutionService.getTrackedProjects();
    return res.json({ projects, count: projects.length });
  } catch (error) {
    console.error('Get tracked projects error:', error);
    return res.status(500).json({
      error: 'Failed to get tracked projects',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete project evolution data
 */
app.delete('/api/evolution/:projectId', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const deleted = codeEvolutionService.deleteProjectData(projectId);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.json({ message: 'Project data deleted successfully' });
  } catch (error) {
    console.error('Delete project data error:', error);
    return res.status(500).json({
      error: 'Failed to delete project data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Export project data
 */
app.get('/api/evolution/:projectId/export', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const data = codeEvolutionService.exportProjectData(projectId);
    if (!data) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${projectId}-evolution.json"`);
    return res.send(data);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({
      error: 'Failed to export data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Import project data
 */
app.post('/api/evolution/import', standardRateLimit, (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }
    const imported = codeEvolutionService.importProjectData(
      typeof data === 'string' ? data : JSON.stringify(data)
    );
    if (!imported) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    return res.json({ message: 'Data imported successfully' });
  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({
      error: 'Failed to import data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server with WebSocket support
export function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`🚀 guardrail API Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
  });

  // Initialize WebSocket service
  webSocketService.initialize(server);

  return server;
}

export { app };

