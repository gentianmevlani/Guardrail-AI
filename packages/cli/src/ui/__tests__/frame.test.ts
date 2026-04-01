/**
 * Snapshot tests for CLI header frame rendering.
 * 
 * Tests cover:
 * - Standard color output
 * - NO_COLOR mode (ANSI stripped)
 * - Long project names (border alignment)
 */

import { 
  renderCommandHeader, 
  frameLines, 
  stripAnsi, 
  isNoColor,
  padRight,
} from '../frame';

describe('frame utilities', () => {
  describe('stripAnsi', () => {
    it('should strip ANSI escape codes', () => {
      const input = '\x1b[96m\x1b[1mHello\x1b[0m World';
      expect(stripAnsi(input)).toBe('Hello World');
    });

    it('should return plain text unchanged', () => {
      const input = 'Hello World';
      expect(stripAnsi(input)).toBe('Hello World');
    });
  });

  describe('padRight', () => {
    it('should pad string to specified width', () => {
      expect(padRight('test', 10)).toBe('test      ');
    });

    it('should handle ANSI codes when calculating padding', () => {
      const input = '\x1b[1mtest\x1b[0m';
      const result = padRight(input, 10);
      expect(stripAnsi(result)).toBe('test      ');
    });

    it('should not pad if string exceeds width', () => {
      expect(padRight('toolongstring', 5)).toBe('toolongstring');
    });
  });

  describe('frameLines', () => {
    it('should create framed output', () => {
      const lines = ['Line 1', 'Line 2'];
      const result = frameLines(lines);
      
      expect(result.length).toBe(4); // top + 2 lines + bottom
<<<<<<< HEAD
      expect(stripAnsi(result[0]!)).toContain('╔');
      expect(stripAnsi(result[result.length - 1]!)).toContain('╚');
=======
      expect(stripAnsi(result[0])).toContain('╔');
      expect(stripAnsi(result[result.length - 1])).toContain('╚');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should handle title option', () => {
      const lines = ['Content'];
      const result = frameLines(lines, { title: 'Title' });
      
      expect(result.length).toBe(5); // top + title + empty + content + bottom
    });

    it('should maintain consistent border width with long content', () => {
      const longLine = 'A'.repeat(100);
      const result = frameLines([longLine, 'short']);
      
<<<<<<< HEAD
      const topWidth = stripAnsi(result[0]!).length;
      const bottomWidth = stripAnsi(result[result.length - 1]!).length;
=======
      const topWidth = stripAnsi(result[0]).length;
      const bottomWidth = stripAnsi(result[result.length - 1]).length;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      
      expect(topWidth).toBe(bottomWidth);
    });
  });
});

describe('renderCommandHeader', () => {
  const baseOptions = {
    title: 'CODE SMELL ANALYSIS',
    icon: '👃',
    projectName: 'my-project',
    projectPath: '/path/to/my-project',
  };

  describe('with color', () => {
    beforeEach(() => {
      delete process.env.NO_COLOR;
      delete process.env.GUARDRAIL_NO_COLOR;
    });

    it('should render header with ANSI colors', () => {
      const result = renderCommandHeader(baseOptions);
      
      expect(result).toContain('\x1b['); // Contains ANSI codes
      expect(result).toContain('CODE SMELL ANALYSIS');
      expect(result).toContain('my-project');
    });

    it('should match snapshot with color', () => {
      const result = renderCommandHeader(baseOptions);
      const normalized = result.replace(/\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} [AP]M/g, 'MM/DD/YYYY, HH:MM:SS AM');
      
      expect(normalized).toMatchSnapshot('header-with-color');
    });

    it('should include tier badge when authenticated', () => {
      const result = renderCommandHeader({
        ...baseOptions,
        tier: 'pro',
        authenticated: true,
      });
      
      expect(result).toContain('PRO');
    });

    it('should include metadata lines', () => {
      const result = renderCommandHeader({
        ...baseOptions,
        metadata: [
          { key: 'Severity', value: 'high' },
          { key: 'Mode', value: 'strict' },
        ],
      });
      
      expect(result).toContain('Severity');
      expect(result).toContain('high');
      expect(result).toContain('Mode');
      expect(result).toContain('strict');
    });
  });

  describe('NO_COLOR mode', () => {
    beforeEach(() => {
      process.env.NO_COLOR = '1';
    });

    afterEach(() => {
      delete process.env.NO_COLOR;
    });

    it('should render header without ANSI codes', () => {
      const result = renderCommandHeader(baseOptions);
      
      expect(result).not.toContain('\x1b[');
      expect(result).toContain('CODE SMELL ANALYSIS');
      expect(result).toContain('my-project');
    });

    it('should match snapshot in NO_COLOR mode', () => {
      const result = renderCommandHeader(baseOptions);
      const normalized = result.replace(/\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} [AP]M/g, 'MM/DD/YYYY, HH:MM:SS AM');
      
      expect(normalized).toMatchSnapshot('header-no-color');
    });

    it('should render tier badge without ANSI', () => {
      const result = renderCommandHeader({
        ...baseOptions,
        tier: 'pro',
        authenticated: true,
      });
      
      expect(result).not.toContain('\x1b[');
      expect(result).toContain('[PRO]');
    });
  });

  describe('long project names', () => {
    it('should handle very long project names without border drift', () => {
      const longName = 'my-extremely-long-project-name-that-exceeds-normal-lengths';
      const result = renderCommandHeader({
        ...baseOptions,
        projectName: longName,
      });
      
      const lines = result.split('\n');
<<<<<<< HEAD
      const topBorder = stripAnsi(lines[0]!);
      const bottomBorder = stripAnsi(lines[lines.length - 1]!);
=======
      const topBorder = stripAnsi(lines[0]);
      const bottomBorder = stripAnsi(lines[lines.length - 1]);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      
      // Borders should have same width
      expect(topBorder.length).toBe(bottomBorder.length);
      
      // All content lines should have same visible width
      const contentLines = lines.slice(1, -1);
      const widths = contentLines.map(l => stripAnsi(l).length);
      const uniqueWidths = [...new Set(widths)];
      
      expect(uniqueWidths.length).toBe(1);
    });

    it('should match snapshot with long project name', () => {
      const longName = 'my-extremely-long-project-name-that-exceeds-normal-display-widths-and-tests-alignment';
      const result = renderCommandHeader({
        ...baseOptions,
        projectName: longName,
        projectPath: '/very/long/path/to/the/project/directory/that/is/really/quite/long/indeed',
      });
      const normalized = result.replace(/\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} [AP]M/g, 'MM/DD/YYYY, HH:MM:SS AM');
      
      expect(normalized).toMatchSnapshot('header-long-project-name');
    });

    it('should truncate very long paths', () => {
      const longPath = '/a'.repeat(100);
      const result = renderCommandHeader({
        ...baseOptions,
        projectPath: longPath,
      });
      
      // Path should be truncated (contains ...)
      expect(result).toContain('...');
    });
  });

  describe('--no-color flag', () => {
    const originalArgv = process.argv;

    beforeEach(() => {
      process.argv = [...originalArgv, '--no-color'];
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    it('should respect --no-color command line flag', () => {
      const result = renderCommandHeader(baseOptions);
      
      expect(result).not.toContain('\x1b[');
    });
  });
});
