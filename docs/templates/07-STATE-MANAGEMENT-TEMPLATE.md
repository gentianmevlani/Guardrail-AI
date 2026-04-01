# STATE MANAGEMENT TEMPLATE

## Overview

This template sets up scalable state management for React applications using modern patterns (Zustand, React Query, Context).

---

## CONFIGURATION

```yaml
PROJECT_NAME: "Your App"
STATE_LIBRARY: "zustand" # zustand | jotai | redux-toolkit
SERVER_STATE: "react-query" # react-query | swr | rtk-query
PERSISTENCE: true # Persist to localStorage
DEVTOOLS: true # Redux DevTools integration
```

---

## MASTER PROMPT

```
Set up state management for [PROJECT_NAME]:

State Library: [STATE_LIBRARY]
Server State: [SERVER_STATE]
Persistence: [PERSISTENCE]

## CRITICAL: FILE LOCATIONS

```
/src
├── /stores                    # Global state stores
│   ├── /slices                # Store slices (modular)
│   │   ├── auth.slice.ts
│   │   ├── ui.slice.ts
│   │   └── index.ts
│   ├── store.ts               # Main store configuration
│   ├── hooks.ts               # Typed hooks
│   └── index.ts
│
├── /providers                 # Context providers
│   ├── QueryProvider.tsx      # React Query provider
│   ├── StoreProvider.tsx      # Store provider (if needed)
│   └── index.ts
│
├── /hooks                     # Custom hooks
│   ├── /queries               # React Query hooks
│   │   ├── useUsers.ts
│   │   ├── usePosts.ts
│   │   └── index.ts
│   ├── /mutations             # Mutation hooks
│   │   ├── useCreateUser.ts
│   │   └── index.ts
│   └── index.ts
│
└── /features                  # Feature-specific state
    └── /[feature]
        ├── /stores            # Feature store
        └── /hooks             # Feature hooks
```

## DELIVERABLES

### 1. ZUSTAND STORE SETUP

**FILE: /src/stores/store.ts**
```typescript
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createAuthSlice, AuthSlice } from './slices/auth.slice';
import { createUISlice, UISlice } from './slices/ui.slice';

// Combined store type
export type Store = AuthSlice & UISlice;

// Create store with all middleware
export const useStore = create<Store>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((...args) => ({
          ...createAuthSlice(...args),
          ...createUISlice(...args),
        }))
      ),
      {
        name: '[PROJECT_NAME]-storage',
        partialize: (state) => ({
          // Only persist these fields
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          // Don't persist sensitive auth data
        }),
      }
    ),
    {
      name: '[PROJECT_NAME]',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);
```

**FILE: /src/stores/slices/auth.slice.ts**
```typescript
import { StateCreator } from 'zustand';
import { Store } from '../store';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthSlice {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const createAuthSlice: StateCreator<
  Store,
  [['zustand/immer', never]],
  [],
  AuthSlice
> = (set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Actions
  setUser: (user) =>
    set((state) => {
      state.user = user;
      state.isAuthenticated = !!user;
    }),

  login: async (email, password) => {
    set((state) => {
      state.isLoading = true;
      state.error = null;
    });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const { user, accessToken } = await response.json();

      // Store token
      localStorage.setItem('accessToken', accessToken);

      set((state) => {
        state.user = user;
        state.isAuthenticated = true;
        state.isLoading = false;
      });
    } catch (error) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Login failed';
        state.isLoading = false;
      });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    set((state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    });
  },

  clearError: () =>
    set((state) => {
      state.error = null;
    }),
});
```

**FILE: /src/stores/slices/ui.slice.ts**
```typescript
import { StateCreator } from 'zustand';
import { Store } from '../store';

export type Theme = 'light' | 'dark' | 'system';

export interface UISlice {
  // State
  theme: Theme;
  sidebarCollapsed: boolean;
  modalOpen: string | null;
  toast: {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  hideToast: () => void;
}

export const createUISlice: StateCreator<
  Store,
  [['zustand/immer', never]],
  [],
  UISlice
> = (set) => ({
  // Initial state
  theme: 'system',
  sidebarCollapsed: false,
  modalOpen: null,
  toast: null,

  // Actions
  setTheme: (theme) =>
    set((state) => {
      state.theme = theme;
    }),

  toggleSidebar: () =>
    set((state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    }),

  setSidebarCollapsed: (collapsed) =>
    set((state) => {
      state.sidebarCollapsed = collapsed;
    }),

  openModal: (modalId) =>
    set((state) => {
      state.modalOpen = modalId;
    }),

  closeModal: () =>
    set((state) => {
      state.modalOpen = null;
    }),

  showToast: (message, type) =>
    set((state) => {
      state.toast = { message, type };
    }),

  hideToast: () =>
    set((state) => {
      state.toast = null;
    }),
});
```

**FILE: /src/stores/slices/index.ts**
```typescript
export { createAuthSlice, type AuthSlice, type User } from './auth.slice';
export { createUISlice, type UISlice, type Theme } from './ui.slice';
```

**FILE: /src/stores/hooks.ts**
```typescript
import { useStore } from './store';
import { shallow } from 'zustand/shallow';

// Typed selectors for better DX
export const useAuth = () =>
  useStore(
    (state) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      error: state.error,
      login: state.login,
      logout: state.logout,
      clearError: state.clearError,
    }),
    shallow
  );

export const useUser = () => useStore((state) => state.user);

export const useTheme = () =>
  useStore(
    (state) => ({
      theme: state.theme,
      setTheme: state.setTheme,
    }),
    shallow
  );

export const useSidebar = () =>
  useStore(
    (state) => ({
      collapsed: state.sidebarCollapsed,
      toggle: state.toggleSidebar,
      setCollapsed: state.setSidebarCollapsed,
    }),
    shallow
  );

export const useModal = () =>
  useStore(
    (state) => ({
      modalOpen: state.modalOpen,
      openModal: state.openModal,
      closeModal: state.closeModal,
    }),
    shallow
  );

export const useToast = () =>
  useStore(
    (state) => ({
      toast: state.toast,
      showToast: state.showToast,
      hideToast: state.hideToast,
    }),
    shallow
  );
```

**FILE: /src/stores/index.ts**
```typescript
export { useStore } from './store';
export type { Store } from './store';
export * from './hooks';
export * from './slices';
```

### 2. REACT QUERY SETUP

**FILE: /src/providers/QueryProvider.tsx**
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: 1 minute
            staleTime: 60 * 1000,
            // Cache time: 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry once
            retry: 1,
            // Refetch on window focus
            refetchOnWindowFocus: false,
          },
          mutations: {
            // Retry once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

**FILE: /src/providers/index.ts**
```typescript
export { QueryProvider } from './QueryProvider';
```

### 3. QUERY HOOKS

**FILE: /src/hooks/queries/useUsers.ts**
```typescript
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/types';

interface UseUsersParams {
  page?: number;
  limit?: number;
  search?: string;
}

interface UsersResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UseUsersParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export function useUsers(
  params: UseUsersParams = {},
  options?: Omit<UseQueryOptions<UsersResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async () => {
      const response = await api.get<UsersResponse>('/users', {
        params: {
          page: String(params.page || 1),
          limit: String(params.limit || 10),
          ...(params.search && { search: params.search }),
        },
      });
      return response;
    },
    ...options,
  });
}

export function useUser(
  id: string,
  options?: Omit<UseQueryOptions<User>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<{ data: User }>(`/users/${id}`);
      return response.data;
    },
    enabled: !!id,
    ...options,
  });
}
```

**FILE: /src/hooks/queries/index.ts**
```typescript
export { useUsers, useUser, userKeys } from './useUsers';
```

### 4. MUTATION HOOKS

**FILE: /src/hooks/mutations/useCreateUser.ts**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { userKeys } from '../queries/useUsers';
import { useToast } from '@/stores';
import type { User } from '@/types';

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const response = await api.post<{ data: User }>('/users', input);
      return response.data;
    },
    onSuccess: (newUser) => {
      // Invalidate and refetch users list
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      
      // Optionally add to cache directly
      queryClient.setQueryData(userKeys.detail(newUser.id), newUser);
      
      showToast('User created successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to create user', 'error');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<CreateUserInput>) => {
      const response = await api.put<{ data: User }>(`/users/${id}`, input);
      return response.data;
    },
    onSuccess: (updatedUser) => {
      // Update cache
      queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      
      showToast('User updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update user', 'error');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: userKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      
      showToast('User deleted successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to delete user', 'error');
    },
  });
}
```

**FILE: /src/hooks/mutations/index.ts**
```typescript
export { useCreateUser, useUpdateUser, useDeleteUser } from './useCreateUser';
```

### 5. FEATURE-SPECIFIC STORE (Example: Wallet)

**FILE: /src/features/wallet/stores/wallet.store.ts**
```typescript
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Token, Transaction } from '../types';

interface WalletState {
  // State
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  tokens: Token[];
  selectedToken: Token | null;
  transactions: Transaction[];

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  setChainId: (chainId: number) => void;
  setTokens: (tokens: Token[]) => void;
  selectToken: (token: Token | null) => void;
  addTransaction: (tx: Transaction) => void;
}

export const useWalletStore = create<WalletState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        address: null,
        isConnected: false,
        isConnecting: false,
        chainId: null,
        tokens: [],
        selectedToken: null,
        transactions: [],

        // Actions
        connect: async () => {
          set((state) => {
            state.isConnecting = true;
          });

          try {
            // Wallet connection logic here
            const address = '0x...'; // From wallet provider
            const chainId = 1; // From wallet provider

            set((state) => {
              state.address = address;
              state.chainId = chainId;
              state.isConnected = true;
              state.isConnecting = false;
            });
          } catch (error) {
            set((state) => {
              state.isConnecting = false;
            });
            throw error;
          }
        },

        disconnect: () => {
          set((state) => {
            state.address = null;
            state.isConnected = false;
            state.chainId = null;
            state.tokens = [];
            state.selectedToken = null;
          });
        },

        setChainId: (chainId) =>
          set((state) => {
            state.chainId = chainId;
          }),

        setTokens: (tokens) =>
          set((state) => {
            state.tokens = tokens;
          }),

        selectToken: (token) =>
          set((state) => {
            state.selectedToken = token;
          }),

        addTransaction: (tx) =>
          set((state) => {
            state.transactions.unshift(tx);
          }),
      }))
    ),
    { name: 'wallet-store' }
  )
);

// Selectors
export const useWalletAddress = () => useWalletStore((state) => state.address);
export const useIsWalletConnected = () => useWalletStore((state) => state.isConnected);
export const useWalletTokens = () => useWalletStore((state) => state.tokens);
```

**FILE: /src/features/wallet/stores/index.ts**
```typescript
export {
  useWalletStore,
  useWalletAddress,
  useIsWalletConnected,
  useWalletTokens,
} from './wallet.store';
```

### 6. USAGE EXAMPLES

**Using Global Store:**
```typescript
import { useAuth, useTheme, useSidebar } from '@/stores';

function Header() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { collapsed, toggle } = useSidebar();

  return (
    <header>
      <button onClick={toggle}>
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
      <span>{user?.name}</span>
      <button onClick={logout}>Logout</button>
    </header>
  );
}
```

**Using React Query:**
```typescript
import { useUsers, useCreateUser } from '@/hooks';

function UserList() {
  const { data, isLoading, error } = useUsers({ page: 1, limit: 10 });
  const createUser = useCreateUser();

  if (isLoading) return <Skeleton />;
  if (error) return <Error error={error} />;

  return (
    <div>
      {data?.data.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
      <Button
        onClick={() => createUser.mutate({ name: 'New User', email: '...' })}
        isLoading={createUser.isPending}
      >
        Add User
      </Button>
    </div>
  );
}
```

**Using Feature Store:**
```typescript
import { useWalletStore, useWalletAddress } from '@/features/wallet/stores';

function WalletConnect() {
  const { connect, disconnect, isConnecting, isConnected } = useWalletStore();
  const address = useWalletAddress();

  if (isConnected) {
    return (
      <Button onClick={disconnect}>
        {truncateAddress(address!)}
      </Button>
    );
  }

  return (
    <Button onClick={connect} isLoading={isConnecting}>
      Connect Wallet
    </Button>
  );
}
```

---

Now create all state management files in their specified locations. Do NOT create files in root directory.
```
