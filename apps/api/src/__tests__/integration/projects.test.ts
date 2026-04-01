import request from 'supertest';
import { buildServer } from '../../index';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Projects Integration Tests', () => {
  let app: any;
  let prisma: PrismaClient;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env['TEST_DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/Guardrail_test'
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // Create test user and get auth token
    const passwordHash = await bcrypt.hash('password123', 12);
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: 'test@example.com',
        name: 'Test User',
        password: passwordHash,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    userId = user.id;
    authToken = jwt.sign(
      { userId: user.id, type: 'access' },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project',
        repositoryUrl: 'https://github.com/test/project'
      };

      const response = await request(app.server)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        project: {
          name: projectData.name,
          description: projectData.description,
          repositoryUrl: projectData.repositoryUrl,
          userId: userId
        }
      });
    });

    it('should require authentication', async () => {
      const response = await request(app.server)
        .post('/api/projects')
        .send({
          name: 'Test Project'
        });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app.server)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should validate repository URL format', async () => {
      const response = await request(app.server)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          repositoryUrl: 'not-a-url'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('repositoryUrl');
    });

    it('should create project with default settings', async () => {
      const response = await request(app.server)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          repositoryUrl: 'https://github.com/test/project'
        });

      expect(response.status).toBe(201);
      expect(response.body.project.settings).toMatchObject({
        scanOnPush: true,
        notifyOnFindings: true,
        autoFix: false
      });
    });
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      // Create test projects
      await prisma.project.createMany({
        data: [
          {
            id: 'project-1',
            name: 'Project 1',
            description: 'First project',
            repositoryUrl: 'https://github.com/test/project1',
            userId,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'project-2',
            name: 'Project 2',
            description: 'Second project',
            repositoryUrl: 'https://github.com/test/project2',
            userId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      });
    });

    it('should list user projects', async () => {
      const response = await request(app.server)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.projects).toHaveLength(2);
      expect(response.body.projects[0]).toMatchObject({
        name: 'Project 1',
        userId: userId
      });
    });

    it('should require authentication', async () => {
      const response = await request(app.server)
        .get('/api/projects');

      expect(response.status).toBe(401);
    });

    it('should support pagination', async () => {
      const response = await request(app.server)
        .get('/api/projects?limit=1&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.projects).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({
        limit: 1,
        offset: 0,
        total: 2
      });
    });
  });

  describe('GET /api/projects/:id', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          id: 'test-project',
          name: 'Test Project',
          description: 'A test project',
          repositoryUrl: 'https://github.com/test/project',
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      projectId = project.id;
    });

    it('should get project by ID', async () => {
      const response = await request(app.server)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.project).toMatchObject({
        id: projectId,
        name: 'Test Project',
        userId: userId
      });
    });

    it('should require authentication', async () => {
      const response = await request(app.server)
        .get(`/api/projects/${projectId}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app.server)
        .get('/api/projects/non-existent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should prevent access to other users projects', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          id: 'other-user',
          email: 'other@example.com',
          name: 'Other User',
          password: await bcrypt.hash('password123', 12),
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      const otherToken = jwt.sign(
        { userId: otherUser.id, type: 'access' },
        process.env['JWT_SECRET'] || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app.server)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('PUT /api/projects/:id', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          id: 'test-project',
          name: 'Test Project',
          description: 'A test project',
          repositoryUrl: 'https://github.com/test/project',
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      projectId = project.id;
    });

    it('should update project', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description'
      };

      const response = await request(app.server)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.project).toMatchObject({
        id: projectId,
        name: updateData.name,
        description: updateData.description
      });
    });

    it('should require authentication', async () => {
      const response = await request(app.server)
        .put(`/api/projects/${projectId}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(401);
    });

    it('should validate update data', async () => {
      const response = await request(app.server)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should not allow updating userId', async () => {
      const response = await request(app.server)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userId: 'other-user' });

      expect(response.status).toBe(200);
      expect(response.body.project.userId).toBe(userId);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          id: 'test-project',
          name: 'Test Project',
          description: 'A test project',
          repositoryUrl: 'https://github.com/test/project',
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      projectId = project.id;
    });

    it('should delete project', async () => {
      const response = await request(app.server)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Project deleted successfully'
      });

      // Verify project is deleted
      const deleted = await prisma.project.findUnique({
        where: { id: projectId }
      });
      expect(deleted).toBeNull();
    });

    it('should require authentication', async () => {
      const response = await request(app.server)
        .delete(`/api/projects/${projectId}`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app.server)
        .delete('/api/projects/non-existent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
