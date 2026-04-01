import { PrismaClient } from '@prisma/client';
export declare const prisma: PrismaClient<{
    log: ("query" | "warn" | "error")[];
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export * from '@prisma/client';
export declare function disconnectDatabase(): Promise<void>;
export declare function checkDatabaseConnection(): Promise<boolean>;
//# sourceMappingURL=index.d.ts.map