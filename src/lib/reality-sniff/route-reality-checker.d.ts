/**
 * Route Reality Checker
 *
 * Verifies that declared routes actually exist and are reachable:
 * - Cross-checks route definitions with handler exports
 * - Verifies middleware chains for protected routes
 * - Optional runtime ping for critical routes
 */
import { RealityFinding } from './reality-sniff-scanner';
export interface RouteDefinition {
    pattern: string;
    method?: string;
    handler?: string;
    file?: string;
    line?: number;
    requiresAuth?: boolean;
    middleware?: string[];
}
export interface RouteRealityResult {
    routes: RouteDefinition[];
    missingHandlers: RouteDefinition[];
    unprotectedRoutes: RouteDefinition[];
    findings: RealityFinding[];
}
export declare class RouteRealityChecker {
    private projectPath;
    private routes;
    constructor(projectPath: string);
    /**
     * Discover routes from framework-specific files
     */
    discoverRoutes(): Promise<RouteDefinition[]>;
    /**
     * Verify route handlers exist
     */
    verifyHandlers(): Promise<RouteRealityResult>;
    private discoverNextAppRoutes;
    private discoverNextPagesRoutes;
    private discoverExpressRoutes;
    private walkRouteDirectory;
    private pathToRoutePattern;
    private findRouteFiles;
    private walkDirectory;
    private verifyHandlerExists;
}
