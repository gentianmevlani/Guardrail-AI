/**
 * Integration Tests for Critical Transaction Workflows
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as transactions from '../../db/transactions';

// Mock Prisma with transaction support
const mockTransaction = vi.fn();
const mockTx = {
  user: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  subscription: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  billingEvent: {
    create: vi.fn(),
  },
  scan: {
    update: vi.fn(),
  },
  finding: {
    createMany: vi.fn(),
  },
  usageLog: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  usageRecord: {
    create: vi.fn(),
  },
  usageCounter: {
    upsert: vi.fn(),
  },
  licenseKey: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  licenseActivation: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  invoice: {
    create: vi.fn(),
  },
};

vi.mock('../../db', () => ({
  prisma: {
    $transaction: mockTransaction,
    ...mockTx,
  },
}));

describe('Transaction Workflows Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (callback) => {
      return await callback(mockTx);
    });
  });

  describe('createSubscriptionWithStripeCustomer', () => {
    it('should create subscription and update customer atomically', async () => {
      // Setup mocks
      mockTx.user.update.mockResolvedValue({ id: 'user-1', stripeCustomerId: 'cus_123' });
      mockTx.subscription.create.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        tier: 'pro',
        status: 'active',
        user: { id: 'user-1', email: 'user@example.com', name: 'Test User' },
      });
      mockTx.billingEvent.create.mockResolvedValue({ id: 'event-1' });

      const result = await transactions.createSubscriptionWithStripeCustomer(
        'user-1',
        'cus_123',
        {
          tier: 'pro',
          status: 'active',
          priceId: 'price_123',
          quantity: 1,
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
        }
      );

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalled();

      // Verify user was updated
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { stripeCustomerId: 'cus_123' },
      });

      // Verify subscription was created
      expect(mockTx.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          stripeCustomerId: 'cus_123',
          tier: 'pro',
          status: 'active',
          priceId: 'price_123',
          quantity: 1,
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
        },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      // Verify billing event was created
      expect(mockTx.billingEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          subscriptionId: 'sub-1',
          eventType: 'subscription.created',
          eventSource: 'system',
          newState: {
            subscriptionId: 'sub-1',
            tier: 'pro',
            status: 'active',
          },
        },
      });

      expect(result).toEqual({
        id: 'sub-1',
        userId: 'user-1',
        tier: 'pro',
        status: 'active',
        user: { id: 'user-1', email: 'user@example.com', name: 'Test User' },
      });
    });

    it('should handle transaction rollback on error', async () => {
      // Simulate error in subscription creation
      mockTx.subscription.create.mockRejectedValue(new Error('Database error'));

      await expect(
        transactions.createSubscriptionWithStripeCustomer('user-1', 'cus_123', {
          tier: 'pro',
          status: 'active',
          priceId: 'price_123',
          quantity: 1,
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
        })
      ).rejects.toThrow('Database error');

      // Verify transaction was attempted
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('completeScanWithFindings', () => {
    it('should complete scan and create findings atomically', async () => {
      // Setup mocks
      mockTx.scan.update.mockResolvedValue({
        id: 'scan-1',
        status: 'completed',
        verdict: 'pass',
        score: 85,
      });
      mockTx.finding.createMany.mockResolvedValue({ count: 2 });

      const findings = [
        {
          type: 'error',
          severity: 'critical',
          category: 'security',
          file: 'app.js',
          line: 10,
          title: 'Security Issue',
          message: 'Potential vulnerability',
          confidence: 0.9,
        },
        {
          type: 'warning',
          severity: 'warning',
          category: 'performance',
          file: 'utils.js',
          line: 20,
          title: 'Performance Issue',
          message: 'Inefficient code',
          confidence: 0.7,
        },
      ];

      const result = await transactions.completeScanWithFindings('scan-1', {
        verdict: 'pass',
        score: 85,
        filesScanned: 10,
        linesScanned: 100,
        issuesFound: 2,
        criticalCount: 1,
        warningCount: 1,
        infoCount: 0,
        durationMs: 5000,
        findings,
      });

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalled();

      // Verify scan was updated
      expect(mockTx.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-1' },
        data: {
          status: 'completed',
          progress: 100,
          verdict: 'pass',
          score: 85,
          filesScanned: 10,
          linesScanned: 100,
          issuesFound: 2,
          criticalCount: 1,
          warningCount: 1,
          infoCount: 0,
          completedAt: expect.any(Date),
          durationMs: 5000,
        },
      });

      // Verify findings were created
      expect(mockTx.finding.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            scanId: 'scan-1',
            type: 'error',
            severity: 'critical',
            file: 'app.js',
            line: 10,
          }),
          expect.objectContaining({
            scanId: 'scan-1',
            type: 'warning',
            severity: 'warning',
            file: 'utils.js',
            line: 20,
          }),
        ]),
        skipDuplicates: true,
      });

      expect(result).toEqual({
        id: 'scan-1',
        status: 'completed',
        verdict: 'pass',
        score: 85,
      });
    });
  });

  describe('trackUsageWithEnforcement', () => {
    it('should track usage and update counters atomically', async () => {
      // Setup mocks
      mockTx.usageLog.findUnique.mockResolvedValue({ count: 5 });
      mockTx.usageLog.upsert.mockResolvedValue({
        userId: 'user-1',
        type: 'scan',
        count: 6,
      });
      mockTx.usageRecord.create.mockResolvedValue({ id: 'record-1' });
      mockTx.usageCounter.upsert.mockResolvedValue({ id: 'counter-1' });

      const result = await transactions.trackUsageWithEnforcement(
        'user-1',
        'scan',
        1,
        'project-1',
        { source: 'api' }
      );

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalled();

      // Verify usage log was checked
      expect(mockTx.usageLog.findUnique).toHaveBeenCalledWith({
        where: {
          userId_type_periodStart: {
            userId: 'user-1',
            type: 'scan',
            periodStart: expect.any(Date),
          },
        },
        select: { count: true },
      });

      // Verify usage log was updated
      expect(mockTx.usageLog.upsert).toHaveBeenCalledWith({
        where: {
          userId_type_periodStart: {
            userId: 'user-1',
            type: 'scan',
            periodStart: expect.any(Date),
          },
        },
        update: {
          count: 6,
          metadata: { source: 'api' },
        },
        create: {
          userId: 'user-1',
          type: 'scan',
          count: 1,
          periodStart: expect.any(Date),
          periodEnd: expect.any(Date),
          metadata: { source: 'api' },
        },
      });

      // Verify usage record was created
      expect(mockTx.usageRecord.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          projectId: 'project-1',
          type: 'scan',
          count: 1,
          metadata: { source: 'api' },
        },
      });

      // Verify usage counter was updated
      expect(mockTx.usageCounter.upsert).toHaveBeenCalledWith({
        where: {
          userId_periodStart: {
            userId: 'user-1',
            periodStart: expect.any(Date),
          },
        },
        update: {
          scanCount: { increment: 1 },
        },
        create: {
          userId: 'user-1',
          periodStart: expect.any(Date),
          periodEnd: expect.any(Date),
          scanCount: 1,
        },
      });

      expect(result).toEqual({
        usageLog: {
          userId: 'user-1',
          type: 'scan',
          count: 6,
        },
        newCount: 6,
        previousCount: 5,
      });
    });
  });

  describe('activateLicenseWithValidation', () => {
    it('should activate license with validation atomically', async () => {
      // Setup mocks
      mockTx.licenseKey.findUnique.mockResolvedValue({
        id: 'license-1',
        keyHash: 'hash-123',
        activations: 2,
        maxActivations: 5,
        activationRecords: [],
      });
      mockTx.licenseActivation.findUnique.mockResolvedValue(null); // No existing activation
      mockTx.licenseActivation.create.mockResolvedValue({ id: 'activation-1' });
      mockTx.licenseKey.update.mockResolvedValue({ id: 'license-1' });

      const result = await transactions.activateLicenseWithValidation(
        'hash-123',
        'fingerprint-123',
        {
          machineId: 'machine-1',
          ipAddress: '192.168.1.1',
        }
      );

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalled();

      // Verify license key was validated
      expect(mockTx.licenseKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: 'hash-123' },
        include: { activationRecords: true },
      });

      // Verify existing activation was checked
      expect(mockTx.licenseActivation.findUnique).toHaveBeenCalledWith({
        where: {
          licenseKeyId_fingerprint: {
            licenseKeyId: 'license-1',
            fingerprint: 'fingerprint-123',
          },
        },
      });

      // Verify new activation was created
      expect(mockTx.licenseActivation.create).toHaveBeenCalledWith({
        data: {
          licenseKeyId: 'license-1',
          fingerprint: 'fingerprint-123',
          machineId: 'machine-1',
          ipAddress: '192.168.1.1',
        },
      });

      // Verify activation count was incremented
      expect(mockTx.licenseKey.update).toHaveBeenCalledWith({
        where: { id: 'license-1' },
        data: {
          activations: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });

      expect(result).toEqual({
        id: 'license-1',
        keyHash: 'hash-123',
        activations: 2,
        maxActivations: 5,
        activationRecords: [],
      });
    });

    it('should reject activation when limit reached', async () => {
      // Setup mocks
      mockTx.licenseKey.findUnique.mockResolvedValue({
        id: 'license-1',
        keyHash: 'hash-123',
        activations: 5,
        maxActivations: 5,
        activationRecords: [],
      });

      await expect(
        transactions.activateLicenseWithValidation('hash-123', 'fingerprint-123', {
          machineId: 'machine-1',
        })
      ).rejects.toThrow('Maximum activations reached');

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('processStripeWebhookEvent', () => {
    it('should process webhook events atomically', async () => {
      // Setup mocks
      mockTx.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      mockTx.billingEvent.create.mockResolvedValue({ id: 'event-1' });

      const result = await transactions.processStripeWebhookEvent({
        eventType: 'customer.created',
        stripeEventId: 'evt_123',
        customerId: 'cus_123',
      });

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalled();

      // Verify user was found
      expect(mockTx.user.findUnique).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_123' },
      });

      // Verify billing event was created
      expect(mockTx.billingEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          subscriptionId: undefined,
          invoiceId: undefined,
          eventType: 'customer.created',
          eventSource: 'stripe',
          stripeEventId: 'evt_123',
          metadata: undefined,
        },
      });

      expect(result).toEqual({
        billingEvent: { id: 'event-1' },
        user: {
          id: 'user-1',
          email: 'user@example.com',
        },
        subscription: null,
        invoice: null,
      });
    });
  });
});
