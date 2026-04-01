/**
 * Tests for contextual risk adjustment
 */

import { adjustRiskByContext, getContextDescription } from '../contextual-risk';

describe('adjustRiskByContext', () => {
  it('should downgrade risk for .env.example files', () => {
    const result = adjustRiskByContext({
      filePath: '.env.example',
      entropy: 3.5,
      originalRisk: 'high',
    });
    expect(result).toBe('medium');
  });

  it('should downgrade risk for template files', () => {
    const result = adjustRiskByContext({
      filePath: 'config/database.template.yml',
      entropy: 3.8,
      originalRisk: 'high',
    });
    expect(result).toBe('medium');
  });

  it('should keep high risk for extremely high entropy in examples', () => {
    const result = adjustRiskByContext({
      filePath: '.env.example',
      entropy: 5.2,
      originalRisk: 'high',
    });
    expect(result).toBe('high');
  });

  it('should upgrade risk for production .env files', () => {
    const result = adjustRiskByContext({
      filePath: '.env',
      entropy: 4.6,
      originalRisk: 'medium',
    });
    expect(result).toBe('high');
  });

  it('should not upgrade low entropy in production files', () => {
    const result = adjustRiskByContext({
      filePath: '.env',
      entropy: 3.0,
      originalRisk: 'medium',
    });
    expect(result).toBe('medium');
  });

  it('should handle sample files', () => {
    const result = adjustRiskByContext({
      filePath: 'config/credentials.sample.json',
      entropy: 4.0,
      originalRisk: 'high',
    });
    expect(result).toBe('medium');
  });

  it('should handle dist files', () => {
    const result = adjustRiskByContext({
      filePath: 'config.dist',
      entropy: 3.5,
      originalRisk: 'medium',
    });
    expect(result).toBe('low');
  });

  it('should not change risk for normal source files', () => {
    const result = adjustRiskByContext({
      filePath: 'src/config/database.ts',
      entropy: 4.2,
      originalRisk: 'medium',
    });
    expect(result).toBe('medium');
  });

  it('should downgrade medium to low for examples', () => {
    const result = adjustRiskByContext({
      filePath: 'examples/api-key.example.js',
      entropy: 3.8,
      originalRisk: 'medium',
    });
    expect(result).toBe('low');
  });

  it('should handle production config paths', () => {
    const result = adjustRiskByContext({
      filePath: 'config/production.json',
      entropy: 4.7,
      originalRisk: 'medium',
    });
    expect(result).toBe('high');
  });
});

describe('getContextDescription', () => {
  it('should identify example files', () => {
    expect(getContextDescription('.env.example')).toBe('example/template file');
    expect(getContextDescription('config.template')).toBe('example/template file');
  });

  it('should identify production files', () => {
    expect(getContextDescription('.env')).toBe('production configuration');
    expect(getContextDescription('config/production.yml')).toBe('production configuration');
  });

  it('should default to source file', () => {
    expect(getContextDescription('src/index.ts')).toBe('source file');
    expect(getContextDescription('lib/utils.js')).toBe('source file');
  });
});
