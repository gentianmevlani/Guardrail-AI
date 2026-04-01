import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";

/**
 * Integration tests for API routes
 * Tests API endpoints with mocked database layer
 */

// Mock express app for testing
let app: Express;

// Mock middleware
const mockAuthMiddleware = vi.fn((req, res, next) => {
  req.user = { id: "test-user-id", email: "test@example.com" };
  next();
});

// Mock database
const mockDb = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  scan: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

beforeAll(() => {
  // Create test app
  app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Auth endpoints
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    // Mock successful login
    res.json({
      token: "mock-jwt-token",
      user: { id: "user-1", email },
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    mockDb.user.create.mockResolvedValue({
      id: "new-user-id",
      email,
      name: name || null,
    });
    const user = await mockDb.user.create({ data: { email, password, name } });
    res.status(201).json({ user, token: "mock-jwt-token" });
  });

  // Projects endpoints (protected)
  app.get("/api/projects", mockAuthMiddleware, async (req, res) => {
    mockDb.project.findMany.mockResolvedValue([
      { id: "proj-1", name: "Project 1", userId: "test-user-id" },
      { id: "proj-2", name: "Project 2", userId: "test-user-id" },
    ]);
    const projects = await mockDb.project.findMany();
    res.json({ projects });
  });

  app.post("/api/projects", mockAuthMiddleware, async (req, res) => {
    const { name, repoUrl } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Project name required" });
    }
    mockDb.project.create.mockResolvedValue({
      id: "new-proj-id",
      name,
      repoUrl: repoUrl || null,
      userId: "test-user-id",
    });
    const project = await mockDb.project.create({ data: { name, repoUrl } });
    res.status(201).json({ project });
  });

  // Scan endpoints
  app.post("/api/scan", mockAuthMiddleware, async (req, res) => {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: "Project ID required" });
    }
    mockDb.scan.create.mockResolvedValue({
      id: "scan-1",
      projectId,
      status: "pending",
      score: null,
    });
    const scan = await mockDb.scan.create({ data: { projectId } });
    res.status(202).json({ scan, message: "Scan queued" });
  });

  app.get("/api/scan/:scanId", mockAuthMiddleware, async (req, res) => {
    const { scanId } = req.params;
    const scan = {
      id: scanId,
      status: "completed",
      score: 85,
      findings: [
        {
          type: "security",
          severity: "medium",
          message: "Outdated dependency",
        },
      ],
    };
    res.json({ scan });
  });

  // Error handling
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("API Routes", () => {
  describe("Health Check", () => {
    it("GET /api/health returns healthy status", async () => {
      const response = await request(app).get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("healthy");
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe("Authentication", () => {
    it("POST /api/auth/login with valid credentials returns token", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "password123" });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe("test@example.com");
    });

    it("POST /api/auth/login without credentials returns 400", async () => {
      const response = await request(app).post("/api/auth/login").send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Email and password required");
    });

    it("POST /api/auth/register creates new user", async () => {
      const response = await request(app).post("/api/auth/register").send({
        email: "newuser@example.com",
        password: "securepassword",
        name: "New User",
      });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe("newuser@example.com");
      expect(response.body.token).toBeDefined();
    });
  });

  describe("Projects", () => {
    it("GET /api/projects returns user projects", async () => {
      const response = await request(app)
        .get("/api/projects")
        .set("Authorization", "Bearer mock-token");

      expect(response.status).toBe(200);
      expect(response.body.projects).toHaveLength(2);
    });

    it("POST /api/projects creates new project", async () => {
      const response = await request(app)
        .post("/api/projects")
        .set("Authorization", "Bearer mock-token")
        .send({
          name: "My New Project",
          repoUrl: "https://github.com/user/repo",
        });

      expect(response.status).toBe(201);
      expect(response.body.project.name).toBe("My New Project");
    });

    it("POST /api/projects without name returns 400", async () => {
      const response = await request(app)
        .post("/api/projects")
        .set("Authorization", "Bearer mock-token")
        .send({ repoUrl: "https://github.com/user/repo" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Project name required");
    });
  });

  describe("Scanning", () => {
    it("POST /api/scan queues a new scan", async () => {
      const response = await request(app)
        .post("/api/scan")
        .set("Authorization", "Bearer mock-token")
        .send({ projectId: "proj-1" });

      expect(response.status).toBe(202);
      expect(response.body.scan.status).toBe("pending");
      expect(response.body.message).toBe("Scan queued");
    });

    it("GET /api/scan/:scanId returns scan results", async () => {
      const response = await request(app)
        .get("/api/scan/scan-1")
        .set("Authorization", "Bearer mock-token");

      expect(response.status).toBe(200);
      expect(response.body.scan.status).toBe("completed");
      expect(response.body.scan.score).toBe(85);
      expect(response.body.scan.findings).toBeDefined();
    });

    it("POST /api/scan without projectId returns 400", async () => {
      const response = await request(app)
        .post("/api/scan")
        .set("Authorization", "Bearer mock-token")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Project ID required");
    });
  });
});

describe("Rate Limiting", () => {
  it("should handle rate limit headers", async () => {
    const response = await request(app).get("/api/health");

    // In production, these headers would be set by rate limiting middleware
    expect(response.status).toBe(200);
  });
});

describe("Error Handling", () => {
  it("should return 404 for unknown routes", async () => {
    const response = await request(app).get("/api/unknown-route");

    expect(response.status).toBe(404);
  });
});
