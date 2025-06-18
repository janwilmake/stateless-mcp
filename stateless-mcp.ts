export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        },
      });
    }

    // Handle MCP messages endpoint
    if (url.pathname === "/message" || url.pathname === "/messages") {
      return handleMCPMessage(request);
    }

    // Basic info endpoint
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          name: "cloudflare-mcp-server",
          version: "1.0.0",
          protocol: "2025-03-26",
          transport: "http",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleMCPMessage(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    // Validate Accept header
    const acceptHeader = request.headers.get("Accept");
    if (!acceptHeader?.includes("application/json")) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Must accept application/json" },
        }),
        { status: 400, headers },
      );
    }

    // Only allow POST
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Method not allowed" },
        }),
        {
          status: 405,
          headers: {
            ...headers,
            Allow: "POST",
          },
        },
      );
    }

    const jsonRpcMessage = await request.json();
    const response = await handleJSONRPCMessage(jsonRpcMessage);
    return new Response(JSON.stringify(response), { headers });
  } catch (error) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error",
          data: error.message,
        },
      }),
      { status: 500, headers },
    );
  }
}

async function handleJSONRPCMessage(message) {
  const { jsonrpc, id, method, params } = message;

  // Validate JSON-RPC format
  if (jsonrpc !== "2.0") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid Request" },
    };
  }

  try {
    switch (method) {
      // Core Protocol Methods
      case "initialize":
        return handleInitialize(id, params);

      case "ping":
        return handlePing(id);

      // Tools
      case "tools/list":
        return handleToolsList(id, params);

      case "tools/call":
        return handleToolCall(id, params);

      // Resources
      case "resources/list":
        return handleResourcesList(id, params);

      case "resources/read":
        return handleResourceRead(id, params);

      // Prompts
      case "prompts/list":
        return handlePromptsList(id, params);

      case "prompts/get":
        return handlePromptGet(id, params);

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not found" },
        };
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: "Internal error",
        data: error.message,
      },
    };
  }
}

// Core Protocol Handlers
function handleInitialize(id, params) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
      },
      serverInfo: {
        name: "cloudflare-mcp-server",
        version: "1.0.0",
      },
      instructions:
        "A simple MCP server running on Cloudflare Workers with tools, resources, and prompts.",
    },
  };
}

function handlePing(id) {
  return {
    jsonrpc: "2.0",
    id,
    result: {},
  };
}

// Tools Handlers
function handleToolsList(id, params) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      tools: [
        {
          name: "get_time",
          description: "Get the current time in ISO format",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "echo",
          description: "Echo back the input text",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "Text to echo back",
              },
            },
            required: ["text"],
          },
        },
        {
          name: "random_number",
          description: "Generate a random number between min and max",
          inputSchema: {
            type: "object",
            properties: {
              min: { type: "number", description: "Minimum value" },
              max: { type: "number", description: "Maximum value" },
            },
            required: ["min", "max"],
          },
        },
      ],
    },
  };
}

async function handleToolCall(id, params) {
  const { name, arguments: args } = params;

  switch (name) {
    case "get_time":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Current time: ${new Date().toISOString()}`,
            },
          ],
        },
      };

    case "echo":
      if (!args?.text) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: "Error: text parameter is required",
              },
            ],
          },
        };
      }
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Echo: ${args.text}`,
            },
          ],
        },
      };

    case "random_number":
      const { min = 0, max = 100 } = args || {};
      const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Random number between ${min} and ${max}: ${randomNum}`,
            },
          ],
        },
      };

    default:
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Tool '${name}' not found`,
            },
          ],
        },
      };
  }
}

// Resources Handlers
function handleResourcesList(id, params) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      resources: [
        {
          uri: "cloudflare://worker-info",
          name: "Worker Information",
          description: "Information about this Cloudflare Worker",
          mimeType: "application/json",
        },
        {
          uri: "cloudflare://current-time",
          name: "Current Time",
          description: "Current server time in various formats",
          mimeType: "application/json",
        },
      ],
    },
  };
}

async function handleResourceRead(id, params) {
  const { uri } = params;

  switch (uri) {
    case "cloudflare://worker-info":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  name: "cloudflare-mcp-server",
                  version: "1.0.0",
                  runtime: "Cloudflare Workers",
                  protocol: "MCP 2025-03-26",
                  capabilities: ["tools", "resources", "prompts"],
                },
                null,
                2,
              ),
            },
          ],
        },
      };

    case "cloudflare://current-time":
      const now = new Date();
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  iso: now.toISOString(),
                  unix: Math.floor(now.getTime() / 1000),
                  formatted: now.toLocaleString(),
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                null,
                2,
              ),
            },
          ],
        },
      };

    default:
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [],
        },
      };
  }
}

// Prompts Handlers
function handlePromptsList(id, params) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      prompts: [
        {
          name: "greeting",
          description: "A friendly greeting prompt",
          arguments: [
            {
              name: "name",
              description: "Name of the person to greet",
              required: false,
            },
          ],
        },
        {
          name: "system_status",
          description: "System status and information prompt",
        },
      ],
    },
  };
}

async function handlePromptGet(id, params) {
  const { name, arguments: args } = params;

  switch (name) {
    case "greeting":
      const userName = args?.name || "there";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          description: "A friendly greeting",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Hello ${userName}! Welcome to the Cloudflare MCP Server. How can I help you today?`,
              },
            },
          ],
        },
      };

    case "system_status":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          description: "Current system status",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `System Status Report:
- Server: Cloudflare MCP Server v1.0.0
- Protocol: MCP 2025-03-26
- Runtime: Cloudflare Workers
- Status: Online and operational
- Current Time: ${new Date().toISOString()}
- Available Tools: get_time, echo, random_number
- Available Resources: worker-info, current-time`,
              },
            },
          ],
        },
      };

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32602,
          message: "Invalid params",
          data: `Prompt '${name}' not found`,
        },
      };
  }
}
