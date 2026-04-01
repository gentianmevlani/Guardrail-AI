/**
 * Compliance Service Tests
 * 
 * Unit tests for GDPR, consent management, and legal acceptance functionality.
 */

import {
    acceptLegalDocument,
    assembleExportData,
    checkAgeConfirmation,
    confirmAge,
    createDeletionJob,
    createExportJob,
    deleteUserData,
    getConsentPreferences,
    getDeletionJobStatus,
    getExportJobStatus,
    getLegalAcceptanceStatus,
    hashIp,
    logGdprAction,
    updateConsentPreferences
} from '../compliance-service';

// Mock dependencies
jest.mock('../../db', () => ({
  prisma: {
    consentPreferences: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    legalAcceptance: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    gdprJob: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    gdprAuditLog: {
      create: jest.fn(),
    },
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    project: {
      deleteMany: jest.fn(),
    },
    usageRecord: {
      deleteMany: jest.fn(),
    },
    apiKey: {
      deleteMany: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    licenseKey: {
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Compliance Service', () => {
  const mockUserId = 'user-123';
  const mockIp = '192.168.1.1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('IP Hashing', () => {
    it('should hash IP address consistently', () => {
      const hash1 = hashIp(mockIp);
      const hash2 = hashIp(mockIp);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });

    it('should produce different hashes for different IPs', () => {
      const hash1 = hashIp(mockIp);
      const hash2 = hashIp('192.168.1.2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Consent Preferences', () => {
    it('should get consent preferences', async () => {
      const mockPreferences = {
        necessary: true,
        analytics: false,
        marketing: false,
        functional: false,
      };

      const { prisma } = require('../../db');
      prisma.consentPreferences.findUnique.mockResolvedValue(mockPreferences);

      const result = await getConsentPreferences(mockUserId);

      expect(prisma.consentPreferences.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(result).toEqual(mockPreferences);
    });

    it('should return null when no preferences exist', async () => {
      const { prisma } = require('../../db');
      prisma.consentPreferences.findUnique.mockResolvedValue(null);

      const result = await getConsentPreferences(mockUserId);

      expect(result).toBeNull();
    });

    it('should update consent preferences', async () => {
      const preferences = {
        necessary: true,
        analytics: true,
        marketing: false,
        functional: true,
      };

      const mockUpdated = {
        ...preferences,
        userId: mockUserId,
        updatedAt: new Date(),
      };

      const { prisma } = require('../../db');
      prisma.consentPreferences.upsert.mockResolvedValue(mockUpdated);

      const result = await updateConsentPreferences(mockUserId, preferences, mockIp);

      expect(prisma.consentPreferences.upsert).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        update: {
          ...preferences,
          ipHash: hashIp(mockIp),
          updatedAt: expect.any(Date),
        },
        create: {
          userId: mockUserId,
          ...preferences,
          ipHash: hashIp(mockIp),
        },
      });
      expect(result).toEqual({
        necessary: true,
        analytics: true,
        marketing: false,
        functional: true,
      });
    });
  });

  describe('Legal Acceptance', () => {
    it('should get legal acceptance status', async () => {
      const mockAcceptances = [
        {
          docType: 'terms',
          version: '1.0',
          acceptedAt: new Date('2024-01-01'),
        },
        {
          docType: 'privacy',
          version: '1.0',
          acceptedAt: new Date('2024-01-01'),
        },
      ];

      const { prisma } = require('../../db');
      prisma.legalAcceptance.findMany.mockResolvedValue(mockAcceptances);

      const result = await getLegalAcceptanceStatus(mockUserId);

      expect(prisma.legalAcceptance.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { acceptedAt: 'desc' },
      });
      expect(result).toMatchObject({
        terms: {
          accepted: true,
          version: '1.0',
          needsUpdate: false,
        },
        privacy: {
          accepted: true,
          version: '1.0',
          needsUpdate: false,
        },
      });
    });

    it('should record legal document acceptance', async () => {
      const input = {
        docType: 'terms' as const,
        version: '1.0',
        locale: 'en',
      };

      const mockAcceptance = {
        id: 'acceptance-123',
        userId: mockUserId,
        ...input,
        acceptedAt: new Date(),
      };

      const { prisma } = require('../../db');
      prisma.legalAcceptance.upsert.mockResolvedValue(mockAcceptance);

      const result = await acceptLegalDocument(mockUserId, input, mockIp);

      expect(prisma.legalAcceptance.upsert).toHaveBeenCalledWith({
        where: {
          userId_docType: {
            userId: mockUserId,
            docType: 'terms',
          },
        },
        update: {
          version: '1.0',
          acceptedAt: expect.any(Date),
          ipHash: hashIp(mockIp),
          userAgent: undefined,
          locale: 'en',
        },
        create: {
          userId: mockUserId,
          docType: 'terms',
          version: '1.0',
          ipHash: hashIp(mockIp),
          userAgent: undefined,
          locale: 'en',
        },
      });
      expect(result).toEqual(mockAcceptance);
    });
  });

  describe('GDPR Export', () => {
    it('should create export job', async () => {
      const mockJob = {
        id: 'job-123',
        userId: mockUserId,
        type: 'EXPORT',
        status: 'pending',
        createdAt: new Date(),
      };

      const { prisma } = require('../../db');
      prisma.gdprJob.findFirst.mockResolvedValue(null);
      prisma.gdprJob.create.mockResolvedValue(mockJob);

      const result = await createExportJob(mockUserId);

      expect(prisma.gdprJob.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          type: 'EXPORT',
          status: { in: ['pending', 'processing'] },
        },
      });
      expect(prisma.gdprJob.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          type: 'EXPORT',
          status: 'pending',
        },
      });
      expect(result).toBe('job-123');
    });

    it('should throw error if export job already exists', async () => {
      const { prisma } = require('../../db');
      prisma.gdprJob.findFirst.mockResolvedValue({ id: 'existing-job' });

      await expect(createExportJob(mockUserId)).rejects.toThrow('Export job already in progress');
    });

    it('should get export job status', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
        artifactPath: '/exports/data.json',
      };

      const { prisma } = require('../../db');
      prisma.gdprJob.findFirst.mockResolvedValue(mockJob);

      const result = await getExportJobStatus(mockUserId, 'job-123');

      expect(prisma.gdprJob.findFirst).toHaveBeenCalledWith({
        where: { id: 'job-123', userId: mockUserId },
      });
      expect(result).toMatchObject({
        id: 'job-123',
        status: 'completed',
        downloadUrl: '/api/v1/gdpr/export/job-123/download',
      });
    });
  });

  describe('GDPR Deletion', () => {
    it('should create deletion job', async () => {
      const mockJob = {
        id: 'job-456',
        userId: mockUserId,
        type: 'DELETE',
        status: 'pending',
        createdAt: new Date(),
      };

      const { prisma } = require('../../db');
      prisma.gdprJob.findFirst.mockResolvedValue(null);
      prisma.gdprJob.create.mockResolvedValue(mockJob);

      const result = await createDeletionJob(mockUserId);

      expect(prisma.gdprJob.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          type: 'DELETE',
          status: 'pending',
        },
      });
      expect(result).toBe('job-456');
    });

    it('should get deletion job status', async () => {
      const mockJob = {
        id: 'job-456',
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
      };

      const { prisma } = require('../../db');
      prisma.gdprJob.findFirst.mockResolvedValue(mockJob);

      const result = await getDeletionJobStatus(mockUserId, 'job-456');

      expect(result).toMatchObject({
        id: 'job-456',
        status: 'completed',
      });
    });
  });

  describe('Age Verification', () => {
    it('should confirm age when user is old enough', async () => {
      const { prisma } = require('../../db');
      prisma.user.update.mockResolvedValue({});

      await confirmAge(mockUserId, 18);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          isAgeConfirmed: true,
          ageConfirmedAt: expect.any(Date),
        },
      });
    });

    it('should throw error when user is too young', async () => {
      await expect(confirmAge(mockUserId, 14)).rejects.toThrow(
        'Age verification failed: User must be at least 16 years old'
      );
    });

    it('should check age confirmation status', async () => {
      const { prisma } = require('../../db');
      prisma.user.findUnique.mockResolvedValue({ isAgeConfirmed: true });

      const result = await checkAgeConfirmation(mockUserId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        select: { isAgeConfirmed: true },
      });
      expect(result).toBe(true);
    });

    it('should return false when user not found', async () => {
      const { prisma } = require('../../db');
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await checkAgeConfirmation(mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should log GDPR action', async () => {
      const { prisma } = require('../../db');
      prisma.gdprAuditLog.create.mockResolvedValue({});

      await logGdprAction(mockUserId, 'data_exported', { jobId: 'job-123' });

      expect(prisma.gdprAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          action: 'data_exported',
          metadata: { jobId: 'job-123' },
          actorUserId: undefined,
        },
      });
    });

    it('should log GDPR action with actor', async () => {
      const { prisma } = require('../../db');
      prisma.gdprAuditLog.create.mockResolvedValue({});

      await logGdprAction(mockUserId, 'account_deleted', {}, 'admin-123');

      expect(prisma.gdprAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          action: 'account_deleted',
          metadata: {},
          actorUserId: 'admin-123',
        },
      });
    });
  });

  describe('Data Export Assembly', () => {
    it('should assemble export data', async () => {
      const mockData = {
        user: { id: mockUserId, email: 'test@example.com' },
        projects: [],
        usageRecords: [],
        subscriptions: [],
        apiKeys: [],
        auditLogs: [],
        consentPreferences: null,
        legalAcceptances: [],
      };

      const { prisma } = require('../../db');
      prisma.user.findUnique.mockResolvedValue(mockData.user);
      prisma.project.findMany.mockResolvedValue(mockData.projects);
      prisma.usageRecord.findMany.mockResolvedValue(mockData.usageRecords);
      prisma.subscription.findMany.mockResolvedValue(mockData.subscriptions);
      prisma.apiKey.findMany.mockResolvedValue(mockData.apiKeys);
      prisma.gdprAuditLog.findMany.mockResolvedValue(mockData.auditLogs);
      prisma.consentPreferences.findUnique.mockResolvedValue(mockData.consentPreferences);
      prisma.legalAcceptance.findMany.mockResolvedValue(mockData.legalAcceptances);

      const result = await assembleExportData(mockUserId);

      expect(result).toEqual(mockData);
    });
  });

  describe('Data Deletion', () => {
    it('should delete user data', async () => {
      const { prisma } = require('../../db');
      
      // Mock all delete operations
      prisma.project.deleteMany.mockResolvedValue({ count: 1 });
      prisma.usageRecord.deleteMany.mockResolvedValue({ count: 1 });
      prisma.apiKey.deleteMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      prisma.licenseKey.deleteMany.mockResolvedValue({ count: 1 });
      prisma.consentPreferences.delete.mockResolvedValue({});
      prisma.legalAcceptance.deleteMany.mockResolvedValue({ count: 1 });
      prisma.gdprJob.deleteMany.mockResolvedValue({ count: 1 });
      prisma.gdprAuditLog.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.delete.mockResolvedValue({});

      await deleteUserData(mockUserId);

      // Verify all deletion operations were called
      expect(prisma.project.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(prisma.usageRecord.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(prisma.licenseKey.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(prisma.consentPreferences.delete).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(prisma.legalAcceptance.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(prisma.gdprJob.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(prisma.gdprAuditLog.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: mockUserId } });
    });
  });
});
