/**
 * Stub Detector Tests
 */

import { validateFileForStubs, validateFilesForStubs } from '../checks/stub-detector';

describe('validateFileForStubs', () => {
  describe('placeholder patterns', () => {
    it('should detect throw not implemented', () => {
      const content = `function doSomething() {
  throw new Error("not implemented");
}`;
      const result = validateFileForStubs(content, 'service.ts', 'build');
      expect(result.status).toBe('fail');
    });

    it('should detect lorem ipsum', () => {
      const content = `const description = "Lorem ipsum dolor sit amet";`;
      const result = validateFileForStubs(content, 'data.ts', 'build');
      expect(result.status).toBe('fail');
    });

    it('should detect fake data strings', () => {
      const content = `const email = "fake_email@example.com";`;
      const result = validateFileForStubs(content, 'mock.ts', 'build');
      expect(result.status).toBe('fail');
    });

    it('should detect console placeholder', () => {
      const content = `console.log("placeholder");`;
      const result = validateFileForStubs(content, 'handler.ts', 'build');
      expect(result.status).toBe('fail');
    });
  });

  describe('TODO/FIXME handling', () => {
    it('should warn about TODO in build mode', () => {
      const content = `// TODO: implement this feature
function feature() {}`;
      const result = validateFileForStubs(content, 'feature.ts', 'build');
      expect(result.status).toBe('pass'); // intent-aware in build mode
    });

    it('should fail TODO in ship mode', () => {
      const content = `// TODO: implement this feature
function feature() {}`;
      const result = validateFileForStubs(content, 'feature.ts', 'ship');
      expect(result.status).toBe('fail');
    });

    it('should warn about FIXME in build mode', () => {
      const content = `// FIXME: this is broken`;
      const result = validateFileForStubs(content, 'broken.ts', 'build');
      expect(result.status).toBe('pass'); // intent-aware in build mode
    });
  });

  describe('context-aware detection', () => {
    it('should allow mocks in test files', () => {
      const content = `const mockData = { name: "test" };`;
      const result = validateFileForStubs(content, 'service.test.ts', 'build');
      expect(result.status).toBe('pass');
    });

    it('should allow mocks in __tests__ directory', () => {
      const content = `const mockUser = { id: 1, name: "Test User" };`;
      const result = validateFileForStubs(content, '__tests__/user.test.ts', 'build');
      expect(result.status).toBe('pass');
    });

    it('should allow fake data in fixtures', () => {
      const content = `const email = "fake@example.com";`;
      const result = validateFileForStubs(content, 'fixtures/users.ts', 'build');
      expect(result.status).toBe('pass');
    });

    it('should allow TODO in explore mode', () => {
      const content = `// TODO: add more features`;
      const result = validateFileForStubs(content, 'feature.ts', 'explore');
      expect(result.status).toBe('pass');
    });
  });

  describe('Rust/Python patterns', () => {
    it('should detect unimplemented! macro', () => {
      const content = `fn process() { unimplemented!() }`;
      const result = validateFileForStubs(content, 'lib.rs', 'build');
      expect(result.status).toBe('fail');
    });

    it('should detect todo! macro', () => {
      const content = `fn process() { todo!() }`;
      const result = validateFileForStubs(content, 'lib.rs', 'build');
      expect(result.status).toBe('fail');
    });

    it('should detect Python NotImplementedError', () => {
      const content = `def process():
    raise NotImplementedError`;
      const result = validateFileForStubs(content, 'service.py', 'build');
      expect(result.status).toBe('fail');
    });
  });
});

describe('validateFilesForStubs', () => {
  it('should pass when no problematic stubs', () => {
    const result = validateFilesForStubs([
      { path: 'index.ts', content: 'export const main = () => console.log("hello");' },
    ], 'build');
    expect(result.status).toBe('pass');
  });

  it('should fail when placeholder stubs found', () => {
    const result = validateFilesForStubs([
      { path: 'service.ts', content: 'throw new Error("not implemented");' },
    ], 'build');
    expect(result.status).toBe('fail');
  });

  it('should warn in build mode for TODOs', () => {
    const result = validateFilesForStubs([
      { path: 'feature.ts', content: '// TODO: add feature' },
    ], 'build');
    expect(result.status).toBe('pass'); // TODOs allowed in build mode
  });
});
