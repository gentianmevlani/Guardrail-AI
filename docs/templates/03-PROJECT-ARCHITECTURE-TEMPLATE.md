# UNIVERSAL PROJECT ARCHITECTURE TEMPLATE

## Overview

This template sets up a scalable, modular architecture where each feature/service has its own folder with all related files. No more 2000-line files - everything is organized by domain.

---

## THE PROBLEM

Typical projects end up like this:

```
/components
  Button.tsx
  Card.tsx
  UserProfile.tsx      # 500 lines
  UserSettings.tsx     # 400 lines
  UserAvatar.tsx
  Dashboard.tsx        # 1200 lines
  DashboardStats.tsx
  DashboardChart.tsx
  WalletConnect.tsx    # 800 lines
  WalletBalance.tsx
  WalletTransactions.tsx
  ... 200 more files
```

Problems:
- Hard to find related files
- Unclear dependencies
- Files grow too large
- No clear ownership
- Difficult to delete/refactor features

---

## THE SOLUTION: FEATURE-BASED ARCHITECTURE

```
/src
├── /features              # Feature modules (the meat of your app)
│   ├── /auth
│   ├── /dashboard
│   ├── /wallet
│   ├── /settings
│   └── /[feature-name]
│
├── /components            # Shared UI only
│   └── /ui
│
├── /hooks                 # Shared hooks only
├── /lib                   # Shared utilities only
├── /types                 # Shared types only
└── /app                   # Next.js routes (thin layer)
```

Each feature is **self-contained** with everything it needs.

---

## FEATURE MODULE STRUCTURE

Every feature follows this exact structure:

```
/features/[feature-name]
│
├── /components           # Feature-specific components
│   ├── FeatureCard.tsx
│   ├── FeatureList.tsx
│   └── index.ts
│
├── /hooks                # Feature-specific hooks
│   ├── useFeatureData.ts
│   ├── useFeatureActions.ts
│   └── index.ts
│
├── /services             # API calls, external integrations
│   ├── feature.api.ts
│   ├── feature.service.ts
│   └── index.ts
│
├── /stores               # State management (if needed)
│   ├── feature.store.ts
│   └── index.ts
│
├── /types                # Feature-specific types
│   ├── feature.types.ts
│   └── index.ts
│
├── /utils                # Feature-specific utilities
│   ├── feature.utils.ts
│   └── index.ts
│
├── /constants            # Feature-specific constants
│   └── feature.constants.ts
│
├── Feature.tsx           # Main feature component (container)
├── index.ts              # Public API (barrel export)
└── README.md             # Feature documentation (optional)
```

---

## MASTER PROMPT

```
Set up a feature-based architecture for [PROJECT_NAME]. The project has these features:

FEATURES:
- [List your features, e.g., auth, dashboard, wallet, settings, etc.]

For each feature, create the complete module structure with:

### 1. DIRECTORY STRUCTURE

```
/src
│
├── /app                        # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   ├── /dashboard
│   │   └── page.tsx           # Thin - just imports from feature
│   ├── /wallet
│   │   └── page.tsx
│   ├── /settings
│   │   └── page.tsx
│   └── /api                    # API routes
│       └── /[feature]
│           └── route.ts
│
├── /features                   # Feature modules
│   │
│   ├── /auth                   # Authentication feature
│   │   ├── /components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   ├── AuthGuard.tsx
│   │   │   └── index.ts
│   │   ├── /hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useLogin.ts
│   │   │   ├── useSignup.ts
│   │   │   └── index.ts
│   │   ├── /services
│   │   │   ├── auth.api.ts
│   │   │   ├── auth.service.ts
│   │   │   └── index.ts
│   │   ├── /stores
│   │   │   ├── auth.store.ts
│   │   │   └── index.ts
│   │   ├── /types
│   │   │   ├── auth.types.ts
│   │   │   └── index.ts
│   │   ├── /utils
│   │   │   ├── auth.utils.ts
│   │   │   └── index.ts
│   │   ├── Auth.tsx            # Main container
│   │   └── index.ts            # Public exports
│   │
│   ├── /dashboard              # Dashboard feature
│   │   ├── /components
│   │   │   ├── DashboardHeader.tsx
│   │   │   ├── StatsGrid.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── RecentActivity.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   └── index.ts
│   │   ├── /hooks
│   │   │   ├── useDashboardStats.ts
│   │   │   ├── useRecentActivity.ts
│   │   │   └── index.ts
│   │   ├── /services
│   │   │   ├── dashboard.api.ts
│   │   │   └── index.ts
│   │   ├── /types
│   │   │   ├── dashboard.types.ts
│   │   │   └── index.ts
│   │   ├── Dashboard.tsx
│   │   └── index.ts
│   │
│   ├── /wallet                 # Wallet feature
│   │   ├── /components
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── WalletBalance.tsx
│   │   │   ├── TokenList.tsx
│   │   │   ├── TokenCard.tsx
│   │   │   ├── TransactionList.tsx
│   │   │   ├── TransactionItem.tsx
│   │   │   ├── SendModal.tsx
│   │   │   ├── ReceiveModal.tsx
│   │   │   └── index.ts
│   │   ├── /hooks
│   │   │   ├── useWallet.ts
│   │   │   ├── useBalance.ts
│   │   │   ├── useTokens.ts
│   │   │   ├── useTransactions.ts
│   │   │   ├── useSend.ts
│   │   │   └── index.ts
│   │   ├── /services
│   │   │   ├── wallet.api.ts
│   │   │   ├── wallet.service.ts
│   │   │   ├── token.service.ts
│   │   │   └── index.ts
│   │   ├── /stores
│   │   │   ├── wallet.store.ts
│   │   │   └── index.ts
│   │   ├── /types
│   │   │   ├── wallet.types.ts
│   │   │   ├── token.types.ts
│   │   │   ├── transaction.types.ts
│   │   │   └── index.ts
│   │   ├── /utils
│   │   │   ├── wallet.utils.ts
│   │   │   ├── format.utils.ts
│   │   │   └── index.ts
│   │   ├── /constants
│   │   │   ├── chains.ts
│   │   │   ├── tokens.ts
│   │   │   └── index.ts
│   │   ├── Wallet.tsx
│   │   └── index.ts
│   │
│   └── /settings               # Settings feature
│       ├── /components
│       │   ├── SettingsNav.tsx
│       │   ├── ProfileSection.tsx
│       │   ├── SecuritySection.tsx
│       │   ├── PreferencesSection.tsx
│       │   ├── SettingsRow.tsx
│       │   └── index.ts
│       ├── /hooks
│       │   ├── useSettings.ts
│       │   ├── useUpdateProfile.ts
│       │   └── index.ts
│       ├── /services
│       │   ├── settings.api.ts
│       │   └── index.ts
│       ├── /types
│       │   ├── settings.types.ts
│       │   └── index.ts
│       ├── Settings.tsx
│       └── index.ts
│
├── /components                 # SHARED components only
│   ├── /ui                     # Design system components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── index.ts
│   ├── /layout                 # Layout components
│   │   ├── PageLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── index.ts
│   └── /providers              # Context providers
│       ├── ThemeProvider.tsx
│       ├── ToastProvider.tsx
│       └── index.ts
│
├── /hooks                      # SHARED hooks only
│   ├── useDisclosure.ts
│   ├── useDebounce.ts
│   ├── useMediaQuery.ts
│   └── index.ts
│
├── /lib                        # SHARED utilities
│   ├── cn.ts
│   ├── api.ts                 # API client setup
│   ├── motion.ts
│   └── utils.ts
│
├── /types                      # SHARED types
│   ├── common.types.ts
│   ├── api.types.ts
│   └── index.ts
│
├── /styles                     # Global styles
│   ├── globals.css
│   └── tokens.css
│
└── /config                     # App configuration
    ├── site.ts
    ├── routes.ts
    └── index.ts
```

### 2. FEATURE INDEX FILES (Public API)

Each feature exports only what other parts of the app need:

```typescript
// /features/wallet/index.ts

// Components
export { WalletConnect } from './components';
export { WalletBalance } from './components';
export { TokenList } from './components';

// Hooks
export { useWallet } from './hooks';
export { useBalance } from './hooks';
export { useTokens } from './hooks';

// Types
export type { Wallet, Token, Transaction } from './types';

// Main container (for route pages)
export { Wallet } from './Wallet';
```

### 3. ROUTE FILES (Thin Layer)

Route files should be minimal - just composition:

```typescript
// /app/wallet/page.tsx

import { Wallet } from '@/features/wallet';

export default function WalletPage() {
  return <Wallet />;
}
```

```typescript
// /app/dashboard/page.tsx

import { Dashboard } from '@/features/dashboard';

export default function DashboardPage() {
  return <Dashboard />;
}
```

### 4. FEATURE CONTAINER PATTERN

Each feature has a main container that composes its components:

```typescript
// /features/dashboard/Dashboard.tsx

'use client';

import { PageLayout } from '@/components/layout';
import { 
  DashboardHeader,
  StatsGrid,
  RecentActivity,
  QuickActions,
} from './components';
import { useDashboardStats, useRecentActivity } from './hooks';

export function Dashboard() {
  const { stats, isLoading: statsLoading } = useDashboardStats();
  const { activity, isLoading: activityLoading } = useRecentActivity();

  return (
    <PageLayout title="Dashboard">
      <DashboardHeader />
      
      <div className="space-y-8">
        <StatsGrid stats={stats} isLoading={statsLoading} />
        <QuickActions />
        <RecentActivity activity={activity} isLoading={activityLoading} />
      </div>
    </PageLayout>
  );
}
```

### 5. SERVICE LAYER PATTERN

Services handle all external communication:

```typescript
// /features/wallet/services/wallet.api.ts

import { api } from '@/lib/api';
import type { Wallet, Token, Transaction } from '../types';

export const walletApi = {
  // Get wallet data
  getWallet: async (address: string): Promise<Wallet> => {
    return api.get(`/wallet/${address}`);
  },
  
  // Get token balances
  getTokens: async (address: string): Promise<Token[]> => {
    return api.get(`/wallet/${address}/tokens`);
  },
  
  // Get transactions
  getTransactions: async (
    address: string, 
    params?: { page?: number; limit?: number }
  ): Promise<Transaction[]> => {
    return api.get(`/wallet/${address}/transactions`, { params });
  },
  
  // Send transaction
  sendTransaction: async (data: {
    from: string;
    to: string;
    amount: string;
    token: string;
  }): Promise<{ hash: string }> => {
    return api.post('/wallet/send', data);
  },
};
```

```typescript
// /features/wallet/services/wallet.service.ts

import { walletApi } from './wallet.api';
import { formatBalance, validateAddress } from '../utils';
import type { Wallet, FormattedWallet } from '../types';

export const walletService = {
  // Business logic layer
  getFormattedWallet: async (address: string): Promise<FormattedWallet> => {
    const wallet = await walletApi.getWallet(address);
    const tokens = await walletApi.getTokens(address);
    
    return {
      ...wallet,
      formattedBalance: formatBalance(wallet.balance),
      tokens: tokens.map(t => ({
        ...t,
        formattedBalance: formatBalance(t.balance, t.decimals),
      })),
    };
  },
  
  // Validation + API call
  sendTransaction: async (data: {
    from: string;
    to: string;
    amount: string;
    token: string;
  }) => {
    if (!validateAddress(data.to)) {
      throw new Error('Invalid recipient address');
    }
    
    return walletApi.sendTransaction(data);
  },
};
```

### 6. HOOKS PATTERN

Hooks consume services and provide reactive data:

```typescript
// /features/wallet/hooks/useWallet.ts

import { useQuery } from '@tanstack/react-query';
import { walletService } from '../services';
import type { FormattedWallet } from '../types';

export function useWallet(address: string | undefined) {
  return useQuery<FormattedWallet>({
    queryKey: ['wallet', address],
    queryFn: () => walletService.getFormattedWallet(address!),
    enabled: !!address,
  });
}
```

```typescript
// /features/wallet/hooks/useSend.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { walletService } from '../services';
import { useToast } from '@/hooks';

export function useSend() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: walletService.sendTransaction,
    onSuccess: (data) => {
      toast.success('Transaction sent!');
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Transaction failed');
    },
  });
}
```

### 7. COMPONENT ORGANIZATION

Keep components small and focused:

```typescript
// /features/wallet/components/TokenCard.tsx

import { GlassCard, Badge } from '@/components/ui';
import { formatCurrency, formatPercentage } from '../utils';
import type { Token } from '../types';

interface TokenCardProps {
  token: Token;
  onClick?: () => void;
}

export function TokenCard({ token, onClick }: TokenCardProps) {
  const isPositive = token.change24h >= 0;
  
  return (
    <GlassCard hoverable onClick={onClick} className="p-4">
      <div className="flex items-center gap-3">
        <img 
          src={token.logo} 
          alt={token.symbol} 
          className="w-10 h-10 rounded-full"
        />
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{token.symbol}</span>
            <span className="font-mono">{token.formattedBalance}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{token.name}</span>
            <div className="flex items-center gap-2">
              <span>{formatCurrency(token.value)}</span>
              <Badge variant={isPositive ? 'success' : 'error'}>
                {formatPercentage(token.change24h)}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
```

```typescript
// /features/wallet/components/TokenList.tsx

import { motion } from 'framer-motion';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';
import { Skeleton } from '@/components/ui';
import { TokenCard } from './TokenCard';
import type { Token } from '../types';

interface TokenListProps {
  tokens: Token[];
  isLoading?: boolean;
  onTokenClick?: (token: Token) => void;
}

export function TokenList({ tokens, isLoading, onTokenClick }: TokenListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} variant="card" height={80} />
        ))}
      </div>
    );
  }
  
  if (tokens.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        No tokens found
      </div>
    );
  }
  
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
      className="space-y-3"
    >
      {tokens.map((token) => (
        <motion.div key={token.address} variants={staggerItemVariants}>
          <TokenCard token={token} onClick={() => onTokenClick?.(token)} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### 8. TYPES ORGANIZATION

Keep types close to where they're used:

```typescript
// /features/wallet/types/wallet.types.ts

export interface Wallet {
  address: string;
  balance: string;
  chainId: number;
}

export interface FormattedWallet extends Wallet {
  formattedBalance: string;
  tokens: FormattedToken[];
}
```

```typescript
// /features/wallet/types/token.types.ts

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  logo?: string;
  price?: number;
  value?: number;
  change24h?: number;
}

export interface FormattedToken extends Token {
  formattedBalance: string;
}
```

```typescript
// /features/wallet/types/index.ts

export * from './wallet.types';
export * from './token.types';
export * from './transaction.types';
```

---

## RULES FOR THIS ARCHITECTURE

### Rule 1: Features Don't Import From Other Features

```typescript
// ❌ BAD - feature importing from another feature
import { useAuth } from '@/features/auth';

// ✅ GOOD - use shared hooks or props
import { useAuth } from '@/hooks'; // if shared
// OR pass as props from parent
```

If features need to communicate:
- Lift shared logic to `/hooks` or `/lib`
- Use events/pub-sub
- Pass data through parent components

### Rule 2: Route Files Are Thin

```typescript
// ❌ BAD - logic in route file
export default function DashboardPage() {
  const [stats, setStats] = useState([]);
  useEffect(() => { /* fetch data */ }, []);
  
  return (
    <div>
      <h1>Dashboard</h1>
      {/* 200 lines of JSX */}
    </div>
  );
}

// ✅ GOOD - delegate to feature
export default function DashboardPage() {
  return <Dashboard />;
}
```

### Rule 3: Services Handle External Communication

```typescript
// ❌ BAD - API calls in components
function TokenList() {
  useEffect(() => {
    fetch('/api/tokens').then(/* ... */);
  }, []);
}

// ✅ GOOD - API calls in services, consumed via hooks
function TokenList() {
  const { data: tokens } = useTokens();
}
```

### Rule 4: Keep Components Under 150 Lines

If a component exceeds 150 lines:
- Extract sub-components
- Move logic to hooks
- Move utilities to utils

### Rule 5: Public API Through index.ts

Only export what other parts of the app need:

```typescript
// /features/wallet/index.ts

// ✅ Export public components
export { WalletConnect } from './components';
export { Wallet } from './Wallet';

// ✅ Export public hooks
export { useWallet } from './hooks';

// ✅ Export public types
export type { Wallet, Token } from './types';

// ❌ Don't export internal utilities
// export { formatBalance } from './utils'; // Keep internal
```

---

## ADDING A NEW FEATURE

Run this prompt for each new feature:

```
Create a new feature module for [FEATURE_NAME] with:

Description: [What this feature does]

Components needed:
- [Component1]
- [Component2]
- ...

Data/API:
- [Endpoint 1]
- [Endpoint 2]
- ...

State needed:
- [State 1]
- [State 2]
- ...

Create the complete module structure following the feature-based architecture pattern with:
1. /components - All UI components for this feature
2. /hooks - Data fetching and state hooks
3. /services - API calls and business logic
4. /types - TypeScript interfaces
5. /utils - Helper functions
6. Feature.tsx - Main container
7. index.ts - Public exports
```

---

Now create the complete architecture for [PROJECT_NAME] with all features listed above. Ensure each feature is self-contained and follows all the patterns described.
```

---

## QUICK REFERENCE

### Import Patterns

```typescript
// From a feature (public API only)
import { Wallet, useWallet, type Token } from '@/features/wallet';

// From shared components
import { Button, Card, Modal } from '@/components/ui';

// From shared hooks
import { useDisclosure, useDebounce } from '@/hooks';

// From shared lib
import { cn, formatCurrency } from '@/lib';
```

### File Naming

```
ComponentName.tsx      # PascalCase for components
useHookName.ts         # camelCase with 'use' prefix for hooks
feature.service.ts     # lowercase with dot notation for services
feature.types.ts       # lowercase with dot notation for types
feature.utils.ts       # lowercase with dot notation for utils
CONSTANTS.ts           # UPPERCASE for constants (optional)
```

### Feature Checklist

When creating a new feature:

- [ ] Create feature directory under `/features`
- [ ] Create `/components` with all UI
- [ ] Create `/hooks` for data/state
- [ ] Create `/services` for API calls
- [ ] Create `/types` for TypeScript
- [ ] Create `/utils` if needed
- [ ] Create main container (Feature.tsx)
- [ ] Create index.ts with public exports
- [ ] Create route file under `/app`
- [ ] Keep all files under 150 lines
