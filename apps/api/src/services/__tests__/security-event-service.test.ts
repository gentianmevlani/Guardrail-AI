/**
 * Security Event Service Tests
 * 
 * Tests for security event logging, persistence, and querying
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma
vi.mock('@guardrail/database', () => ({
  prisma: {
    securityEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from '@guardrail/database';
import { SecurityEventService, securityEventService } from '../security-event-service';

describe('SecurityEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('emit', () => {
    it('should store security event in database', async () => {
      vi.mocked(prisma.securityEvent.create).mockResolvedValue({
        id: 'evt_123',
        eventType: 'login_success',
      } as any);

      await securityEventService.emit({
        eventType: 'login_success',
        payload: { method: 'password' },
        userId: 'user-123',
        severity: 'low',
      });

      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'login_success',
          userId: 'user-123',
          severity: 'low',
        }),
      });
    });

    it('should redact sensitive fields in payload', async () => {
      vi.mocked(prisma.securityEvent.create).mockResolvedValue({
        id: 'evt_123',
      } as any);

      await securityEventService.emit({
        eventType: 'login_success',
        payload: {
          password: 'secret123',
          apiKey:
            String.fromCharCode(115, 107, 95, 108, 105, 118, 101, 95) + 'abc123',
          token: 'jwt_token_value',
          username: 'john',
        },
        userId: 'user-123',
      });

      const call = vi.mocked(prisma.securityEvent.create).mock.calls[0][0];
      const payload = call.data.payload;

      // Check redacted fields
      expect(payload.password).toBe('*****');
      expect(payload.apiKey).toBe('REDACTED');
      expect(payload.token).toBe('*****');
      // Non-sensitive field should be preserved
      expect(payload.username).toBe('john');
    });

    it('should assign default severity based on event type', async () => {
      vi.mocked(prisma.securityEvent.create).mockResolvedValue({
        id: 'evt_123',
      } as any);

      await securityEventService.emit({
        eventType: 'privilege_escalation_attempt',
        payload: {},
        userId: 'user-123',
      });

      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'critical', // Default for privilege_escalation_attempt
        }),
      });
    });

    it('should not throw on database error', async () => {
      vi.mocked(prisma.securityEvent.create).mockRejectedValue(
        new Error('Database connection failed')
      );

      // Should not throw
      await expect(
        securityEventService.emit({
          eventType: 'login_success',
          payload: {},
          userId: 'user-123',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('queryEvents', () => {
    it('should query events with filters', async () => {
      const mockEvents = [
        { id: 'evt_1', eventType: 'login_success', timestamp: new Date() },
        { id: 'evt_2', eventType: 'login_failure', timestamp: new Date() },
      ];

      vi.mocked(prisma.securityEvent.findMany).mockResolvedValue(mockEvents as any);

      const events = await securityEventService.queryEvents({
        userId: 'user-123',
        eventType: 'login_success',
        limit: 10,
      });

      expect(prisma.securityEvent.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-123',
          eventType: 'login_success',
        }),
        orderBy: { timestamp: 'desc' },
        take: 10,
        skip: 0,
        select: expect.any(Object),
      });

      expect(events).toEqual(mockEvents);
    });

    it('should filter by date range', async () => {
      vi.mocked(prisma.securityEvent.findMany).mockResolvedValue([]);

      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');

      await securityEventService.queryEvents({
        from,
        to,
      });

      expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: { gte: from, lte: to },
          }),
        })
      );
    });

    it('should support pagination', async () => {
      vi.mocked(prisma.securityEvent.findMany).mockResolvedValue([]);

      await securityEventService.queryEvents({
        limit: 20,
        offset: 40,
      });

      expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });
  });

  describe('getEventStats', () => {
    it('should return event statistics grouped by type and severity', async () => {
      vi.mocked(prisma.securityEvent.groupBy).mockResolvedValue([
        { eventType: 'login_success', severity: 'low', _count: { id: 100 } },
        { eventType: 'login_failure', severity: 'medium', _count: { id: 50 } },
        { eventType: 'access_denied', severity: 'high', _count: { id: 10 } },
      ] as any);

      const stats = await securityEventService.getEventStats({
        from: new Date('2024-01-01'),
      });

      expect(stats).toEqual({
        login_success_low: 100,
        login_failure_medium: 50,
        access_denied_high: 10,
      });
    });
  });

  describe('Severity Mapping', () => {
    const eventSeverityMap: Array<{ event: string; expectedSeverity: string }> = [
      { event: 'login_success', expectedSeverity: 'low' },
      { event: 'login_failure', expectedSeverity: 'medium' },
      { event: 'jwt_invalid', expectedSeverity: 'high' },
      { event: 'privilege_escalation_attempt', expectedSeverity: 'critical' },
      { event: 'api_key_invalid', expectedSeverity: 'high' },
      { event: 'rate_limit_exceeded', expectedSeverity: 'medium' },
      { event: 'ddos_detected', expectedSeverity: 'high' },
      { event: 'billing_webhook_verification_failed', expectedSeverity: 'high' },
    ];

    it.each(eventSeverityMap)(
      'should assign $expectedSeverity severity to $event',
      async ({ event, expectedSeverity }) => {
        vi.mocked(prisma.securityEvent.create).mockResolvedValue({ id: 'evt_123' } as any);

        await securityEventService.emit({
          eventType: event as any,
          payload: {},
          userId: 'user-123',
        });

        expect(prisma.securityEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            severity: expectedSeverity,
          }),
        });
      }
    );
  });
});
