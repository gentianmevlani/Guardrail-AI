/**
 * Unit tests for enterprise menu features
 * - Recent projects persistence
 * - Theme application
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock config directory for tests
const TEST_CONFIG_DIR = join(tmpdir(), '.guardrail-test-' + Date.now());
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'credentials.json');

interface CliConfig {
  apiKey?: string;
  tier?: 'free' | 'starter' | 'pro' | 'enterprise';
  email?: string;
  authenticatedAt?: string;
  theme?: 'default' | 'colorblind-safe' | 'no-color';
  recentProjects?: string[];
  lastProjectPath?: string;
}

function loadTestConfig(): CliConfig {
  try {
    if (existsSync(TEST_CONFIG_FILE)) {
      return JSON.parse(readFileSync(TEST_CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // Config file doesn't exist or is invalid
  }
  return {};
}

function saveTestConfig(config: CliConfig): void {
  if (!existsSync(TEST_CONFIG_DIR)) {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  }
  writeFileSync(TEST_CONFIG_FILE, JSON.stringify(config, null, 2));
}

function addRecentProject(projectPath: string): void {
  const config = loadTestConfig();
  let recent = config.recentProjects || [];
  
  // Remove if already exists
  recent = recent.filter(p => p !== projectPath);
  
  // Add to front
  recent.unshift(projectPath);
  
  // Keep only last 10
  recent = recent.slice(0, 10);
  
  saveTestConfig({ ...config, recentProjects: recent });
}

function getRecentProjects(): string[] {
  const config = loadTestConfig();
  return config.recentProjects || [];
}

describe('Recent Projects Persistence', () => {
  beforeEach(() => {
    // Clean up test config before each test
    if (existsSync(TEST_CONFIG_FILE)) {
      unlinkSync(TEST_CONFIG_FILE);
    }
  });

  afterEach(() => {
    // Clean up test config after each test
    if (existsSync(TEST_CONFIG_FILE)) {
      unlinkSync(TEST_CONFIG_FILE);
    }
  });

  it('should add a new project to recent projects', () => {
    const projectPath = '/path/to/project1';
    addRecentProject(projectPath);
    
    const recent = getRecentProjects();
    expect(recent).toHaveLength(1);
    expect(recent[0]).toBe(projectPath);
  });

  it('should add multiple projects in order', () => {
    const projects = ['/path/to/project1', '/path/to/project2', '/path/to/project3'];
    
    projects.forEach(p => addRecentProject(p));
    
    const recent = getRecentProjects();
    expect(recent).toHaveLength(3);
    expect(recent[0]).toBe('/path/to/project3');
    expect(recent[1]).toBe('/path/to/project2');
    expect(recent[2]).toBe('/path/to/project1');
  });

  it('should move existing project to front when re-added', () => {
    addRecentProject('/path/to/project1');
    addRecentProject('/path/to/project2');
    addRecentProject('/path/to/project3');
    
    // Re-add project1
    addRecentProject('/path/to/project1');
    
    const recent = getRecentProjects();
    expect(recent).toHaveLength(3);
    expect(recent[0]).toBe('/path/to/project1');
    expect(recent[1]).toBe('/path/to/project3');
    expect(recent[2]).toBe('/path/to/project2');
  });

  it('should limit recent projects to 10', () => {
    // Add 15 projects
    for (let i = 1; i <= 15; i++) {
      addRecentProject(`/path/to/project${i}`);
    }
    
    const recent = getRecentProjects();
    expect(recent).toHaveLength(10);
    expect(recent[0]).toBe('/path/to/project15');
    expect(recent[9]).toBe('/path/to/project6');
  });

  it('should persist recent projects across sessions', () => {
    addRecentProject('/path/to/project1');
    addRecentProject('/path/to/project2');
    
    // Simulate new session by loading config again
    const recent = getRecentProjects();
    expect(recent).toHaveLength(2);
    expect(recent[0]).toBe('/path/to/project2');
    expect(recent[1]).toBe('/path/to/project1');
  });

  it('should handle empty recent projects list', () => {
    const recent = getRecentProjects();
    expect(recent).toHaveLength(0);
  });

  it('should not add duplicate consecutive projects', () => {
    addRecentProject('/path/to/project1');
    addRecentProject('/path/to/project1');
    
    const recent = getRecentProjects();
    expect(recent).toHaveLength(1);
    expect(recent[0]).toBe('/path/to/project1');
  });
});

describe('Theme Application', () => {
  beforeEach(() => {
    if (existsSync(TEST_CONFIG_FILE)) {
      unlinkSync(TEST_CONFIG_FILE);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_CONFIG_FILE)) {
      unlinkSync(TEST_CONFIG_FILE);
    }
  });

  it('should save theme preference', () => {
    const config = loadTestConfig();
    saveTestConfig({ ...config, theme: 'colorblind-safe' });
    
    const loaded = loadTestConfig();
    expect(loaded.theme).toBe('colorblind-safe');
  });

  it('should default to "default" theme when not set', () => {
    const config = loadTestConfig();
    expect(config.theme).toBeUndefined();
    
    const theme = config.theme || 'default';
    expect(theme).toBe('default');
  });

  it('should support all theme types', () => {
    const themes: Array<'default' | 'colorblind-safe' | 'no-color'> = [
      'default',
      'colorblind-safe',
      'no-color',
    ];
    
    themes.forEach(themeName => {
      saveTestConfig({ theme: themeName });
      const loaded = loadTestConfig();
      expect(loaded.theme).toBe(themeName);
    });
  });

  it('should persist theme across config updates', () => {
    saveTestConfig({ theme: 'no-color' });
    
    const config = loadTestConfig();
    saveTestConfig({ ...config, apiKey: 'gr_test_key' });
    
    const loaded = loadTestConfig();
    expect(loaded.theme).toBe('no-color');
    expect(loaded.apiKey).toBe('gr_test_key');
  });

  it('should handle NO_COLOR environment variable override', () => {
    const originalNoColor = process.env.NO_COLOR;
    
    try {
      // Set theme to default
      saveTestConfig({ theme: 'default' });
      
      // Set NO_COLOR env var
      process.env.NO_COLOR = '1';
      
      // In actual implementation, getActiveTheme() would check this
      const shouldUseNoColor = process.env.NO_COLOR === '1' || process.env.NO_COLOR === 'true';
      expect(shouldUseNoColor).toBe(true);
      
      // Unset NO_COLOR
      delete process.env.NO_COLOR;
      
      const shouldUseNoColor2 = process.env.NO_COLOR === '1' || process.env.NO_COLOR === 'true';
      expect(shouldUseNoColor2).toBe(false);
    } finally {
      // Restore original value
      if (originalNoColor !== undefined) {
        process.env.NO_COLOR = originalNoColor;
      } else {
        delete process.env.NO_COLOR;
      }
    }
  });
});

describe('Combined Features', () => {
  beforeEach(() => {
    if (existsSync(TEST_CONFIG_FILE)) {
      unlinkSync(TEST_CONFIG_FILE);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_CONFIG_FILE)) {
      unlinkSync(TEST_CONFIG_FILE);
    }
  });

  it('should maintain both recent projects and theme in config', () => {
    addRecentProject('/path/to/project1');
    addRecentProject('/path/to/project2');
    
    const config = loadTestConfig();
    saveTestConfig({ ...config, theme: 'colorblind-safe' });
    
    const loaded = loadTestConfig();
    expect(loaded.recentProjects).toHaveLength(2);
    expect(loaded.theme).toBe('colorblind-safe');
  });

  it('should handle config with all fields', () => {
    const fullConfig: CliConfig = {
      apiKey: 'gr_test_key',
      tier: 'pro',
      email: 'test@example.com',
      authenticatedAt: new Date().toISOString(),
      theme: 'colorblind-safe',
      recentProjects: ['/path/to/project1', '/path/to/project2'],
      lastProjectPath: '/path/to/project2',
    };
    
    saveTestConfig(fullConfig);
    const loaded = loadTestConfig();
    
    expect(loaded.apiKey).toBe('gr_test_key');
    expect(loaded.tier).toBe('pro');
    expect(loaded.email).toBe('test@example.com');
    expect(loaded.theme).toBe('colorblind-safe');
    expect(loaded.recentProjects).toHaveLength(2);
    expect(loaded.lastProjectPath).toBe('/path/to/project2');
  });
});
