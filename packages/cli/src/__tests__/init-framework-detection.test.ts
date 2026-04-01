/**
 * Tests for framework detection
 */

import { detectFramework, formatFrameworkName, type DetectedFramework } from '../init/detect-framework';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Framework Detection', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'guardrail-framework-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('detectFramework', () => {
    describe('Next.js Detection', () => {
      it('should detect Next.js from next dependency', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test-nextjs',
            dependencies: { next: '^14.0.0', react: '^18.0.0' },
          }),
          'utf-8'
        );

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('nextjs');
        expect(result.confidence).toBe('high');
        expect(result.signals).toContain('next dependency found in package.json');
        expect(result.recommendedScans).toContain('secrets');
        expect(result.recommendedScans).toContain('reality');
      });

      it('should detect Next.js from next.config.js', () => {
        writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');
        writeFileSync(join(tempDir, 'next.config.js'), 'module.exports = {}', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('nextjs');
        expect(result.confidence).toBe('high');
        expect(result.signals).toContain('next.config.* file found');
      });

      it('should detect Next.js from app directory structure', () => {
        writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');
        mkdirSync(join(tempDir, 'app'), { recursive: true });
        writeFileSync(join(tempDir, 'app', 'layout.tsx'), 'export default function Layout() {}', 'utf-8');
        writeFileSync(join(tempDir, 'app', 'page.tsx'), 'export default function Page() {}', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('nextjs');
        expect(result.signals.some(s => s.includes('app directory'))).toBe(true);
      });

      it('should detect Next.js from pages directory', () => {
        writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');
        mkdirSync(join(tempDir, 'pages'), { recursive: true });
        writeFileSync(join(tempDir, 'pages', '_app.tsx'), 'export default function App() {}', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('nextjs');
        expect(result.signals.some(s => s.includes('pages directory'))).toBe(true);
      });
    });

    describe('Express Detection', () => {
      it('should detect Express from dependency', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test-express',
            dependencies: { express: '^4.18.0' },
          }),
          'utf-8'
        );

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('express');
        expect(result.confidence).toBe('high');
        expect(result.signals).toContain('express dependency found in package.json');
        expect(result.recommendedScans).toContain('compliance');
      });

      it('should detect Express from src/server.ts pattern', () => {
        writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');
        mkdirSync(join(tempDir, 'src'), { recursive: true });
        writeFileSync(join(tempDir, 'src', 'server.ts'), 'const app = express();', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('express');
        expect(result.signals.some(s => s.includes('src/server.*'))).toBe(true);
      });

      it('should detect Express from routes directory', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({ name: 'test', dependencies: {} }),
          'utf-8'
        );
        mkdirSync(join(tempDir, 'routes'), { recursive: true });
        writeFileSync(join(tempDir, 'routes', 'api.js'), '', 'utf-8');
        writeFileSync(join(tempDir, 'app.js'), 'const app = express();', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('express');
      });
    });

    describe('NestJS Detection', () => {
      it('should detect NestJS from @nestjs/core dependency', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test-nestjs',
            dependencies: { '@nestjs/core': '^10.0.0', '@nestjs/common': '^10.0.0' },
          }),
          'utf-8'
        );

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('nestjs');
        expect(result.confidence).toBe('high');
        expect(result.signals).toContain('@nestjs/core dependency found');
      });

      it('should detect NestJS from nest-cli.json', () => {
        writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');
        writeFileSync(join(tempDir, 'nest-cli.json'), '{}', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('nestjs');
        expect(result.confidence).toBe('high');
      });

      it('should detect NestJS from module files', () => {
        writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');
        mkdirSync(join(tempDir, 'src'), { recursive: true });
        writeFileSync(join(tempDir, 'src', 'app.module.ts'), '@Module({})', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('nestjs');
        expect(result.signals.some(s => s.includes('module files'))).toBe(true);
      });
    });

    describe('Fastify Detection', () => {
      it('should detect Fastify from dependency', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test-fastify',
            dependencies: { fastify: '^4.0.0' },
          }),
          'utf-8'
        );

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('fastify');
        expect(result.confidence).toBe('high');
        expect(result.signals).toContain('fastify dependency found in package.json');
      });

      it('should detect Fastify ecosystem packages', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            dependencies: { '@fastify/autoload': '^5.0.0' },
          }),
          'utf-8'
        );

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('fastify');
        expect(result.signals.some(s => s.includes('ecosystem'))).toBe(true);
      });
    });

    describe('Remix Detection', () => {
      it('should detect Remix from @remix-run packages', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test-remix',
            dependencies: { '@remix-run/node': '^2.0.0', '@remix-run/react': '^2.0.0' },
          }),
          'utf-8'
        );

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('remix');
        expect(result.confidence).toBe('high');
        expect(result.signals).toContain('@remix-run packages found in package.json');
      });

      it('should detect Remix from remix.config.js', () => {
        writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');
        writeFileSync(join(tempDir, 'remix.config.js'), 'module.exports = {}', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('remix');
        expect(result.confidence).toBe('high');
      });

      it('should detect Remix from app/routes directory', () => {
        writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');
        mkdirSync(join(tempDir, 'app', 'routes'), { recursive: true });
        writeFileSync(join(tempDir, 'app', 'routes', '_index.tsx'), '', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('remix');
        expect(result.signals.some(s => s.includes('app/routes'))).toBe(true);
      });
    });

    describe('Vite + React Detection', () => {
      it('should detect Vite + React from dependencies', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test-vite',
            dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
            devDependencies: { vite: '^5.0.0' },
          }),
          'utf-8'
        );

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('vite-react');
        expect(result.confidence).toBe('high');
        expect(result.signals).toContain('vite + react dependencies found');
      });

      it('should detect Vite + React from vite.config.ts and plugin', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            devDependencies: { '@vitejs/plugin-react': '^4.0.0' },
          }),
          'utf-8'
        );
        writeFileSync(join(tempDir, 'vite.config.ts'), 'export default {}', 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('vite-react');
        expect(result.confidence).toBe('high');
      });
    });

    describe('Unknown Framework', () => {
      it('should return unknown for empty project', () => {
        writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('unknown');
        expect(result.confidence).toBe('low');
        expect(result.recommendedScans).toContain('secrets');
        expect(result.recommendedScans).toContain('vuln');
      });

      it('should return unknown for project without package.json', () => {
        const result = detectFramework(tempDir);

        expect(result.framework).toBe('unknown');
        expect(result.confidence).toBe('low');
      });
    });

    describe('Framework Priority', () => {
      it('should prioritize NestJS over Express when both present', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            dependencies: {
              express: '^4.18.0',
              '@nestjs/core': '^10.0.0',
              '@nestjs/common': '^10.0.0',
            },
          }),
          'utf-8'
        );

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('nestjs');
      });

      it('should prioritize Next.js over Vite+React when both present', () => {
        writeFileSync(
          join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'test',
            dependencies: {
              next: '^14.0.0',
              react: '^18.0.0',
            },
            devDependencies: {
              vite: '^5.0.0',
            },
          }),
          'utf-8'
        );

        const result = detectFramework(tempDir);

        expect(result.framework).toBe('nextjs');
      });
    });
  });

  describe('formatFrameworkName', () => {
    it('should format framework names correctly', () => {
      const testCases: Array<[DetectedFramework, string]> = [
        ['nextjs', 'Next.js'],
        ['express', 'Express.js'],
        ['nestjs', 'NestJS'],
        ['fastify', 'Fastify'],
        ['remix', 'Remix'],
        ['vite-react', 'Vite + React'],
        ['unknown', 'Unknown'],
      ];

      for (const [framework, expected] of testCases) {
        expect(formatFrameworkName(framework)).toBe(expected);
      }
    });
  });

  describe('Recommended Scans', () => {
    it('should recommend reality mode for Next.js', () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ dependencies: { next: '^14.0.0' } }),
        'utf-8'
      );

      const result = detectFramework(tempDir);

      expect(result.recommendedScans).toContain('reality');
    });

    it('should recommend compliance for Express', () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.18.0' } }),
        'utf-8'
      );

      const result = detectFramework(tempDir);

      expect(result.recommendedScans).toContain('compliance');
    });

    it('should always recommend secrets and vuln scans', () => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');

      const result = detectFramework(tempDir);

      expect(result.recommendedScans).toContain('secrets');
      expect(result.recommendedScans).toContain('vuln');
    });
  });
});
