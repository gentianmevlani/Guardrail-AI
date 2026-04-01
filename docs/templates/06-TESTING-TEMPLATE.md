# TESTING & QUALITY ASSURANCE TEMPLATE

## Overview

This template sets up a comprehensive testing strategy with unit tests, integration tests, E2E tests, and quality tools.

---

## CONFIGURATION

```yaml
PROJECT_NAME: "Your App"
FRAMEWORK: "nextjs"
TEST_RUNNER: "vitest" # vitest | jest
E2E_FRAMEWORK: "playwright" # playwright | cypress
COVERAGE_THRESHOLD: 80
```

---

## MASTER PROMPT

```
Set up a complete testing infrastructure for [PROJECT_NAME].

Test Runner: [TEST_RUNNER]
E2E: [E2E_FRAMEWORK]
Coverage Target: [COVERAGE_THRESHOLD]%

## CRITICAL: FILE LOCATIONS

All test files MUST be in their specified directories:

```
/src
├── /__tests__                    # Test files (alternative: colocate with source)
│   ├── /unit                     # Unit tests
│   │   ├── /components
│   │   ├── /hooks
│   │   ├── /utils
│   │   └── /services
│   ├── /integration              # Integration tests
│   │   └── /api
│   └── /setup                    # Test setup files
│       ├── setup.ts
│       └── mocks.ts
│
├── /e2e                          # E2E tests (at root or /tests)
│   ├── /fixtures
│   ├── /pages
│   └── playwright.config.ts
│
└── /components
    └── /ui
        ├── Button.tsx
        └── Button.test.tsx       # Colocated test (alternative)
```

## DELIVERABLES

### 1. TEST CONFIGURATION

**FILE: /vitest.config.ts**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'src/__tests__',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
      thresholds: {
        statements: [COVERAGE_THRESHOLD],
        branches: [COVERAGE_THRESHOLD],
        functions: [COVERAGE_THRESHOLD],
        lines: [COVERAGE_THRESHOLD],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**FILE: /playwright.config.ts**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2. TEST SETUP

**FILE: /src/__tests__/setup/setup.ts**
```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
```

**FILE: /src/__tests__/setup/mocks.ts**
```typescript
import { vi } from 'vitest';

// API client mock
export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Auth mock
export const mockAuth = {
  user: null,
  isAuthenticated: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
};

// Toast mock
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

// Local storage mock
export const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Fetch mock helper
export function mockFetch(response: any, options?: { ok?: boolean; status?: number }) {
  return vi.fn().mockResolvedValue({
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    json: () => Promise.resolve(response),
  });
}
```

**FILE: /src/__tests__/setup/test-utils.tsx**
```typescript
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a custom render that includes providers
const AllProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
```

### 3. UNIT TEST EXAMPLES

**FILE: /src/__tests__/unit/components/Button.test.tsx**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../setup/test-utils';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies variant classes correctly', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('border'); // secondary has border
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<Button isLoading loadingText="Loading...">Submit</Button>);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders with left icon', () => {
    const Icon = () => <span data-testid="icon">★</span>;
    render(<Button leftIcon={<Icon />}>With Icon</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
```

**FILE: /src/__tests__/unit/hooks/useDisclosure.test.ts**
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDisclosure } from '@/hooks/useDisclosure';

describe('useDisclosure', () => {
  it('starts closed by default', () => {
    const { result } = renderHook(() => useDisclosure());
    expect(result.current.isOpen).toBe(false);
  });

  it('starts open when initial value is true', () => {
    const { result } = renderHook(() => useDisclosure(true));
    expect(result.current.isOpen).toBe(true);
  });

  it('opens when onOpen is called', () => {
    const { result } = renderHook(() => useDisclosure());
    
    act(() => {
      result.current.onOpen();
    });
    
    expect(result.current.isOpen).toBe(true);
  });

  it('closes when onClose is called', () => {
    const { result } = renderHook(() => useDisclosure(true));
    
    act(() => {
      result.current.onClose();
    });
    
    expect(result.current.isOpen).toBe(false);
  });

  it('toggles when onToggle is called', () => {
    const { result } = renderHook(() => useDisclosure());
    
    act(() => {
      result.current.onToggle();
    });
    expect(result.current.isOpen).toBe(true);
    
    act(() => {
      result.current.onToggle();
    });
    expect(result.current.isOpen).toBe(false);
  });
});
```

**FILE: /src/__tests__/unit/utils/format.test.ts**
```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, truncateAddress } from '@/lib/utils';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles negative numbers', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
  });

  it('handles large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });
});

describe('truncateAddress', () => {
  it('truncates address correctly', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    expect(truncateAddress(address)).toBe('0x1234...5678');
  });

  it('handles custom char count', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    expect(truncateAddress(address, 6)).toBe('0x123456...345678');
  });
});
```

### 4. INTEGRATION TEST EXAMPLES

**FILE: /src/__tests__/integration/api/users.test.ts**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/users/route';
import { UserRepository } from '@/server/repositories';

// Mock the repository
vi.mock('@/server/repositories', () => ({
  UserRepository: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findByEmail: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock('@/server/api/middleware', () => ({
  authMiddleware: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
  withErrorHandler: (handler: any) => handler,
}));

describe('Users API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('returns paginated users', async () => {
      const mockUsers = [
        { id: '1', name: 'User 1', email: 'user1@test.com' },
        { id: '2', name: 'User 2', email: 'user2@test.com' },
      ];

      vi.mocked(UserRepository.findMany).mockResolvedValue(mockUsers);
      vi.mocked(UserRepository.count).mockResolvedValue(2);

      const request = new NextRequest('http://localhost/api/users?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
    });

    it('handles search parameter', async () => {
      vi.mocked(UserRepository.findMany).mockResolvedValue([]);
      vi.mocked(UserRepository.count).mockResolvedValue(0);

      const request = new NextRequest('http://localhost/api/users?search=test');
      await GET(request);

      expect(UserRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test' })
      );
    });
  });

  describe('POST /api/users', () => {
    it('creates a new user', async () => {
      const newUser = {
        id: '1',
        name: 'New User',
        email: 'new@test.com',
        password: 'hashedpassword',
      };

      vi.mocked(UserRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(UserRepository.create).mockResolvedValue(newUser);

      const request = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New User',
          email: 'new@test.com',
          password: 'password123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.email).toBe('new@test.com');
      // Password should not be in response
      expect(data.data.password).toBeUndefined();
    });

    it('returns error for duplicate email', async () => {
      vi.mocked(UserRepository.findByEmail).mockResolvedValue({
        id: '1',
        email: 'existing@test.com',
      } as any);

      const request = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New User',
          email: 'existing@test.com',
          password: 'password123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
    });
  });
});
```

### 5. E2E TEST EXAMPLES

**FILE: /e2e/auth.spec.ts**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /login/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/welcome/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /login/i }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL('/dashboard');

    // Logout
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL('/login');
  });
});
```

**FILE: /e2e/dashboard.spec.ts**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display stats cards', async ({ page }) => {
    await expect(page.getByTestId('stats-grid')).toBeVisible();
    await expect(page.getByTestId('stat-card')).toHaveCount(4);
  });

  test('should navigate to settings', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL('/settings');
  });

  test('should open modal when clicking action button', async ({ page }) => {
    await page.getByRole('button', { name: /new transaction/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
```

**FILE: /e2e/fixtures/auth.fixture.ts**
```typescript
import { test as base } from '@playwright/test';

// Extend base test with authentication
export const test = base.extend<{ authenticatedPage: typeof base }>({
  authenticatedPage: async ({ page }, use) => {
    // Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL('/dashboard');

    // Use the authenticated page
    await use(page as any);

    // Cleanup: logout
    await page.getByRole('button', { name: /logout/i }).click();
  },
});

export { expect } from '@playwright/test';
```

### 6. PACKAGE.JSON SCRIPTS

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:headed": "playwright test --headed",
    "e2e:debug": "playwright test --debug",
    "e2e:report": "playwright show-report",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "validate": "npm run lint && npm run type-check && npm run test:coverage"
  }
}
```

### 7. CI/CD WORKFLOW

**FILE: /.github/workflows/test.yml**
```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Unit tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  e2e:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run e2e

      - name: Upload test report
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

Now create all test files in their specified locations. Remember: test files go in /src/__tests__/ or /e2e/, NOT in root.
```
