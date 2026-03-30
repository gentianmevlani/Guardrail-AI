/**
 * Authentication System
 * 
 * User authentication and account management
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLogin: string;
  subscription: {
    tier: 'free' | 'pro' | 'enterprise';
    expiresAt?: string;
  };
  preferences: Record<string, any>;
  integrations: {
    github?: { token: string; connected: boolean };
    [key: string]: unknown;
  };
}

export interface AuthSession {
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

class AuthSystem {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, AuthSession> = new Map();
  private dataPath: string;

  constructor() {
    this.dataPath = path.join(process.cwd(), '.guardrail', 'data');
    this.loadData();
  }

  /**
   * Register new user
   */
  async register(email: string, password: string, name: string): Promise<User> {
    // Check if user exists
    const existing = Array.from(this.users.values()).find(u => u.email === email);
    if (existing) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user: User = {
      id: this.generateId(),
      email,
      name,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      subscription: {
        tier: 'free',
      },
      preferences: {},
      integrations: {},
    };

    // Store user (in production, would use database)
    this.users.set(user.id, user);
    await this.saveUser(user, passwordHash);
    await this.saveData();

    return user;
  }

  /**
   * Login
   */
  async login(email: string, password: string): Promise<AuthSession> {
    const user = Array.from(this.users.values()).find(u => u.email === email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await this.verifyPassword(user.id, password);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    this.users.set(user.id, user);
    await this.saveData();

    // Create session
    const session = await this.createSession(user.id);
    return session;
  }

  /**
   * Verify session token
   */
  async verifySession(token: string): Promise<User | null> {
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }

    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      return null;
    }

    const user = this.users.get(session.userId);
    return user || null;
  }

  /**
   * Logout
   */
  logout(token: string): void {
    this.sessions.delete(token);
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: Record<string, any>): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.preferences = { ...user.preferences, ...preferences };
    this.users.set(userId, user);
    await this.saveData();
  }

  /**
   * Connect GitHub integration
   */
  async connectGitHub(userId: string, token: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.integrations.github = {
      token,
      connected: true,
    };

    this.users.set(userId, user);
    await this.saveData();
  }

  /**
   * Update subscription
   */
  async updateSubscription(userId: string, tier: User['subscription']['tier'], expiresAt?: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.subscription = {
      tier,
      expiresAt,
    };

    this.users.set(userId, user);
    await this.saveData();
  }

  // Private methods
  private async hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }

  private async verifyPassword(userId: string, password: string): Promise<boolean> {
    try {
      const userDataPath = path.join(this.dataPath, 'users', `${userId}.json`);
      const userData = JSON.parse(await fs.promises.readFile(userDataPath, 'utf8'));
      
      const [salt, hash] = userData.passwordHash.split(':');
      return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
          if (err) reject(err);
          resolve(hash === derivedKey.toString('hex'));
        });
      });
    } catch {
      return false;
    }
  }

  private async createSession(userId: string): Promise<AuthSession> {
    const token = this.generateToken();
    const session: AuthSession = {
      userId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(token, session);
    return session;
  }

  private async saveUser(user: User, passwordHash: string): Promise<void> {
    await fs.promises.mkdir(path.join(this.dataPath, 'users'), { recursive: true });
    const userDataPath = path.join(this.dataPath, 'users', `${user.id}.json`);
    await fs.promises.writeFile(
      userDataPath,
      JSON.stringify({ ...user, passwordHash }, null, 2)
    );
  }

  private async saveData(): Promise<void> {
    // Save users and sessions
    const data = {
      users: Array.from(this.users.values()).map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        subscription: u.subscription,
        preferences: u.preferences,
        integrations: u.integrations,
      })),
      sessions: Array.from(this.sessions.values()),
    };

    await fs.promises.mkdir(this.dataPath, { recursive: true });
    await fs.promises.writeFile(
      path.join(this.dataPath, 'auth.json'),
      JSON.stringify(data, null, 2)
    );
  }

  private async loadData(): Promise<void> {
    try {
      const dataPath = path.join(this.dataPath, 'auth.json');
      const data = JSON.parse(await fs.promises.readFile(dataPath, 'utf8'));

      // Load users
      for (const userData of data.users || []) {
        this.users.set(userData.id, userData);
      }

      // Load sessions
      for (const session of data.sessions || []) {
        // Only load non-expired sessions
        if (new Date(session.expiresAt) > new Date()) {
          this.sessions.set(session.token, session);
        }
      }
    } catch {
      // No existing data
    }
  }

  private generateId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export const authSystem = new AuthSystem();

