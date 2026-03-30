/**
 * Unit tests for exit code consistency
 * 
 * Verifies that exit codes are consistent across CLI commands
 */

import { ExitCode, getExitCodeForError, getExitCodeForFindings } from '../../packages/cli/src/runtime/exit-codes';

describe('Exit Codes', () => {
  describe('ExitCode enum', () => {
    it('should have SUCCESS = 0', () => {
      expect(ExitCode.SUCCESS).toBe(0);
    });

    it('should have POLICY_FAIL = 1', () => {
      expect(ExitCode.POLICY_FAIL).toBe(1);
    });

    it('should have USER_ERROR = 2', () => {
      expect(ExitCode.USER_ERROR).toBe(2);
    });

    it('should have SYSTEM_ERROR = 3', () => {
      expect(ExitCode.SYSTEM_ERROR).toBe(3);
    });

    it('should have AUTH_FAILURE = 4', () => {
      expect(ExitCode.AUTH_FAILURE).toBe(4);
    });

    it('should have NETWORK_FAILURE = 5', () => {
      expect(ExitCode.NETWORK_FAILURE).toBe(5);
    });
  });

  describe('getExitCodeForError', () => {
    it('should map ENOENT to SYSTEM_ERROR', () => {
      const error = new Error('ENOENT: no such file');
      error.name = 'ENOENT';
      const code = getExitCodeForError(error);
      expect(code).toBe(ExitCode.SYSTEM_ERROR);
    });

    it('should map network errors to NETWORK_FAILURE', () => {
      const error = new Error('Network timeout');
      const code = getExitCodeForError(error);
      expect(code).toBe(ExitCode.NETWORK_FAILURE);
    });

    it('should map auth errors to AUTH_FAILURE', () => {
      const error = new Error('Unauthorized access');
      const code = getExitCodeForError(error);
      expect(code).toBe(ExitCode.AUTH_FAILURE);
    });

    it('should map validation errors to USER_ERROR', () => {
      const error = new Error('Invalid input provided');
      const code = getExitCodeForError(error);
      expect(code).toBe(ExitCode.USER_ERROR);
    });

    it('should default to SYSTEM_ERROR for unknown errors', () => {
      const error = new Error('Unknown error');
      const code = getExitCodeForError(error);
      expect(code).toBe(ExitCode.SYSTEM_ERROR);
    });
  });

  describe('getExitCodeForFindings', () => {
    it('should return SUCCESS when no findings', () => {
      const code = getExitCodeForFindings(
        { critical: 0, high: 0, medium: 0, low: 0 },
        { failOnCritical: true }
      );
      expect(code).toBe(ExitCode.SUCCESS);
    });

    it('should return POLICY_FAIL when critical findings and failOnCritical', () => {
      const code = getExitCodeForFindings(
        { critical: 1, high: 0, medium: 0, low: 0 },
        { failOnCritical: true }
      );
      expect(code).toBe(ExitCode.POLICY_FAIL);
    });

    it('should return POLICY_FAIL when high findings and failOnHigh', () => {
      const code = getExitCodeForFindings(
        { critical: 0, high: 1, medium: 0, low: 0 },
        { failOnHigh: true }
      );
      expect(code).toBe(ExitCode.POLICY_FAIL);
    });

    it('should return SUCCESS when high findings but not failOnHigh', () => {
      const code = getExitCodeForFindings(
        { critical: 0, high: 1, medium: 0, low: 0 },
        { failOnCritical: true }
      );
      expect(code).toBe(ExitCode.SUCCESS);
    });

    it('should return POLICY_FAIL when failOnAny and any findings', () => {
      const code = getExitCodeForFindings(
        { critical: 0, high: 0, medium: 0, low: 1 },
        { failOnAny: true }
      );
      expect(code).toBe(ExitCode.POLICY_FAIL);
    });
  });
});
