/**
 * AST-Based Structural Verification
 *
 * Verifies findings from lexical pass using AST analysis:
 * - Empty catch blocks: verify no logging/rethrow
 * - Fake success: detect returns in catch/error handlers
 * - Auth bypass: verify reachability in production
 */
import { Evidence } from './reality-sniff-scanner';
export interface ASTVerificationResult {
    verified: boolean;
    evidence: Evidence[];
    confidence: number;
    details: string;
}
export declare class ASTVerifier {
    /**
     * Verify empty catch block has no error handling
     */
    verifyEmptyCatch(filePath: string, line: number): ASTVerificationResult;
    /**
     * Verify fake success pattern is in error path
     */
    verifyFakeSuccessInErrorPath(filePath: string, line: number, pattern: string): ASTVerificationResult;
    /**
     * Verify auth bypass is reachable in production
     */
    verifyAuthBypassReachability(filePath: string, line: number): ASTVerificationResult;
    private hasLogging;
    private hasRethrow;
}
export declare const astVerifier: ASTVerifier;
