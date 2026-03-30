/**
 * Shared API schemas for Swagger documentation
 */

export const schemas = {
  // User schema
  User: {
    type: "object",
    properties: {
      id: { type: "string", description: "User ID" },
      email: { type: "string", format: "email", description: "User email" },
      name: { type: "string", description: "User display name" },
      createdAt: {
        type: "string",
        format: "date-time",
        description: "Account creation date",
      },
      updatedAt: {
        type: "string",
        format: "date-time",
        description: "Last update date",
      },
    },
  },

  // Auth response schema
  AuthResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", description: "Request success status" },
      user: { $ref: "User#" },
      token: { type: "string", description: "JWT authentication token" },
      refreshToken: { type: "string", description: "JWT refresh token" },
    },
  },

  // Error response schema
  ErrorResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: false },
      error: { type: "string", description: "Error message" },
      code: { type: "string", description: "Error code" },
      details: { type: "object", description: "Additional error details" },
    },
  },

  // Project schema
  Project: {
    type: "object",
    properties: {
      id: { type: "string", description: "Project ID" },
      name: { type: "string", description: "Project name" },
      description: { type: "string", description: "Project description" },
      status: {
        type: "string",
        enum: ["active", "archived", "deleted"],
        description: "Project status",
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },

  // Scan result schema
  ScanResult: {
    type: "object",
    properties: {
      scanId: { type: "string", description: "Scan ID" },
      status: {
        type: "string",
        enum: ["pending", "running", "completed", "failed"],
        description: "Scan status",
      },
      progress: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "Scan progress percentage",
      },
      results: {
        type: "object",
        properties: {
          vulnerabilities: { type: "array", items: { $ref: "Vulnerability#" } },
          secrets: { type: "array", items: { $ref: "Secret#" } },
          dependencies: { type: "array", items: { $ref: "Dependency#" } },
        },
      },
    },
  },

  // Vulnerability schema
  Vulnerability: {
    type: "object",
    properties: {
      id: { type: "string", description: "Vulnerability ID" },
      severity: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Vulnerability severity",
      },
      title: { type: "string", description: "Vulnerability title" },
      description: { type: "string", description: "Vulnerability description" },
      file: {
        type: "string",
        description: "File where vulnerability was found",
      },
      line: { type: "integer", description: "Line number" },
      cwe: { type: "string", description: "CWE identifier" },
      recommendation: { type: "string", description: "Fix recommendation" },
    },
  },

  // Secret schema
  Secret: {
    type: "object",
    properties: {
      id: { type: "string", description: "Secret ID" },
      type: {
        type: "string",
        description: "Secret type (e.g., API key, password)",
      },
      value: { type: "string", description: "Masked secret value" },
      file: { type: "string", description: "File where secret was found" },
      line: { type: "integer", description: "Line number" },
      risk: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Risk level",
      },
      recommendation: {
        type: "string",
        description: "Remediation recommendation",
      },
    },
  },

  // Dependency schema
  Dependency: {
    type: "object",
    properties: {
      name: { type: "string", description: "Package name" },
      version: { type: "string", description: "Package version" },
      vulnerabilities: {
        type: "integer",
        description: "Number of vulnerabilities",
      },
      severity: {
        type: "string",
        enum: ["none", "low", "medium", "high", "critical"],
      },
      recommendation: { type: "string", description: "Update recommendation" },
    },
  },
};

// Parameters
export const parameters = {
  // Project ID parameter
  ProjectId: {
    name: "projectId",
    in: "path",
    required: true,
    type: "string",
    description: "ID of the project",
  },

  // Scan ID parameter
  ScanId: {
    name: "scanId",
    in: "path",
    required: true,
    type: "string",
    description: "ID of the scan",
  },
};

// Common responses
export const responses = {
  Unauthorized: {
    description: "Unauthorized - Invalid or missing authentication token",
    schema: { $ref: "ErrorResponse#" },
  },
  Forbidden: {
    description: "Forbidden - Insufficient permissions",
    schema: { $ref: "ErrorResponse#" },
  },
  NotFound: {
    description: "Resource not found",
    schema: { $ref: "ErrorResponse#" },
  },
  ValidationError: {
    description: "Validation error",
    schema: { $ref: "ErrorResponse#" },
  },
};
