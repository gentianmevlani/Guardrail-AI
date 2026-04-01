import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { spawn } from "child_process";
import path from "path";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// MCP Server wrapper for web deployment
export async function mcpWrapperRoutes(fastify: FastifyInstance) {
  // Add authentication for MCP endpoints
  fastify.addHook("preHandler", async (request, reply) => {
    // For now, allow all requests (add auth later)
    // const authHeader = request.headers.authorization;
    // if (!authHeader) {
    //   return reply.status(401).send({ error: 'Unauthorized' });
    // }
  });

  // List available MCP tools
  fastify.get(
    "/mcp/tools",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await callMcpServer("list_tools", {});
        return reply.send(result);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    },
  );

  // Call MCP tool
  fastify.post(
    "/mcp/:tool",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { tool } = request.params as { tool: string };
      const args = request.body as any;

      try {
        const result = await callMcpTool(tool, args);
        return reply.send(result);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    },
  );

  // List MCP resources
  fastify.get(
    "/mcp/resources",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await callMcpServer("list_resources", {});
        return reply.send(result);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    },
  );

  // Read MCP resource
  fastify.get(
    "/mcp/resources/:uri",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { uri } = request.params as { uri: string };

      try {
        const result = await callMcpServer("read_resource", { uri });
        return reply.send(result);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toErrorMessage(error) });
      }
    },
  );
}

// Helper function to call MCP server tools
async function callMcpTool(toolName: string, args: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const mcpServerPath = path.join(process.cwd(), "mcp-server", "index.js");

    const child = spawn("node", [mcpServerPath], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    // Send the tool call request
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    child.stdin?.write(JSON.stringify(request) + "\n");

    child.on("close", (code) => {
      if (code === 0) {
        try {
          const response = JSON.parse(stdout);
          if (response.error) {
            reject(new Error(toErrorMessage(response.error)));
          } else {
            resolve(response.result);
          }
        } catch (e) {
          reject(new Error("Invalid MCP server response"));
        }
      } else {
        reject(new Error(`MCP server failed with code ${code}: ${stderr}`));
      }
    });

    child.on("error", reject);

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error("MCP server timeout"));
    }, 30000);
  });
}

// Helper function to call MCP server methods
async function callMcpServer(method: string, params: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const mcpServerPath = path.join(process.cwd(), "mcp-server", "index.js");

    const child = spawn("node", [mcpServerPath], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    // Send the request
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };

    child.stdin?.write(JSON.stringify(request) + "\n");

    child.on("close", (code) => {
      if (code === 0) {
        try {
          const response = JSON.parse(stdout);
          if (response.error) {
            reject(new Error(toErrorMessage(response.error)));
          } else {
            resolve(response.result);
          }
        } catch (e) {
          reject(new Error("Invalid MCP server response"));
        }
      } else {
        reject(new Error(`MCP server failed with code ${code}: ${stderr}`));
      }
    });

    child.on("error", reject);

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error("MCP server timeout"));
    }, 30000);
  });
}
