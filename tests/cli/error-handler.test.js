/**
 * Error Handler Tests
 * 
 * Tests for standardized error handling, exit codes, and error context
 */

const {
  handleError,
  withErrorHandling,
  createUserError,
  EXIT_CODES,
  getErrorGuidance,
} = require('../../bin/runners/lib/error-handler');

describe('Error Handler', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('EXIT_CODES', () => {
    it('should have all required exit codes', () => {
      expect(EXIT_CODES).toHaveProperty('SUCCESS', 0);
      expect(EXIT_CODES).toHaveProperty('POLICY_FAIL', 1);
      expect(EXIT_CODES).toHaveProperty('USER_ERROR', 2);
      expect(EXIT_CODES).toHaveProperty('SYSTEM_ERROR', 3);
      expect(EXIT_CODES).toHaveProperty('AUTH_FAILURE', 4);
      expect(EXIT_CODES).toHaveProperty('NETWORK_FAILURE', 5);
    });
  });

  describe('handleError', () => {
    it('should format errors with context', () => {
      const error = new Error('Test error');
      handleError(error, 'scan', { command: 'scan', file: 'test.js' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.join('\n');
      expect(errorOutput).toContain('scan');
      expect(errorOutput).toContain('Test error');
    });

    it('should show next steps for known errors', () => {
      const error = new Error('API key required');
      error.code = 'INVALID_API_KEY';
      handleError(error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.join('\n');
      expect(errorOutput).toContain('Next steps');
    });

    it('should include stack trace in debug mode', () => {
      process.env.DEBUG = '1';
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      handleError(error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.join('\n');
      expect(errorOutput).toContain('Stack trace');
      delete process.env.DEBUG;
    });
  });

  describe('getErrorGuidance', () => {
    it('should return guidance for ENOENT', () => {
      const error = { code: 'ENOENT' };
      const guidance = getErrorGuidance(error);
      expect(guidance).toBeDefined();
      expect(guidance.title).toContain('not found');
    });

    it('should return guidance for API key errors', () => {
      const error = { message: 'API key required' };
      const guidance = getErrorGuidance(error);
      expect(guidance).toBeDefined();
      expect(guidance.title).toContain('API key');
    });
  });

  describe('withErrorHandling', () => {
    it('should catch and handle errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Test error'));
      const wrapped = withErrorHandling(fn, 'test');
      
      const result = await wrapped();
      
      expect(result).toBe(1); // Error exit code
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return result on success', async () => {
      const fn = jest.fn().mockResolvedValue(0);
      const wrapped = withErrorHandling(fn);
      
      const result = await wrapped();
      
      expect(result).toBe(0);
    });
  });

  describe('createUserError', () => {
    it('should create error with type', () => {
      const error = createUserError('Test', 'ValidationError');
      expect(error.message).toBe('Test');
      expect(error.name).toBe('ValidationError');
      expect(error.isUserError).toBe(true);
    });
  });
});
