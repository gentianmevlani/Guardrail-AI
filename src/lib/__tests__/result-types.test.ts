import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, unwrap, unwrapOr, map, mapErr, andThen } from '../types/result';
import { GuardrailError } from '../errors';

describe('Result Types', () => {
  describe('ok', () => {
    it('should create a success result', () => {
      const result = ok(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });
  });

  describe('err', () => {
    it('should create an error result', () => {
      const error = new GuardrailError('Test error', 'test-rule');
      const result = err(error);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('isOk', () => {
    it('should return true for success results', () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
    });

    it('should return false for error results', () => {
      const result = err(new GuardrailError('Test', 'test-rule'));
      expect(isOk(result)).toBe(false);
    });
  });

  describe('isErr', () => {
    it('should return true for error results', () => {
      const result = err(new GuardrailError('Test', 'test-rule'));
      expect(isErr(result)).toBe(true);
    });

    it('should return false for success results', () => {
      const result = ok(42);
      expect(isErr(result)).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('should return data for success results', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw for error results', () => {
      const result = err(new GuardrailError('Test', 'test-rule'));
      expect(() => unwrap(result)).toThrow();
    });
  });

  describe('unwrapOr', () => {
    it('should return data for success results', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return default for error results', () => {
      const result = err(new GuardrailError('Test', 'test-rule'));
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('map', () => {
    it('should transform success values', () => {
      const result = ok(21);
      const doubled = map(result, x => x * 2);
      expect(isOk(doubled)).toBe(true);
      if (isOk(doubled)) {
        expect(doubled.data).toBe(42);
      }
    });

    it('should preserve errors', () => {
      const result = err(new GuardrailError('Test', 'test-rule'));
      const mapped = map(result, x => x * 2);
      expect(isErr(mapped)).toBe(true);
    });
  });

  describe('mapErr', () => {
    it('should transform error values', () => {
      const result = err(new GuardrailError('Test', 'test-rule'));
      const mapped = mapErr(result, (_e: any) => new Error(_e.message));
      expect(isErr(mapped)).toBe(true);
    });

    it('should preserve success values', () => {
      const result = ok(42);
      const mapped = mapErr(result, (_e: any) => new Error('Should not happen'));
      expect(isOk(mapped)).toBe(true);
    });
  });

  describe('andThen', () => {
    it('should chain success results', () => {
      const result = ok(21);
      const chained = andThen(result, x => ok(x * 2));
      expect(isOk(chained)).toBe(true);
      if (isOk(chained)) {
        expect(chained.data).toBe(42);
      }
    });

    it('should propagate errors', () => {
      const result = err(new GuardrailError('Test', 'test-rule'));
      const chained = andThen(result, x => ok(x * 2));
      expect(isErr(chained)).toBe(true);
    });

    it('should propagate errors from chain', () => {
      const result = ok(21);
      const chained = andThen(result, () => err(new GuardrailError('Chain error', 'test-rule')));
      expect(isErr(chained)).toBe(true);
    });
  });
});


