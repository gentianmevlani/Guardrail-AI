import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient({
    log: process['env']['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
export * from '@prisma/client';
// Helper function to safely disconnect
export async function disconnectDatabase() {
    await prisma.$disconnect();
}
// Helper function to check database connection
export async function checkDatabaseConnection() {
    try {
        await prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
}
