import { describe, it, expect } from 'vitest';
import {
  GuardrailError,
  GuardrailError,
  CodebaseAnalysisError,
  FileOperationError,
  ConfigurationError,
  ValidationError,
  APIError,
  MLModelError,
  KnowledgeBaseError,
} from '../errors';

describe('Error Classes', () => {
  describe('GuardrailError', () => {
    it('should create error with code and context', () => {
      const error = new GuardrailError(
        'Test error',
        'TEST_ERROR',
        { key: 'value' }
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual({ key: 'value' });
      expect(error.name).toBe('GuardrailError');
    });

    it('should serialize to JSON', () => {
      const error = new GuardrailError('Test', 'TEST', { key: 'value' });
      const json = error.toJSON();

      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('context');
      expect(json['context']).toEqual({ key: 'value' });
    });
  });

  describe('GuardrailError', () => {
    it('should create guardrail error with rule ID', () => {
      const error = new GuardrailError(
        'Rule violation',
        'no-root-files',
        'src/UserProfile.tsx'
      );

      expect(error.message).toBe('Rule violation');
      expect(error.ruleId).toBe('no-root-files');
      expect(error.filePath).toBe('src/UserProfile.tsx');
      expect(error.code).toBe('GUARDRAIL_ERROR');
    });
  });

  describe('CodebaseAnalysisError', () => {
    it('should create analysis error with project path', () => {
      const cause = new Error('Original error');
      const error = new CodebaseAnalysisError(
        'Analysis failed',
        './my-project',
        cause
      );

      expect(error.message).toBe('Analysis failed');
      expect(error.projectPath).toBe('./my-project');
      expect(error.cause).toBe(cause);
      expect(error.code).toBe('CODEBASE_ANALYSIS_ERROR');
    });
  });

  describe('FileOperationError', () => {
    it('should create file operation error', () => {
      const error = new FileOperationError(
        'File read failed',
        'src/file.ts',
        'read'
      );

      expect(error.message).toBe('File read failed');
      expect(error.filePath).toBe('src/file.ts');
      expect(error.operation).toBe('read');
      expect(error.code).toBe('FILE_OPERATION_ERROR');
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError(
        'Invalid config',
        'apiKey'
      );

      expect(error.message).toBe('Invalid config');
      expect(error.configKey).toBe('apiKey');
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError(
        'Invalid value',
        'email',
        'not-an-email'
      );

      expect(error.message).toBe('Invalid value');
      expect(error.field).toBe('email');
      expect(error.value).toBe('not-an-email');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('APIError', () => {
    it('should create API error', () => {
      const error = new APIError(
        'API request failed',
        '/api/users',
        500
      );

      expect(error.message).toBe('API request failed');
      expect(error.endpoint).toBe('/api/users');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('API_ERROR');
    });
  });

  describe('MLModelError', () => {
    it('should create ML model error', () => {
      const error = new MLModelError(
        'Model training failed',
        './model.json',
        'train'
      );

      expect(error.message).toBe('Model training failed');
      expect(error.modelPath).toBe('./model.json');
      expect(error.operation).toBe('train');
      expect(error.code).toBe('ML_MODEL_ERROR');
    });
  });

  describe('KnowledgeBaseError', () => {
    it('should create knowledge base error', () => {
      const error = new KnowledgeBaseError(
        'Knowledge base build failed',
        './my-project',
        'build'
      );

      expect(error.message).toBe('Knowledge base build failed');
      expect(error.projectPath).toBe('./my-project');
      expect(error.operation).toBe('build');
      expect(error.code).toBe('KNOWLEDGE_BASE_ERROR');
    });
  });
});


