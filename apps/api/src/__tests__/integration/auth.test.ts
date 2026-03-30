import request from "supertest";
import { buildServer } from "../../index";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

describe("Auth Integration Tests", () => {
  let app: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    prisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env["TEST_DATABASE_URL"] ||
            "postgresql://postgres:postgres@localhost:5432/Guardrail_test",
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database
    await prisma.user.deleteMany();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      };

      const response = await request(app.server)
        .post("/api/auth/register")
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        user: {
          email: userData.email,
          name: userData.name,
        },
      });
      expect(response.body.user).not.toHaveProperty("password");
      expect(response.body.tokens).toHaveProperty("accessToken");
      expect(response.body.tokens).toHaveProperty("refreshToken");
    });

    it("should hash password before saving", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      };

      await request(app.server).post("/api/auth/register").send(userData);

      const user = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      expect(user).toBeTruthy();
      expect(user!.password).not.toBe(userData.password);
      expect(
        await bcrypt.compare(userData.password, user!.password || ""),
      ).toBe(true);
    });

    it("should reject invalid email", async () => {
      const response = await request(app.server)
        .post("/api/auth/register")
        .send({
          email: "invalid-email",
          password: "password123",
          name: "Test User",
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining("email"),
      });
    });

    it("should reject weak password", async () => {
      const response = await request(app.server)
        .post("/api/auth/register")
        .send({
          email: "test@example.com",
          password: "123",
          name: "Test User",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("password");
    });

    it("should reject duplicate email", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      };

      // First registration
      await request(app.server).post("/api/auth/register").send(userData);

      // Second registration with same email
      const response = await request(app.server)
        .post("/api/auth/register")
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain("already exists");
    });

    it("should require email", async () => {
      const response = await request(app.server)
        .post("/api/auth/register")
        .send({
          password: "password123",
          name: "Test User",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("email");
    });

    it("should require password", async () => {
      const response = await request(app.server)
        .post("/api/auth/register")
        .send({
          email: "test@example.com",
          name: "Test User",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("password");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a test user
      const passwordHash = await bcrypt.hash("password123", 12);
      await prisma.user.create({
        data: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
          password: passwordHash,
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    it("should login with valid credentials", async () => {
      const response = await request(app.server).post("/api/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        user: {
          email: "test@example.com",
          name: "Test User",
        },
      });
      expect(response.body.tokens).toHaveProperty("accessToken");
      expect(response.body.tokens).toHaveProperty("refreshToken");
    });

    it("should reject invalid email", async () => {
      const response = await request(app.server).post("/api/auth/login").send({
        email: "wrong@example.com",
        password: "password123",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("credentials");
    });

    it("should reject invalid password", async () => {
      const response = await request(app.server).post("/api/auth/login").send({
        email: "test@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("credentials");
    });

    it("should reject unverified email", async () => {
      // Create unverified user
      const passwordHash = await bcrypt.hash("password123", 12);
      await prisma.user.create({
        data: {
          id: "unverified-user",
          email: "unverified@example.com",
          name: "Unverified User",
          password: passwordHash,
          emailVerified: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const response = await request(app.server).post("/api/auth/login").send({
        email: "unverified@example.com",
        password: "password123",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("verified");
    });
  });

  describe("POST /api/auth/refresh", () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create and login user to get refresh token
      const passwordHash = await bcrypt.hash("password123", 12);
      await prisma.user.create({
        data: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
          password: passwordHash,
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const loginResponse = await request(app.server)
        .post("/api/auth/login")
        .send({
          email: "test@example.com",
          password: "password123",
        });

      refreshToken = loginResponse.body.tokens.refreshToken;
    });

    it("should refresh tokens with valid refresh token", async () => {
      const response = await request(app.server)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.tokens).toHaveProperty("accessToken");
      expect(response.body.tokens).toHaveProperty("refreshToken");
      expect(response.body.tokens.accessToken).not.toBe(refreshToken);
    });

    it("should reject invalid refresh token", async () => {
      const response = await request(app.server)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("token");
    });

    it("should require refresh token", async () => {
      const response = await request(app.server)
        .post("/api/auth/refresh")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("refreshToken");
    });
  });

  describe("Protected Routes", () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create and login user
      const passwordHash = await bcrypt.hash("password123", 12);
      await prisma.user.create({
        data: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
          password: passwordHash,
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const loginResponse = await request(app.server)
        .post("/api/auth/login")
        .send({
          email: "test@example.com",
          password: "password123",
        });

      accessToken = loginResponse.body.tokens.accessToken;
    });

    it("should allow access with valid token", async () => {
      const response = await request(app.server)
        .get("/api/projects")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });

    it("should reject access without token", async () => {
      const response = await request(app.server).get("/api/projects");

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("token");
    });

    it("should reject access with invalid token", async () => {
      const response = await request(app.server)
        .get("/api/projects")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("token");
    });

    it("should reject expired token", async () => {
      // Create token that's already expired
      const jwt = require("jsonwebtoken");
      const expiredToken = jwt.sign(
        { userId: "test-user-id", type: "access" },
        process.env["JWT_SECRET"] || "test-secret",
        { expiresIn: "-1s" },
      );

      const response = await request(app.server)
        .get("/api/projects")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("expired");
    });
  });
});
