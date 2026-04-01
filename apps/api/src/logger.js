"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createRequestLogger = createRequestLogger;
exports.createUserLogger = createUserLogger;
exports.createModuleLogger = createModuleLogger;
const core_1 = require("@guardrail/core");
const os = __importStar(require("os"));
const pino_1 = __importDefault(require("pino"));
const request_context_1 = require("./lib/request-context");
const env = (0, core_1.getEnv)();
// Cache hostname once at module load - this is a performance optimization
// since hostname doesn't change during application lifetime
const CACHED_HOSTNAME = os.hostname();
// Create logger configuration
const loggerConfig = {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    formatters: {
        level: (label) => ({ level: label }),
        log: (object) => {
            // Add timestamp, service info, and request context
            const requestId = (0, request_context_1.getRequestId)();
            return {
                ...object,
                service: 'guardrail-api',
                version: process.env['npm_package_version'] || '1.0.0',
                hostname: CACHED_HOSTNAME,
                pid: process.pid,
                ...(requestId && { requestId }), // Only add requestId if it exists
            };
        }
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    // Redact sensitive information
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.token',
            'res.headers.set-cookie',
            'user.email',
            'userIp'
        ],
        censor: '*****'
    }
};
// In development, use pretty printing
if (env.NODE_ENV === 'development') {
    loggerConfig.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
        }
    };
}
// Create and export the logger
exports.logger = (0, pino_1.default)(loggerConfig);
// Create a child logger with request context
function createRequestLogger(requestId) {
    return exports.logger.child({ requestId });
}
// Create a child logger with user context
function createUserLogger(userId, userEmail) {
    return exports.logger.child({
        userId,
        userEmail: userEmail || 'unknown',
        context: 'user'
    });
}
// Create a child logger for specific modules
function createModuleLogger(module) {
    return exports.logger.child({ module });
}
// Export default logger
exports.default = exports.logger;
