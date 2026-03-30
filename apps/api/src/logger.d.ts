import pino from 'pino';
export declare const logger: pino.Logger<never, boolean>;
export declare function createRequestLogger(requestId: string): pino.Logger<never, boolean>;
export declare function createUserLogger(userId: string, userEmail?: string): pino.Logger<never, boolean>;
export declare function createModuleLogger(module: string): pino.Logger<never, boolean>;
export default logger;
//# sourceMappingURL=logger.d.ts.map