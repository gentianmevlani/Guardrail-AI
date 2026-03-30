/**
 * FakeFeaturesEngine v2.0 — Detects placeholder, stub, and fake implementations
 * that AI models commonly generate as scaffolding but never complete.
 *
 * Detection categories:
 *   FAKE001 — Dead UI elements (empty containers, disabled buttons)
 *   FAKE002 — Fake async/loading (setTimeout delays, hardcoded loading states)
 *   FAKE003 — Placeholder content (TODO text, lorem ipsum, placeholder images)
 *   FAKE004 — Empty/noop handlers (onClick={() => {}}, empty catch blocks)
 *   FAKE005 — Hardcoded mock data in non-test files
 *   FAKE006 — Stub implementations (throw "Not implemented", return null)
 *   FAKE007 — Dead code paths (if (false), unreachable code)
 *   FAKE008 — Fake auth/authorization (hardcoded roles, bypassed checks)
 *
 * Latency target: <40ms per file
 */

import { createHash } from 'crypto';
import type { Finding, DeltaContext, ScanEngine, EngineId, Severity } from './core-types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FakePattern {
  name: string;
  ruleId: string;
  regex: RegExp;
  severity: Severity;
  message: string;
  suggestion: string;
  /** Confidence 0–100 */
  confidence: number;
  /** Only match in these file extensions (e.g. ['.tsx', '.jsx']). If undefined, match all. */
  extensions?: string[];
  /** Custom validator: return false to skip this match (reduce FPs). */
  validate?: (line: string, lines: string[], index: number, filePath: string) => boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTestFile(uri: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(uri) ||
    /(?:^|\/)(?:__tests__|__mocks__|tests?|fixtures?|e2e|spec|cypress|playwright|__snapshots__|stubs?|mocks?)\//i.test(uri);
}

function isStoryFile(uri: string): boolean {
  return /\.stories\.(ts|tsx|js|jsx|mdx)$/i.test(uri);
}

function isConfigFile(uri: string): boolean {
  return /(?:\.config\.|\.rc\.|jest\.|vite\.|next\.|tailwind\.|postcss\.|babel\.|tsconfig|webpack|rollup|eslint|prettier)/i.test(uri);
}

function isSeedOrFixtureFile(uri: string): boolean {
  return /(?:seed|fixture|mock|fake|factory|stub|sample|demo|example)/i.test(
    uri.split('/').pop() ?? ''
  );
}

function isComponentFile(uri: string): boolean {
  return /\.(tsx|jsx)$/i.test(uri);
}

function deterministicId(uri: string, line: number, ruleId: string, evidence: string): string {
  const input = `fake:${uri}::${line}::${ruleId}::${evidence}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `fake-${hash.toString(16).padStart(8, '0')}`;
}

/** Check if a line is inside a JSX comment {/* ... *​/} or HTML comment */
function isCommentLine(trimmed: string): boolean {
  return trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('{/*');
}

/** Check surrounding lines for context clues */
function hasSurroundingContext(
  lines: string[],
  index: number,
  radius: number,
  pattern: RegExp,
): boolean {
  for (let j = Math.max(0, index - radius); j <= Math.min(lines.length - 1, index + radius); j++) {
    if (j === index) continue;
    if (pattern.test(lines[j]!)) return true;
  }
  return false;
}

// ─── Pattern Database ─────────────────────────────────────────────────────────

const PATTERNS: FakePattern[] = [
  // ════════════════════════════════════════════════════════════════════════════
  // FAKE001 — Dead UI Elements
  // ════════════════════════════════════════════════════════════════════════════
  {
    name: 'dead-ui-empty-div',
    ruleId: 'FAKE001',
    regex: /<div\s*(?:className=['"]\w*['"])?\s*>\s*<\/div>/,
    severity: 'low',
    message: 'Empty <div> with no content — dead UI placeholder',
    suggestion: 'Add meaningful content or remove if unused.',
    confidence: 82,
    extensions: ['.tsx', '.jsx', '.html'],
    validate: (line) => {
      // Allow empty divs used as spacers/dividers with explicit classes
      if (/className=["'](?:.*(?:spacer|divider|separator|gap|clearfix|break).*)['"]/i.test(line)) return false;
      // Allow styled empty divs (CSS-in-JS with height/width)
      if (/style=\{\{.*(?:height|width|flex|grid)/i.test(line)) return false;
      return true;
    },
  },
  {
    name: 'dead-ui-empty-section',
    ruleId: 'FAKE001',
    regex: /<(section|article|main|aside|nav|header|footer)(\s[^>]*)?\s*>\s*<\/\1>/,
    severity: 'medium',
    message: 'Empty semantic HTML element — likely incomplete implementation',
    suggestion: 'Add content to this section or remove the placeholder element.',
    confidence: 88,
    extensions: ['.tsx', '.jsx', '.html'],
  },
  {
    name: 'dead-ui-empty-button',
    ruleId: 'FAKE001',
    regex: /<button[^>]*disabled[^>]*>\s*<\/button>/,
    severity: 'low',
    message: 'Disabled button with no content — placeholder UI',
    suggestion: 'Add button text/icon and implement the handler, or remove.',
    confidence: 80,
    extensions: ['.tsx', '.jsx', '.html'],
  },
  {
    name: 'dead-ui-hidden-always',
    ruleId: 'FAKE001',
    regex: /style=\{\{\s*(?:display:\s*['"]none['"]|visibility:\s*['"]hidden['"])\s*\}\}/,
    severity: 'low',
    message: 'Element permanently hidden via inline style — dead UI',
    suggestion: 'Use conditional rendering instead of hiding elements permanently.',
    confidence: 72,
    extensions: ['.tsx', '.jsx'],
    validate: (line, lines, index) => {
      // Skip if there's a toggle mechanism nearby
      if (hasSurroundingContext(lines, index, 5, /(?:isVisible|isOpen|isShown|show|toggle|hidden)\s*[?:&|=]/)) return false;
      return true;
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // FAKE002 — Fake Async / Loading
  // ════════════════════════════════════════════════════════════════════════════
  {
    name: 'fake-loading-setTimeout',
    ruleId: 'FAKE002',
    regex: /setTimeout\s*\(\s*(?:\(\)\s*=>|function\s*\()\s*\{[^}]*(?:setLoading|setIsLoading|loading\s*=|isLoading\s*=)[^}]*\}\s*,\s*\d+\s*\)/,
    severity: 'high',
    message: 'setTimeout used to simulate loading state — fake async operation',
    suggestion: 'Replace with real data fetching (fetch, SWR, React Query, or server action).',
    confidence: 92,
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
  },
  {
    name: 'fake-loading-comment',
    ruleId: 'FAKE002',
    regex: /setTimeout\s*\([\s\S]*?,\s*\d+\s*\)\s*;?\s*\/\/\s*(?:simul|fake|placeholder|mock|todo|hack|temporary|temp\b)/i,
    severity: 'high',
    message: 'setTimeout with comment admitting it\'s fake/temporary',
    suggestion: 'Replace with real async loading (fetch, suspense, or data loader).',
    confidence: 95,
    validate: (line, lines, index, filePath) => !isTestFile(filePath),
  },
  {
    name: 'fake-delay-sleep',
    ruleId: 'FAKE002',
    regex: /await\s+new\s+Promise\s*\(\s*(?:resolve|r)\s*=>\s*setTimeout\s*\(\s*(?:resolve|r)\s*,\s*\d+\s*\)\s*\)/,
    severity: 'medium',
    message: 'Artificial delay via Promise + setTimeout — likely placeholder for real async',
    suggestion: 'Replace with actual async operation or remove the delay.',
    confidence: 80,
    validate: (line, lines, index) => {
      // Allow in retry/backoff/rate-limit contexts
      if (hasSurroundingContext(lines, index, 5, /(?:retry|backoff|rate.?limit|throttle|debounce|poll)/i)) return false;
      return true;
    },
  },
  {
    name: 'fake-interval-loading',
    ruleId: 'FAKE002',
    regex: /setInterval\s*\([^)]*(?:progress|percent|loading|count)[^)]*,\s*\d+\s*\)/i,
    severity: 'medium',
    message: 'setInterval incrementing progress/loading — fake progress bar',
    suggestion: 'Track real progress from your async operation instead of faking it.',
    confidence: 82,
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // FAKE003 — Placeholder Content
  // ════════════════════════════════════════════════════════════════════════════
  {
    name: 'placeholder-text-jsx',
    ruleId: 'FAKE003',
    regex: />\s*(?:TODO|PLACEHOLDER|FIXME|HACK|XXX|Coming\s+soon|Not\s+(?:yet\s+)?implemented|Under\s+construction|Work\s+in\s+progress|Lorem\s+ipsum)\s*</i,
    severity: 'medium',
    message: 'Placeholder text rendered in UI — incomplete implementation',
    suggestion: 'Replace with real content or remove the element.',
    confidence: 90,
    extensions: ['.tsx', '.jsx', '.html'],
  },
  {
    name: 'placeholder-string-literal',
    ruleId: 'FAKE003',
    regex: /['"`](?:Coming\s+soon|Not\s+(?:yet\s+)?implemented|Under\s+construction|TBD|N\/A|Work\s+in\s+progress|Placeholder|Sample\s+(?:text|data|content))['"`]/i,
    severity: 'low',
    message: 'Placeholder string literal — likely incomplete feature',
    suggestion: 'Implement the feature or remove the placeholder.',
    confidence: 85,
    validate: (line) => {
      // Skip if in a comment
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return false;
      // Skip if it's a test description
      if (/(?:it|test|describe|expect)\s*\(/.test(line)) return false;
      return true;
    },
  },
  {
    name: 'placeholder-image',
    ruleId: 'FAKE003',
    regex: /['"`]https?:\/\/(?:via\.placeholder\.com|placehold\.(?:it|co)|placekitten\.com|picsum\.photos|dummyimage\.com|fakeimg\.pl|placeholder\.pics|loremflickr\.com)[^'"`]*['"`]/i,
    severity: 'medium',
    message: 'Placeholder image URL — replace with real assets',
    suggestion: 'Use actual images from your assets, CDN, or CMS.',
    confidence: 92,
  },
  {
    name: 'lorem-ipsum',
    ruleId: 'FAKE003',
    regex: /lorem\s+ipsum\s+dolor\s+sit\s+amet/i,
    severity: 'medium',
    message: 'Lorem ipsum placeholder text in source code',
    suggestion: 'Replace with real content from your design system or CMS.',
    confidence: 95,
  },
  {
    name: 'placeholder-avatar',
    ruleId: 'FAKE003',
    regex: /['"`]https?:\/\/(?:i\.pravatar\.cc|randomuser\.me\/api\/portraits|ui-avatars\.com|robohash\.org|avatars\.dicebear\.com)[^'"`]*['"`]/i,
    severity: 'low',
    message: 'Placeholder avatar URL — replace with real user images',
    suggestion: 'Use your auth provider\'s avatar or a proper fallback (initials, default icon).',
    confidence: 82,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // FAKE004 — Empty / Noop Handlers
  // ════════════════════════════════════════════════════════════════════════════
  {
    name: 'noop-onclick',
    ruleId: 'FAKE004',
    regex: /on(?:Click|Press|Submit|Change|Input|Focus|Blur|Select|Toggle)\s*=\s*\{\s*\(\s*\)\s*=>\s*(?:\{\s*\}|null|undefined|void\s+0)\s*\}/,
    severity: 'medium',
    message: 'Noop event handler — button/element does nothing when interacted with',
    suggestion: 'Implement the handler or remove the element if it\'s not functional.',
    confidence: 90,
    extensions: ['.tsx', '.jsx'],
  },
  {
    name: 'noop-onclick-function',
    ruleId: 'FAKE004',
    regex: /on(?:Click|Press|Submit|Change)\s*=\s*\{\s*function\s*\(\)\s*\{\s*\}\s*\}/,
    severity: 'medium',
    message: 'Empty function event handler — element does nothing',
    suggestion: 'Implement the event handler or remove the interactive element.',
    confidence: 88,
    extensions: ['.tsx', '.jsx'],
  },
  {
    name: 'empty-catch-block',
    ruleId: 'FAKE004',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
    severity: 'high',
    message: 'Empty catch block — errors are silently swallowed',
    suggestion: 'Log the error, re-throw, or handle it. Silent catch blocks hide bugs.',
    confidence: 88,
    validate: (line, lines, index) => {
      // Check if it's a single-line catch with body on next line
      const nextLine = lines[index + 1]?.trim() ?? '';
      if (nextLine && nextLine !== '}') return false;
      // Allow expected-error patterns in tests
      if (/expect\w*Error|shouldThrow|assertThrows/i.test(lines[index - 1] ?? '')) return false;
      return true;
    },
  },
  {
    name: 'empty-catch-comment',
    ruleId: 'FAKE004',
    regex: /catch\s*\([^)]*\)\s*\{\s*\/\/\s*(?:todo|ignore|intentional|swallow|suppress|noop|no-op)/i,
    severity: 'medium',
    message: 'Catch block with only a TODO/ignore comment — error handling incomplete',
    suggestion: 'Implement proper error handling: log, report to error tracker, or handle gracefully.',
    confidence: 85,
  },
  {
    name: 'empty-then-catch',
    ruleId: 'FAKE004',
    regex: /\.catch\s*\(\s*(?:\(\)\s*=>\s*(?:\{\s*\}|null|undefined)|function\s*\(\)\s*\{\s*\})\s*\)/,
    severity: 'high',
    message: 'Promise .catch() with empty handler — errors silently discarded',
    suggestion: 'Handle the error: .catch(err => { logger.error(err); })',
    confidence: 90,
  },
  {
    name: 'noop-useeffect',
    ruleId: 'FAKE004',
    regex: /useEffect\s*\(\s*\(\)\s*=>\s*\{\s*\}\s*(?:,\s*\[[^\]]*\])?\s*\)/,
    severity: 'medium',
    message: 'Empty useEffect — does nothing',
    suggestion: 'Add the side effect logic or remove the empty useEffect.',
    confidence: 92,
    extensions: ['.tsx', '.jsx'],
  },
  {
    name: 'noop-usecallback',
    ruleId: 'FAKE004',
    regex: /useCallback\s*\(\s*\(\)\s*=>\s*(?:\{\s*\}|null|undefined)\s*,\s*\[[^\]]*\]\s*\)/,
    severity: 'medium',
    message: 'Empty useCallback — memoizing a noop function',
    suggestion: 'Implement the callback or remove if unused.',
    confidence: 88,
    extensions: ['.tsx', '.jsx'],
  },

  // ════════════════════════════════════════════════════════════════════════════
  // FAKE005 — Hardcoded Mock Data (in non-test files)
  // ════════════════════════════════════════════════════════════════════════════
  {
    name: 'hardcoded-user-data',
    ruleId: 'FAKE005',
    regex: /(?:name|username|firstName|lastName)\s*:\s*['"`](?:John\s*(?:Doe|Smith)|Jane\s*(?:Doe|Smith)|Test\s*User|Admin\s*User|Bob|Alice|foo|bar)['"`]/i,
    severity: 'medium',
    message: 'Hardcoded fake user data — likely leftover from scaffolding',
    suggestion: 'Fetch real data from your API/database, or use a proper fixture/factory for tests.',
    confidence: 82,
    validate: (_line, _lines, _index, filePath) => !isSeedOrFixtureFile(filePath),
  },
  {
    name: 'hardcoded-test-email',
    ruleId: 'FAKE005',
    regex: /['"`](?:test|user|admin|example|john|jane|foo|bar|hello|info|noreply)@(?:example\.com|test\.com|email\.com|mail\.com|fake\.com|localhost)['"`]/i,
    severity: 'medium',
    message: 'Hardcoded test email address in non-test code',
    suggestion: 'Use a real email from your auth system or environment variables.',
    confidence: 85,
    validate: (_line, _lines, _index, filePath) => !isSeedOrFixtureFile(filePath),
  },
  {
    name: 'hardcoded-price',
    ruleId: 'FAKE005',
    regex: /(?:price|cost|amount|total)\s*[:=]\s*(?:9\.99|19\.99|29\.99|49\.99|99\.99|0\.99|1\.99|4\.99|100|999|1000)\b/i,
    severity: 'low',
    message: 'Hardcoded price value — likely placeholder from AI scaffolding',
    suggestion: 'Fetch pricing from your backend/database or use environment config.',
    confidence: 70,
    validate: (line, _lines, _index, filePath) => {
      if (isSeedOrFixtureFile(filePath)) return false;
      // Skip if in a constant declaration (intentional config)
      if (/(?:const|CONST|DEFAULT|MIN|MAX|BASE)_/i.test(line)) return false;
      return true;
    },
  },
  {
    name: 'hardcoded-mock-array',
    ruleId: 'FAKE005',
    regex: /(?:const|let)\s+(?:users|items|products|posts|todos|tasks|orders|comments|messages|notifications|data|list|results)\s*(?::\s*\w+(?:\[\])?\s*)?=\s*\[/i,
    severity: 'medium',
    message: 'Hardcoded data array in component — likely mock data from AI generation',
    suggestion: 'Fetch data from your API or database. Move test data to fixtures/factories.',
    confidence: 72,
    extensions: ['.tsx', '.jsx'],
    validate: (line, lines, index, filePath) => {
      if (isSeedOrFixtureFile(filePath)) return false;
      if (isConfigFile(filePath)) return false;
      // Check if the array has object-like elements (real mock data)
      const nextFewLines = lines.slice(index, index + 5).join(' ');
      if (/\[\s*\{/.test(nextFewLines)) return true;
      // Simple arrays of strings/numbers are likely constants, not mock data
      return false;
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // FAKE006 — Stub Implementations
  // ════════════════════════════════════════════════════════════════════════════
  {
    name: 'throw-not-implemented',
    ruleId: 'FAKE006',
    regex: /throw\s+new\s+Error\s*\(\s*['"`](?:Not\s+(?:yet\s+)?implemented|TODO|FIXME|STUB|Implement\s+(?:this|me)|Method\s+not\s+implemented|Feature\s+not\s+(?:yet\s+)?implemented|Not\s+supported\s+yet)['"`]\s*\)/i,
    severity: 'high',
    message: 'Stub implementation — throws "not implemented" error',
    suggestion: 'Implement this function or remove it if not needed.',
    confidence: 95,
  },
  {
    name: 'return-todo-comment',
    ruleId: 'FAKE006',
    regex: /return\s+(?:null|undefined|void\s+0|\[\]|\{\}|''|""|``|0|false)\s*;?\s*\/\/\s*(?:TODO|FIXME|HACK|TEMP|PLACEHOLDER|STUB|implement)/i,
    severity: 'high',
    message: 'Stub return with TODO comment — function body not implemented',
    suggestion: 'Implement the function logic or mark the entire function as deprecated.',
    confidence: 92,
  },
  {
    name: 'console-todo',
    ruleId: 'FAKE006',
    regex: /console\.(?:log|warn|info|error)\s*\(\s*['"`](?:TODO|FIXME|IMPLEMENT|NOT IMPLEMENTED|STUB|PLACEHOLDER|HACK)[^'"`]*['"`]\s*\)/i,
    severity: 'medium',
    message: 'Console message admitting TODO/stub — incomplete implementation',
    suggestion: 'Implement the feature and remove the debug console statement.',
    confidence: 90,
  },
  {
    name: 'alert-placeholder',
    ruleId: 'FAKE006',
    regex: /(?:window\.)?alert\s*\(\s*['"`](?:clicked|submitted|works|hello|test|todo|success|error|button pressed|form submitted|feature|saved)[^'"`]*['"`]\s*\)/i,
    severity: 'medium',
    message: 'alert() used instead of real UI feedback — placeholder interaction',
    suggestion: 'Replace with toast notification, modal, or proper UX feedback.',
    confidence: 88,
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
    validate: (_line, _lines, _index, filePath) => !isTestFile(filePath),
  },
  {
    name: 'empty-function-body',
    ruleId: 'FAKE006',
    regex: /(?:async\s+)?(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)\s*\{\s*\}/,
    severity: 'low',
    message: 'Empty function body — stub implementation',
    suggestion: 'Implement the function or remove if unused.',
    confidence: 72,
    validate: (line, lines, index, filePath) => {
      if (isConfigFile(filePath)) return false;
      // Skip lifecycle / interface stubs (ngOnInit, componentDidMount, etc.)
      if (/(?:ngOnInit|ngOnDestroy|componentDidMount|componentWillUnmount|connectedCallback|disconnectedCallback)\b/.test(line)) return false;
      // Skip noop-by-design patterns
      if (/(?:noop|NOOP|noOp|NO_OP|placeholder|abstract)\b/i.test(line)) return false;
      return true;
    },
  },
  {
    name: 'class-method-not-implemented',
    ruleId: 'FAKE006',
    regex: /(?:async\s+)?\w+\s*\([^)]*\)\s*(?::\s*\w+[^{]*)?\{\s*(?:\/\/\s*(?:TODO|FIXME|implement)|throw\s+new\s+Error\s*\(\s*['"`])/i,
    severity: 'high',
    message: 'Class method with TODO comment or throws not-implemented',
    suggestion: 'Implement this method or mark the class as abstract.',
    confidence: 88,
    validate: (line) => {
      // Must look like a method (not a function declaration)
      if (/^(?:export\s+)?(?:async\s+)?function\s/.test(line.trim())) return false;
      return true;
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // FAKE007 — Dead Code Paths
  // ════════════════════════════════════════════════════════════════════════════
  {
    name: 'if-false-block',
    ruleId: 'FAKE007',
    regex: /if\s*\(\s*false\s*\)\s*\{/,
    severity: 'medium',
    message: 'if (false) — dead code that will never execute',
    suggestion: 'Remove the dead code block entirely.',
    confidence: 95,
  },
  {
    name: 'if-true-block',
    ruleId: 'FAKE007',
    regex: /if\s*\(\s*true\s*\)\s*\{/,
    severity: 'low',
    message: 'if (true) — condition is always true, can be simplified',
    suggestion: 'Remove the if wrapper and keep the block contents.',
    confidence: 90,
    validate: (line) => {
      // Skip debug/feature flag patterns
      if (/(?:DEBUG|FEATURE|FLAG|ENABLE|DISABLE|FORCE)/i.test(line)) return false;
      return true;
    },
  },
  {
    name: 'hardcoded-feature-flag-false',
    ruleId: 'FAKE007',
    regex: /(?:const|let|var)\s+(?:is\w+Enabled|enable\w+|show\w+|use\w+Feature|feature\w+|has\w+|allow\w+)\s*(?::\s*boolean\s*)?=\s*false\s*;/i,
    severity: 'medium',
    message: 'Feature flag hardcoded to false — feature is permanently disabled',
    suggestion: 'Use a feature flag service (LaunchDarkly, Unleash) or environment variable, or remove the dead feature.',
    confidence: 78,
    validate: (line, lines, index) => {
      // Skip if toggled elsewhere
      if (hasSurroundingContext(lines, index, 10, /(?:process\.env|config\.|getFlag|featureFlag)/i)) return false;
      return true;
    },
  },
  {
    name: 'commented-out-code-block',
    ruleId: 'FAKE007',
    regex: /^\s*\/\/\s*(?:const|let|var|function|class|import|export|return|if|for|while|switch|try)\s+\w/,
    severity: 'low',
    message: 'Commented-out code — use version control instead',
    suggestion: 'Delete commented-out code. Use git history to recover if needed.',
    confidence: 70,
    validate: (line, lines, index) => {
      // Only flag if there are 3+ consecutive commented-out code lines
      let count = 0;
      for (let j = index; j < Math.min(lines.length, index + 5); j++) {
        if (/^\s*\/\/\s*(?:const|let|var|function|class|import|export|return|if|for|while|switch|try|await|\.)\s*/.test(lines[j]!)) {
          count++;
        } else {
          break;
        }
      }
      return count >= 3;
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // FAKE008 — Fake Auth / Authorization
  // ════════════════════════════════════════════════════════════════════════════
  {
    name: 'hardcoded-auth-true',
    ruleId: 'FAKE008',
    regex: /(?:const|let|var)\s+(?:isAuthenticated|isLoggedIn|isAuthorized|isAdmin|isAuthed|loggedIn|authenticated)\s*(?::\s*boolean\s*)?=\s*true\s*;/i,
    severity: 'critical',
    message: 'Authentication/authorization hardcoded to true — bypasses security',
    suggestion: 'Use your auth provider (NextAuth, Clerk, Auth0) to check auth state properly.',
    confidence: 92,
    validate: (_line, _lines, _index, filePath) => !isTestFile(filePath) && !isSeedOrFixtureFile(filePath),
  },
  {
    name: 'hardcoded-role',
    ruleId: 'FAKE008',
    regex: /(?:const|let|var)\s+(?:role|userRole|currentRole)\s*(?::\s*string\s*)?=\s*['"`](?:admin|superadmin|root|owner|manager)['"`]\s*;/i,
    severity: 'critical',
    message: 'User role hardcoded to privileged value — authorization bypass',
    suggestion: 'Fetch the user role from your auth session/token, never hardcode it.',
    confidence: 90,
    validate: (_line, _lines, _index, filePath) => !isTestFile(filePath) && !isSeedOrFixtureFile(filePath),
  },
  {
    name: 'hardcoded-token',
    ruleId: 'FAKE008',
    regex: /(?:const|let|var)\s+(?:token|authToken|accessToken|jwt|bearer|apiKey|sessionId)\s*=\s*['"`](?:eyJ|sk-|pk-|Bearer\s|token_)[^'"`]{10,}['"`]/i,
    severity: 'critical',
    message: 'Hardcoded authentication token in source code',
    suggestion: 'Use environment variables or a secret manager for tokens.',
    confidence: 95,
    validate: (_line, _lines, _index, filePath) => !isTestFile(filePath),
  },
  {
    name: 'bypassed-auth-check',
    ruleId: 'FAKE008',
    regex: /(?:\/\/\s*(?:TODO|FIXME|HACK|TEMP):\s*)?(?:return\s+true|return\s+next\(\))\s*;?\s*\/\/\s*(?:skip|bypass|disable|remove|todo|temp|hack)\s*(?:auth|check|verify|valid)/i,
    severity: 'critical',
    message: 'Auth check bypassed with TODO comment — security vulnerability',
    suggestion: 'Implement proper authentication/authorization before shipping.',
    confidence: 94,
  },
  {
    name: 'fake-session-user',
    ruleId: 'FAKE008',
    regex: /(?:session|currentUser|user)\s*=\s*\{\s*(?:id|userId)\s*:\s*(?:['"`]\w+['"`]|1|0)\s*,\s*(?:name|email|role)/i,
    severity: 'high',
    message: 'Hardcoded session/user object — fake authentication state',
    suggestion: 'Get the current user from your auth provider\'s session.',
    confidence: 82,
    validate: (_line, _lines, _index, filePath) => !isTestFile(filePath) && !isSeedOrFixtureFile(filePath),
  },
];

// ─── Engine ───────────────────────────────────────────────────────────────────

export class FakeFeaturesEngine implements ScanEngine {
  readonly id = 'fake_features' as const;

  async scan(delta: DeltaContext, signal?: AbortSignal): Promise<Finding[]> {
    const uri = delta.documentUri;

    // Skip files that are expected to contain fake/test data
    if (isTestFile(uri)) return [];
    if (isStoryFile(uri)) return [];

    const ext = '.' + (uri.split('.').pop()?.toLowerCase() ?? '');
    const findings: Finding[] = [];
    const lines = delta.fullText.split('\n');
    const seen = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      if (signal?.aborted) break;

      const line = lines[i]!;
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Skip comment-only lines, except for patterns that explicitly match commented-out code
      if (isCommentLine(trimmed)) {
        const commentBlockPattern = PATTERNS.find((p) => p.name === 'commented-out-code-block');
        if (commentBlockPattern) {
          commentBlockPattern.regex.lastIndex = 0;
          if (commentBlockPattern.regex.test(line) && (!commentBlockPattern.validate || commentBlockPattern.validate(line, lines, i, uri))) {
            const dedupeKey = `${commentBlockPattern.ruleId}:${commentBlockPattern.name}:${i}`;
            if (!seen.has(dedupeKey)) {
              seen.add(dedupeKey);
              commentBlockPattern.regex.lastIndex = 0;
              const match = commentBlockPattern.regex.exec(line);
            const evidence = trimmed.length > 120 ? trimmed.slice(0, 117) + '...' : trimmed;
            findings.push({
              id: deterministicId(uri, i + 1, commentBlockPattern.ruleId, commentBlockPattern.name),
              engine: 'fake_features' as EngineId,
              severity: commentBlockPattern.severity,
              category: 'fake_features',
              file: uri,
              line: i + 1,
              column: match?.index ?? 0,
              endLine: i + 1,
              endColumn: (match?.index ?? 0) + (match?.[0]?.length ?? 0),
              message: commentBlockPattern.message,
              evidence,
              suggestion: commentBlockPattern.suggestion,
              confidence: commentBlockPattern.confidence / 100,
              autoFixable: false,
              ruleId: commentBlockPattern.ruleId,
            });
            }
          }
        }
        continue;
      }

      for (const pattern of PATTERNS) {
        // Extension filter
        if (pattern.extensions && !pattern.extensions.includes(ext)) continue;

        const match = pattern.regex.exec(line);
        if (!match) continue;

        // Custom validation
        if (pattern.validate && !pattern.validate(line, lines, i, uri)) continue;

        // Deduplicate: same rule + same line
        const dedupeKey = `${pattern.ruleId}:${pattern.name}:${i}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const evidence = trimmed.length > 120 ? trimmed.slice(0, 117) + '...' : trimmed;

        findings.push({
          id: deterministicId(uri, i + 1, pattern.ruleId, pattern.name),
          engine: 'fake_features' as EngineId,
          severity: pattern.severity,
          category: 'fake_features',
          file: uri,
          line: i + 1,
          column: match.index ?? 0,
          endLine: i + 1,
          endColumn: (match.index ?? 0) + match[0].length,
          message: pattern.message,
          evidence,
          suggestion: pattern.suggestion,
          confidence: pattern.confidence / 100,
          autoFixable: false,
          ruleId: pattern.ruleId,
        });
      }
    }

    return findings;
  }
}
