/**
 * Authentication Service
 *
 * Handles user registration, login, and session management using Prisma.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export interface UserResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  createdAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
  expiresAt: Date;
}

class AuthService {
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private saltRounds: number;

  constructor() {
    // STRICT: No fallbacks for secrets - fail hard if missing in ALL environments
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error(
        "FATAL: JWT_SECRET environment variable is required. " +
          "Generate with: openssl rand -base64 32",
      );
    }
    if (jwtSecret.length < 32) {
      throw new Error(
        "FATAL: JWT_SECRET must be at least 32 characters for security.",
      );
    }
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
    this.saltRounds = 10;
  }

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<AuthResponse> {
    // Validate input
    if (!email || !this.isValidEmail(email)) {
      throw new Error("Invalid email address");
    }

    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (!name || name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters");
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name.trim(),
        password: passwordHash,
      },
    });

    // Create free subscription
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeCustomerId: `temp_${user.id}`,
        tier: "free",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });

    // Generate token
    const token = this.generateToken(user.id);
    const expiresAt = this.getTokenExpiration();

    return {
      user: this.sanitizeUser(user),
      token,
      expiresAt,
    };
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    // Validate input
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.password) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    // Update last login (by touching updatedAt)
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    });

    // Generate token
    const token = this.generateToken(user.id);
    const expiresAt = this.getTokenExpiration();

    return {
      user: this.sanitizeUser(user),
      token,
      expiresAt,
    };
  }

  /**
   * Verify token and get user
   */
  async verifyToken(token: string): Promise<UserResponse | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        return null;
      }

      return this.sanitizeUser(user);
    } catch (error) {
      return null;
    }
  }

  /**
   * Logout (invalidate token)
   * Note: For true token invalidation, implement a token blacklist or use short-lived tokens with refresh tokens
   */
  async logout(token: string): Promise<void> {
    // In a production system, you would add the token to a blacklist
    // For now, we just verify it was a valid token
    try {
      jwt.verify(token, this.jwtSecret);
    } catch {
      // Token was invalid anyway
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: { name?: string; email?: string },
  ): Promise<UserResponse> {
    const updateData: { name?: string; email?: string } = {};

    if (data.name) {
      updateData.name = data.name.trim();
    }

    if (data.email) {
      if (!this.isValidEmail(data.email)) {
        throw new Error("Invalid email address");
      }

      // Check if email is already taken
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email.toLowerCase(),
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new Error("Email already in use");
      }

      updateData.email = data.email.toLowerCase();
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.sanitizeUser(user);
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new Error("User not found");
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isValidPassword) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string): string {
    return jwt.sign({ userId }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  /**
   * Get token expiration date
   */
  private getTokenExpiration(): Date {
    // Parse expiration string (e.g., '7d', '24h', '60m')
    const match = this.jwtExpiresIn.match(/^(\d+)([dhms])$/);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
    }

    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      d: 24 * 60 * 60 * 1000,
      h: 60 * 60 * 1000,
      m: 60 * 1000,
      s: 1000,
    };

    return new Date(Date.now() + parseInt(value) * multipliers[unit]);
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  }): UserResponse {
    // Split name into firstName and lastName if available
    const nameParts = user.name?.trim().split(" ") || [];
    const firstName = nameParts[0] || undefined;
    const lastName =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

    return {
      id: user.id,
      email: user.email,
      firstName,
      lastName,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
