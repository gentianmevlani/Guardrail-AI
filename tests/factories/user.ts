import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface UserOverrides {
  id?: string;
  email?: string;
  name?: string;
  password?: string;
  emailVerified?: Date;
  role?: string;
}

export class UserFactory {
  private static counter = 0;

  static async create(overrides: UserOverrides = {}): Promise<any> {
    this.counter++;
    const password = overrides.password || 'password123';
    const passwordHash = await bcrypt.hash(password, 12);

    const userData = {
      id: overrides.id || `test-user-${this.counter}`,
      email: overrides.email || `test${this.counter}@example.com`,
      name: overrides.name || `Test User ${this.counter}`,
      password: passwordHash,
      emailVerified: overrides.emailVerified || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    return await prisma.user.create({ data: userData });
  }

  static async createMany(count: number, overrides: UserOverrides = {}): Promise<any[]> {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.create({
        ...overrides,
        email: overrides.email || `test${this.counter + i}@example.com`,
        name: overrides.name || `Test User ${this.counter + i}`
      }));
    }
    return users;
  }

  static async createAdmin(overrides: UserOverrides = {}): Promise<any> {
    return await this.create({
      ...overrides,
      email: overrides.email || 'admin@example.com'
    });
  }

  static async createWithPassword(
    password: string,
    overrides: UserOverrides = {}
  ): Promise<{ user: any; password: string }> {
    const user = await this.create({
      ...overrides,
      password
    });

    return { user, password };
  }
}
