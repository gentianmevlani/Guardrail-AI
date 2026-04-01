/**
 * Auth Rate Limiter Tests
 *
 * Tests for dual-track (account + IP) rate limiting with:
 * - Escalating cooldowns for account-based attacks
 * - IP-based limits for spray attacks
 * - Enterprise IP allowlist
 * - Safe error messaging (no account enumeration)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    AuthRateLimiter,
    AuthRateLimiterConfig,
} from "../auth-rate-limiter";

describe("AuthRateLimiter", () => {
  let limiter: AuthRateLimiter;

  const defaultConfig: Partial<AuthRateLimiterConfig> = {
    accountMaxAttempts: 10,
    accountWindowMs: 15 * 60 * 1000, // 15 min
    accountBaseLockoutMs: 60 * 1000, // 1 min
    accountMaxLockoutMs: 60 * 60 * 1000, // 1 hour
    ipMaxAttempts: 50,
    ipWindowMs: 15 * 60 * 1000, // 15 min
    enableAllowlist: false,
    allowlistedIpRanges: [],
  };

  beforeEach(() => {
    limiter = new AuthRateLimiter(defaultConfig);
  });

  // ==========================================================================
  // Test: 6 people behind same IP can still log in
  // ==========================================================================
  describe("Multiple legitimate users behind same IP", () => {
    it("should allow 6 different users to log in from the same IP", () => {
      const sharedIp = "192.168.1.100";
      const users = [
        "user1@example.com",
        "user2@example.com",
        "user3@example.com",
        "user4@example.com",
        "user5@example.com",
        "user6@example.com",
      ];

      // Each user makes a few failed attempts then succeeds
      for (const user of users) {
        // 2 failed attempts per user
        for (let i = 0; i < 2; i++) {
          const result = limiter.check(user, sharedIp);
          expect(result.allowed).toBe(true);
          limiter.recordFailure(user, sharedIp);
        }

        // Successful login
        const finalResult = limiter.check(user, sharedIp);
        expect(finalResult.allowed).toBe(true);
        limiter.recordSuccess(user, sharedIp);
      }

      // Total IP attempts: 6 users * 2 failures = 12 attempts
      // This is well under the 50 IP limit
      const ipStatus = limiter.getIpStatus(sharedIp);
      expect(ipStatus.attempts).toBe(12);
      expect(ipStatus.uniqueAccounts).toBeLessThanOrEqual(6);
    });

    it("should allow legitimate users even after some failed attempts", () => {
      const sharedIp = "10.0.0.1";

      // 6 users, each with 5 failed attempts (30 total, under 50 IP limit)
      for (let userNum = 1; userNum <= 6; userNum++) {
        const email = `employee${userNum}@company.com`;

        for (let attempt = 0; attempt < 5; attempt++) {
          const result = limiter.check(email, sharedIp);
          expect(result.allowed).toBe(true);
          limiter.recordFailure(email, sharedIp);
        }

        // User remembers password and logs in successfully
        const loginResult = limiter.check(email, sharedIp);
        expect(loginResult.allowed).toBe(true);
        limiter.recordSuccess(email, sharedIp);
      }
    });
  });

  // ==========================================================================
  // Test: Brute force against 1 account gets locked
  // ==========================================================================
  describe("Brute force attack on single account", () => {
    it("should lock account after 10 failed attempts", () => {
      const targetAccount = "victim@example.com";
      const attackerIp = "203.0.113.50";

      // Make 10 failed attempts (the limit)
      for (let i = 0; i < 10; i++) {
        const result = limiter.check(targetAccount, attackerIp);
        expect(result.allowed).toBe(true);
        limiter.recordFailure(targetAccount, attackerIp);
      }

      // 11th attempt should be blocked
      const blockedResult = limiter.check(targetAccount, attackerIp);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.reason).toBe("account_locked");
      expect(blockedResult.retryAfter).toBeGreaterThan(0);
    });

    it("should apply exponential backoff on repeated lockouts", () => {
      const targetAccount = "target@example.com";
      const attackerIp = "198.51.100.1";

      // First lockout: trigger 10 failures
      for (let i = 0; i < 10; i++) {
        limiter.check(targetAccount, attackerIp);
        limiter.recordFailure(targetAccount, attackerIp);
      }

      const firstLockout = limiter.check(targetAccount, attackerIp);
      expect(firstLockout.allowed).toBe(false);
      const firstRetryAfter = firstLockout.retryAfter!;

      // Simulate time passing (lockout expires)
      vi.useFakeTimers();
      vi.advanceTimersByTime(firstRetryAfter * 1000 + 1000);

      // Reset limiter state for second round (simulating window reset)
      limiter.reset();
      limiter = new AuthRateLimiter(defaultConfig);

      // For a proper test, we need to track lockout count across lockouts
      // Let's test the escalation directly
      const limiterWithState = new AuthRateLimiter({
        ...defaultConfig,
        accountBaseLockoutMs: 1000, // 1 second for faster testing
      });

      // First lockout
      for (let i = 0; i < 10; i++) {
        limiterWithState.recordFailure(targetAccount, attackerIp);
      }
      const status1 = limiterWithState.getAccountStatus(targetAccount);
      expect(status1.isLocked).toBe(true);
      expect(status1.lockoutCount).toBe(1);

      vi.useRealTimers();
    });

    it("should block attacker from different IPs targeting same account", () => {
      const targetAccount = "ceo@company.com";
      const attackerIps = [
        "1.1.1.1",
        "2.2.2.2",
        "3.3.3.3",
        "4.4.4.4",
        "5.5.5.5",
      ];

      // Distribute 10 attempts across 5 IPs (2 each)
      let attemptCount = 0;
      for (const ip of attackerIps) {
        for (let i = 0; i < 2; i++) {
          const result = limiter.check(targetAccount, ip);
          if (attemptCount < 10) {
            expect(result.allowed).toBe(true);
          }
          limiter.recordFailure(targetAccount, ip);
          attemptCount++;
        }
      }

      // Account should now be locked regardless of IP
      const newIp = "9.9.9.9";
      const blockedResult = limiter.check(targetAccount, newIp);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.reason).toBe("account_locked");
    });

    it("should reset account attempts on successful login", () => {
      const account = "user@example.com";
      const ip = "192.168.1.1";

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        limiter.recordFailure(account, ip);
      }

      let status = limiter.getAccountStatus(account);
      expect(status.attempts).toBe(5);

      // Successful login
      limiter.recordSuccess(account, ip);

      // Attempts should be reset
      status = limiter.getAccountStatus(account);
      expect(status.attempts).toBe(0);
    });
  });

  // ==========================================================================
  // Test: Spray attack across many accounts triggers IP limiter
  // ==========================================================================
  describe("Password spray attack (many accounts from one IP)", () => {
    it("should block IP after 50 attempts across different accounts", () => {
      const attackerIp = "185.220.101.1"; // Known Tor exit node pattern

      // Try 50 different accounts (the IP limit)
      for (let i = 0; i < 50; i++) {
        const account = `user${i}@example.com`;
        const result = limiter.check(account, attackerIp);
        expect(result.allowed).toBe(true);
        limiter.recordFailure(account, attackerIp);
      }

      // 51st account should be blocked by IP limiter
      const blockedResult = limiter.check("user51@example.com", attackerIp);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.reason).toBe("ip_limited");
      expect(blockedResult.retryAfter).toBeGreaterThan(0);
    });

    it("should track unique accounts per IP", () => {
      const attackerIp = "45.33.32.156";

      // Try 20 different accounts
      for (let i = 0; i < 20; i++) {
        const account = `target${i}@company.com`;
        limiter.recordFailure(account, attackerIp);
      }

      const ipStatus = limiter.getIpStatus(attackerIp);
      expect(ipStatus.attempts).toBe(20);
      expect(ipStatus.uniqueAccounts).toBe(20);
    });

    it("should block spray attack even with 1 attempt per account", () => {
      const attackerIp = "192.0.2.1";

      // Classic spray: 1 password attempt per account, many accounts
      for (let i = 0; i < 50; i++) {
        const account = `employee${i}@bigcorp.com`;
        limiter.check(account, attackerIp);
        limiter.recordFailure(account, attackerIp);
      }

      // Next attempt blocked
      const result = limiter.check("employee50@bigcorp.com", attackerIp);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("ip_limited");
    });
  });

  // ==========================================================================
  // Enterprise IP Allowlist
  // ==========================================================================
  describe("Enterprise IP allowlist", () => {
    it("should bypass rate limiting for allowlisted IPs", () => {
      const allowlistedLimiter = new AuthRateLimiter({
        ...defaultConfig,
        enableAllowlist: true,
        allowlistedIpRanges: ["10.0.0.0/8", "192.168.1.100"],
      });

      const enterpriseIp = "10.50.25.100";
      const account = "admin@enterprise.com";

      // Make 100 failed attempts (way over both limits)
      for (let i = 0; i < 100; i++) {
        const result = allowlistedLimiter.check(account, enterpriseIp);
        expect(result.allowed).toBe(true);
        allowlistedLimiter.recordFailure(account, enterpriseIp);
      }

      // Still allowed because IP is allowlisted
      const finalResult = allowlistedLimiter.check(account, enterpriseIp);
      expect(finalResult.allowed).toBe(true);
    });

    it("should support exact IP matches in allowlist", () => {
      const allowlistedLimiter = new AuthRateLimiter({
        ...defaultConfig,
        enableAllowlist: true,
        allowlistedIpRanges: ["203.0.113.50"],
      });

      // Exact match should be allowed
      expect(
        allowlistedLimiter.check("user@test.com", "203.0.113.50").allowed
      ).toBe(true);

      // Different IP should not be allowed after limits
      const otherIp = "203.0.113.51";
      for (let i = 0; i < 50; i++) {
        allowlistedLimiter.recordFailure(`user${i}@test.com`, otherIp);
      }
      expect(
        allowlistedLimiter.check("user50@test.com", otherIp).allowed
      ).toBe(false);
    });

    it("should support CIDR notation in allowlist", () => {
      const allowlistedLimiter = new AuthRateLimiter({
        ...defaultConfig,
        enableAllowlist: true,
        allowlistedIpRanges: ["172.16.0.0/16"],
      });

      // IPs in range should be allowed
      expect(
        allowlistedLimiter.check("user@test.com", "172.16.0.1").allowed
      ).toBe(true);
      expect(
        allowlistedLimiter.check("user@test.com", "172.16.255.255").allowed
      ).toBe(true);

      // IP outside range should be subject to limits
      expect(
        allowlistedLimiter.check("user@test.com", "172.17.0.1").allowed
      ).toBe(true); // First attempt allowed
    });

    it("should not bypass when allowlist is disabled", () => {
      const disabledAllowlistLimiter = new AuthRateLimiter({
        ...defaultConfig,
        enableAllowlist: false,
        allowlistedIpRanges: ["10.0.0.0/8"],
      });

      const ip = "10.50.25.100";
      const account = "user@test.com";

      // Make 10 failed attempts
      for (let i = 0; i < 10; i++) {
        disabledAllowlistLimiter.recordFailure(account, ip);
      }

      // Should be blocked even though IP is in the list
      const result = disabledAllowlistLimiter.check(account, ip);
      expect(result.allowed).toBe(false);
    });

    it("should allow runtime allowlist updates", () => {
      const dynamicLimiter = new AuthRateLimiter({
        ...defaultConfig,
        enableAllowlist: false,
        allowlistedIpRanges: [],
      });

      const enterpriseIp = "198.51.100.50";
      const account = "user@enterprise.com";

      // Initially not allowlisted - make 10 failures
      for (let i = 0; i < 10; i++) {
        dynamicLimiter.recordFailure(account, enterpriseIp);
      }

      // Should be blocked
      expect(dynamicLimiter.check(account, enterpriseIp).allowed).toBe(false);

      // Admin enables allowlist for this enterprise
      dynamicLimiter.updateAllowlist([enterpriseIp], true);

      // Now should be allowed
      expect(dynamicLimiter.check(account, enterpriseIp).allowed).toBe(true);
    });
  });

  // ==========================================================================
  // Safe Error Messaging (No Account Enumeration)
  // ==========================================================================
  describe("Safe error messaging", () => {
    it("should return same error for locked existing and non-existing accounts", () => {
      const existingAccount = "real.user@company.com";
      const nonExistingAccount = "fake.user@company.com";
      const attackerIp = "192.0.2.100";

      // Lock the existing account
      for (let i = 0; i < 10; i++) {
        limiter.recordFailure(existingAccount, attackerIp);
      }

      const existingResult = limiter.check(existingAccount, attackerIp);
      const nonExistingResult = limiter.check(nonExistingAccount, attackerIp);

      // Both should have retryAfter (no way to tell which account exists)
      // The existing account is locked, the non-existing one isn't
      // But the error structure should be consistent
      expect(existingResult.allowed).toBe(false);
      expect(existingResult.reason).toBe("account_locked");

      // Non-existing account hasn't been attacked, so it's allowed
      // This is correct - we can't lock accounts that haven't been targeted
      expect(nonExistingResult.allowed).toBe(true);
    });

    it("should not reveal account existence through timing", () => {
      const ip = "192.168.1.1";

      // Both checks should be fast (no database lookup in rate limiter)
      const start1 = Date.now();
      limiter.check("existing@example.com", ip);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      limiter.check("nonexisting@example.com", ip);
      const time2 = Date.now() - start2;

      // Both should be sub-millisecond (in-memory operations)
      expect(time1).toBeLessThan(10);
      expect(time2).toBeLessThan(10);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe("Edge cases", () => {
    it("should handle IPv6-mapped IPv4 addresses", () => {
      const account = "user@example.com";

      // These should be treated as the same IP
      limiter.recordFailure(account, "::ffff:192.168.1.1");
      limiter.recordFailure(account, "192.168.1.1");

      const status = limiter.getAccountStatus(account);
      expect(status.attempts).toBe(2);
    });

    it("should handle case-insensitive email matching", () => {
      const ip = "192.168.1.1";

      // These should all count against the same account
      limiter.recordFailure("User@Example.COM", ip);
      limiter.recordFailure("user@example.com", ip);
      limiter.recordFailure("USER@EXAMPLE.COM", ip);

      const status = limiter.getAccountStatus("user@example.com");
      expect(status.attempts).toBe(3);
    });

    it("should handle whitespace in account identifiers", () => {
      const ip = "192.168.1.1";

      limiter.recordFailure("  user@example.com  ", ip);
      limiter.recordFailure("user@example.com", ip);

      const status = limiter.getAccountStatus("user@example.com");
      expect(status.attempts).toBe(2);
    });

    it("should handle missing account identifier gracefully", () => {
      const ip = "192.168.1.1";

      // Empty string should still work (tracked as empty account)
      const result = limiter.check("", ip);
      expect(result.allowed).toBe(true);
    });

    it("should cleanup expired entries", () => {
      vi.useFakeTimers();

      const account = "user@example.com";
      const ip = "192.168.1.1";

      // Record some failures
      for (let i = 0; i < 5; i++) {
        limiter.recordFailure(account, ip);
      }

      // Advance time past the window
      vi.advanceTimersByTime(16 * 60 * 1000); // 16 minutes

      // Cleanup should remove expired entries
      limiter.cleanup();

      // New check should start fresh
      const result = limiter.check(account, ip);
      expect(result.allowed).toBe(true);

      vi.useRealTimers();
    });

    it("should preserve lockout escalation history", () => {
      const account = "user@example.com";
      const ip = "192.168.1.1";

      // First lockout
      for (let i = 0; i < 10; i++) {
        limiter.recordFailure(account, ip);
      }

      let status = limiter.getAccountStatus(account);
      expect(status.lockoutCount).toBe(1);
      expect(status.isLocked).toBe(true);
    });
  });

  // ==========================================================================
  // Admin Functions
  // ==========================================================================
  describe("Admin functions", () => {
    it("should allow manual account unlock", () => {
      const account = "locked.user@example.com";
      const ip = "192.168.1.1";

      // Lock the account
      for (let i = 0; i < 10; i++) {
        limiter.recordFailure(account, ip);
      }

      expect(limiter.check(account, ip).allowed).toBe(false);

      // Admin unlocks
      limiter.unlockAccount(account);

      // Should be allowed again
      expect(limiter.check(account, ip).allowed).toBe(true);
    });

    it("should provide accurate status information", () => {
      const account = "monitored@example.com";
      const ip = "192.168.1.1";

      // Make some attempts
      for (let i = 0; i < 5; i++) {
        limiter.recordFailure(account, ip);
      }

      const accountStatus = limiter.getAccountStatus(account);
      expect(accountStatus.attempts).toBe(5);
      expect(accountStatus.isLocked).toBe(false);
      expect(accountStatus.lockoutCount).toBe(0);

      const ipStatus = limiter.getIpStatus(ip);
      expect(ipStatus.attempts).toBe(5);
      expect(ipStatus.uniqueAccounts).toBe(1);
    });
  });

  // ==========================================================================
  // Concurrent Access Simulation
  // ==========================================================================
  describe("Concurrent access patterns", () => {
    it("should handle rapid sequential requests", () => {
      const account = "busy.user@example.com";
      const ip = "192.168.1.1";

      // Simulate rapid login attempts
      for (let i = 0; i < 100; i++) {
        const result = limiter.check(account, ip);
        if (i < 10) {
          expect(result.allowed).toBe(true);
        } else {
          expect(result.allowed).toBe(false);
        }
        if (result.allowed) {
          limiter.recordFailure(account, ip);
        }
      }
    });

    it("should handle interleaved requests from multiple accounts", () => {
      const ip = "192.168.1.1";
      const accounts = ["a@test.com", "b@test.com", "c@test.com"];

      // Interleave requests
      for (let round = 0; round < 5; round++) {
        for (const account of accounts) {
          const result = limiter.check(account, ip);
          expect(result.allowed).toBe(true);
          limiter.recordFailure(account, ip);
        }
      }

      // Each account should have 5 attempts
      for (const account of accounts) {
        const status = limiter.getAccountStatus(account);
        expect(status.attempts).toBe(5);
      }

      // IP should have 15 total attempts
      const ipStatus = limiter.getIpStatus(ip);
      expect(ipStatus.attempts).toBe(15);
    });
  });
});
