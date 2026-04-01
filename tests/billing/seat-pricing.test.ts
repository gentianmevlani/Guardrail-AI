/**
 * Seat-Based Pricing Tests
 * 
 * Tests for the seat management functionality including:
 * - Effective seat calculations
 * - Member addition checks
 * - Graceful seat reduction
 */

import {
    SEAT_PRICING,
    TIER_CONFIG,
    Tier,
    calculateEffectiveSeats,
    canAddMember,
    validateSeatReduction,
} from '@guardrail/core';
import { describe, expect, it } from 'vitest';

describe('Seat Pricing Configuration', () => {
  it('should have seat pricing for all tiers', () => {
    const tiers: Tier[] = ['free', 'starter', 'pro', 'compliance', 'enterprise', 'unlimited'];
    
    for (const tier of tiers) {
      expect(SEAT_PRICING[tier]).toBeDefined();
      expect(typeof SEAT_PRICING[tier].monthlyPricePerSeat).toBe('number');
      expect(typeof SEAT_PRICING[tier].annualPricePerSeat).toBe('number');
      expect(typeof SEAT_PRICING[tier].maxAdditionalSeats).toBe('number');
      expect(typeof SEAT_PRICING[tier].supportsAdditionalSeats).toBe('boolean');
    }
  });

  it('should not support additional seats for free and starter tiers', () => {
    expect(SEAT_PRICING.free.supportsAdditionalSeats).toBe(false);
    expect(SEAT_PRICING.starter.supportsAdditionalSeats).toBe(false);
  });

  it('should support additional seats for pro, compliance, and enterprise tiers', () => {
    expect(SEAT_PRICING.pro.supportsAdditionalSeats).toBe(true);
    expect(SEAT_PRICING.compliance.supportsAdditionalSeats).toBe(true);
    expect(SEAT_PRICING.enterprise.supportsAdditionalSeats).toBe(true);
  });

  it('should have correct base seat counts in tier config', () => {
    expect(TIER_CONFIG.free.limits.teamMembers).toBe(1);
    expect(TIER_CONFIG.starter.limits.teamMembers).toBe(1);
    expect(TIER_CONFIG.pro.limits.teamMembers).toBe(5);
    expect(TIER_CONFIG.compliance.limits.teamMembers).toBe(10);
    expect(TIER_CONFIG.enterprise.limits.teamMembers).toBe(50);
  });
});

describe('calculateEffectiveSeats', () => {
  it('should return base seats when no extras purchased', () => {
    expect(calculateEffectiveSeats('pro', 0)).toBe(5);
    expect(calculateEffectiveSeats('compliance', 0)).toBe(10);
    expect(calculateEffectiveSeats('enterprise', 0)).toBe(50);
  });

  it('should add purchased extras to base seats', () => {
    // Pro base 5 + 3 extras = 8
    expect(calculateEffectiveSeats('pro', 3)).toBe(8);
    
    // Compliance base 10 + 5 extras = 15
    expect(calculateEffectiveSeats('compliance', 5)).toBe(15);
  });

  it('should cap extras at max allowed for tier', () => {
    // Pro max additional is 45, so 5 + 45 = 50 max
    expect(calculateEffectiveSeats('pro', 100)).toBe(50);
    
    // Compliance max additional is 90, so 10 + 90 = 100 max
    expect(calculateEffectiveSeats('compliance', 200)).toBe(100);
  });

  it('should return Infinity for unlimited tier', () => {
    expect(calculateEffectiveSeats('unlimited', 0)).toBe(Infinity);
    expect(calculateEffectiveSeats('unlimited', 100)).toBe(Infinity);
  });

  it('should ignore extras for tiers that do not support them', () => {
    expect(calculateEffectiveSeats('free', 10)).toBe(1);
    expect(calculateEffectiveSeats('starter', 10)).toBe(1);
  });

  it('should handle enterprise with unlimited additional seats', () => {
    // Enterprise has -1 (unlimited) max additional seats
    expect(calculateEffectiveSeats('enterprise', 100)).toBe(150); // 50 + 100
    expect(calculateEffectiveSeats('enterprise', 1000)).toBe(1050); // 50 + 1000
  });
});

describe('canAddMember', () => {
  it('should allow adding member when under limit', () => {
    const result = canAddMember('pro', 3, 0); // 3 members, 5 base seats
    expect(result.allowed).toBe(true);
    expect(result.effectiveSeats).toBe(5);
  });

  it('should deny adding member when at limit', () => {
    const result = canAddMember('pro', 5, 0); // 5 members, 5 base seats
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Seat limit reached');
  });

  it('should allow adding member with purchased extras', () => {
    // Pro with 3 extras = 8 effective seats
    const result = canAddMember('pro', 7, 3);
    expect(result.allowed).toBe(true);
    expect(result.effectiveSeats).toBe(8);
  });

  it('should suggest purchasing more seats when available', () => {
    const result = canAddMember('pro', 5, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Purchase additional seats');
  });

  it('should suggest upgrading when no more seats can be purchased', () => {
    // Free tier cannot purchase additional seats
    const result = canAddMember('free', 1, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Upgrade to a higher tier');
  });

  it('should always allow for unlimited tier', () => {
    const result = canAddMember('unlimited', 1000, 0);
    expect(result.allowed).toBe(true);
    expect(result.effectiveSeats).toBe(Infinity);
  });
});

describe('validateSeatReduction', () => {
  it('should allow reduction when members fit in new limit', () => {
    // 5 members, reducing from 10 to 8 effective seats
    const result = validateSeatReduction(5, 10, 8);
    expect(result.safe).toBe(true);
    expect(result.requiresAction).toBe(false);
    expect(result.excessMembers).toBe(0);
  });

  it('should block reduction when members exceed new limit', () => {
    // 8 members, reducing from 10 to 5 effective seats
    const result = validateSeatReduction(8, 10, 5);
    expect(result.safe).toBe(false);
    expect(result.requiresAction).toBe(true);
    expect(result.excessMembers).toBe(3); // 8 - 5 = 3 excess
    expect(result.message).toContain('Remove members before reducing seats');
  });

  it('should allow reduction when members exactly match new limit', () => {
    // 5 members, reducing from 10 to 5 effective seats
    const result = validateSeatReduction(5, 10, 5);
    expect(result.safe).toBe(true);
    expect(result.requiresAction).toBe(false);
  });

  it('should handle edge case of 0 members', () => {
    const result = validateSeatReduction(0, 10, 1);
    expect(result.safe).toBe(true);
    expect(result.requiresAction).toBe(false);
  });
});

describe('Integration: Pro tier with 5 base + 3 extras = 8 allowed', () => {
  it('should calculate 8 effective seats', () => {
    const effective = calculateEffectiveSeats('pro', 3);
    expect(effective).toBe(8);
  });

  it('should allow adding 8th member', () => {
    const result = canAddMember('pro', 7, 3);
    expect(result.allowed).toBe(true);
  });

  it('should deny adding 9th member', () => {
    const result = canAddMember('pro', 8, 3);
    expect(result.allowed).toBe(false);
  });
});

describe('Graceful seat reduction', () => {
  it('should not instantly lock out members when reducing extras', () => {
    // Scenario: Org has 8 members with 3 purchased extras (5 base + 3 = 8)
    // Admin wants to reduce to 1 extra (5 base + 1 = 6)
    // This should be blocked because 8 > 6
    
    const currentMembers = 8;
    const currentPurchased = 3;
    const newPurchased = 1;
    
    const currentEffective = calculateEffectiveSeats('pro', currentPurchased);
    const newEffective = calculateEffectiveSeats('pro', newPurchased);
    
    expect(currentEffective).toBe(8);
    expect(newEffective).toBe(6);
    
    const validation = validateSeatReduction(currentMembers, currentEffective, newEffective);
    
    expect(validation.safe).toBe(false);
    expect(validation.requiresAction).toBe(true);
    expect(validation.excessMembers).toBe(2); // Need to remove 2 members first
  });

  it('should allow reduction after removing excess members', () => {
    // After removing 2 members (8 -> 6), reduction should be allowed
    const currentMembers = 6;
    const currentPurchased = 3;
    const newPurchased = 1;
    
    const currentEffective = calculateEffectiveSeats('pro', currentPurchased);
    const newEffective = calculateEffectiveSeats('pro', newPurchased);
    
    const validation = validateSeatReduction(currentMembers, currentEffective, newEffective);
    
    expect(validation.safe).toBe(true);
    expect(validation.requiresAction).toBe(false);
  });
});
