export function getCriticalPathsForFlow(
  flow: string,
  _baseUrl: string
): Array<{
  path: string;
  description: string;
  covered: boolean;
  evidence: string[];
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();

  const flowPaths: Record<string, Array<{ path: string; description: string }>> = {
    auth: [
      { path: '/api/auth/login', description: 'User authentication endpoint' },
      { path: '/api/auth/session', description: 'Session validation' },
      { path: '/api/auth/logout', description: 'Session termination' },
      { path: '/login', description: 'Login page' },
      { path: '/dashboard', description: 'Post-auth redirect' },
    ],
    checkout: [
      { path: '/api/billing/upgrade', description: 'Billing upgrade endpoint' },
      { path: '/api/webhooks/stripe', description: 'Stripe webhook handler' },
      { path: '/checkout', description: 'Checkout page' },
      { path: '/api/payment/intent', description: 'Payment intent creation' },
      { path: '/api/subscription', description: 'Subscription management' },
    ],
    dashboard: [
      { path: '/api/user/profile', description: 'User profile endpoint' },
      { path: '/api/settings', description: 'Settings endpoint' },
      { path: '/dashboard', description: 'Dashboard page' },
      { path: '/api/data', description: 'Data fetching endpoint' },
    ],
  };

  const paths = flowPaths[flow] || flowPaths.auth;

  return paths.map((p) => ({
    path: p.path,
    description: p.description,
    covered: false,
    evidence: [],
    timestamp,
  }));
}
