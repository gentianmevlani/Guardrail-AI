import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private prisma: PrismaClient;
  private jwtSecret: string;
  private jwtRefreshSecret: string;

  constructor() {
    this.prisma = new PrismaClient();

    // STRICT: No fallbacks for secrets - fail hard if missing
    const jwtSecret = process.env["JWT_SECRET"];
    if (!jwtSecret) {
      throw new Error("FATAL: JWT_SECRET environment variable is required.");
    }
    if (jwtSecret.length < 32) {
      throw new Error("FATAL: JWT_SECRET must be at least 32 characters.");
    }
    this.jwtSecret = jwtSecret;

    const jwtRefreshSecret = process.env["JWT_REFRESH_SECRET"];
    if (!jwtRefreshSecret) {
      throw new Error(
        "FATAL: JWT_REFRESH_SECRET environment variable is required.",
      );
    }
    if (jwtRefreshSecret.length < 32) {
      throw new Error(
        "FATAL: JWT_REFRESH_SECRET must be at least 32 characters.",
      );
    }
    this.jwtRefreshSecret = jwtRefreshSecret;
  }

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<AuthUser> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("User already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      role: "user",
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error("Invalid credentials");
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      role: "user",
    };

    return { user: authUser, tokens };
  }

  async validateToken(token: string): Promise<AuthUser | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        role: "user",
      };
    } catch (error) {
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as {
        userId: string;
      };

      // Generate new tokens
      return this.generateTokens(decoded.userId);
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }

  private async generateTokens(userId: string): Promise<AuthTokens> {
    const accessToken = jwt.sign({ userId }, this.jwtSecret, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign({ userId }, this.jwtRefreshSecret, {
      expiresIn: "7d",
    });

    return { accessToken, refreshToken };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new Error("User not found");
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new Error("Invalid current password");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
  }
}

export const authService = new AuthService();
