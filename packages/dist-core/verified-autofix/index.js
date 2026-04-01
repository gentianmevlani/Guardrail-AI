"use strict";
/**
 * Verified AutoFix Module - Public API
 *
 * Exports for the verified autofix pipeline:
 * - Format validation
 * - Temp workspace management
 * - Repo fingerprinting
 * - Full pipeline orchestration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPipelineResultJson = exports.formatPipelineResult = exports.verifiedAutofixPipeline = exports.VerifiedAutofixPipeline = exports.getTypecheckCommand = exports.getTestCommand = exports.getBuildCommand = exports.getInstallCommand = exports.fingerprintRepo = exports.tempWorkspace = exports.TempWorkspace = exports.isMarkdownWrapped = exports.stripMarkdownFences = exports.detectStubs = exports.validateCommandSafety = exports.validatePathSafety = exports.validateUnifiedDiff = exports.validateJsonShape = exports.validateAgentOutput = void 0;
// Format validation
var format_validator_1 = require("./format-validator");
Object.defineProperty(exports, "validateAgentOutput", { enumerable: true, get: function () { return format_validator_1.validateAgentOutput; } });
Object.defineProperty(exports, "validateJsonShape", { enumerable: true, get: function () { return format_validator_1.validateJsonShape; } });
Object.defineProperty(exports, "validateUnifiedDiff", { enumerable: true, get: function () { return format_validator_1.validateUnifiedDiff; } });
Object.defineProperty(exports, "validatePathSafety", { enumerable: true, get: function () { return format_validator_1.validatePathSafety; } });
Object.defineProperty(exports, "validateCommandSafety", { enumerable: true, get: function () { return format_validator_1.validateCommandSafety; } });
Object.defineProperty(exports, "detectStubs", { enumerable: true, get: function () { return format_validator_1.detectStubs; } });
Object.defineProperty(exports, "stripMarkdownFences", { enumerable: true, get: function () { return format_validator_1.stripMarkdownFences; } });
Object.defineProperty(exports, "isMarkdownWrapped", { enumerable: true, get: function () { return format_validator_1.isMarkdownWrapped; } });
// Workspace management
var workspace_1 = require("./workspace");
Object.defineProperty(exports, "TempWorkspace", { enumerable: true, get: function () { return workspace_1.TempWorkspace; } });
Object.defineProperty(exports, "tempWorkspace", { enumerable: true, get: function () { return workspace_1.tempWorkspace; } });
// Repo fingerprinting
var repo_fingerprint_1 = require("./repo-fingerprint");
Object.defineProperty(exports, "fingerprintRepo", { enumerable: true, get: function () { return repo_fingerprint_1.fingerprintRepo; } });
Object.defineProperty(exports, "getInstallCommand", { enumerable: true, get: function () { return repo_fingerprint_1.getInstallCommand; } });
Object.defineProperty(exports, "getBuildCommand", { enumerable: true, get: function () { return repo_fingerprint_1.getBuildCommand; } });
Object.defineProperty(exports, "getTestCommand", { enumerable: true, get: function () { return repo_fingerprint_1.getTestCommand; } });
Object.defineProperty(exports, "getTypecheckCommand", { enumerable: true, get: function () { return repo_fingerprint_1.getTypecheckCommand; } });
// Pipeline orchestration
var pipeline_1 = require("./pipeline");
Object.defineProperty(exports, "VerifiedAutofixPipeline", { enumerable: true, get: function () { return pipeline_1.VerifiedAutofixPipeline; } });
Object.defineProperty(exports, "verifiedAutofixPipeline", { enumerable: true, get: function () { return pipeline_1.verifiedAutofixPipeline; } });
Object.defineProperty(exports, "formatPipelineResult", { enumerable: true, get: function () { return pipeline_1.formatPipelineResult; } });
Object.defineProperty(exports, "formatPipelineResultJson", { enumerable: true, get: function () { return pipeline_1.formatPipelineResultJson; } });
