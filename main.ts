export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
        },
      });
    }

    // Handle MCP endpoint
    if (url.pathname === "/mcp") {
      return handleMCPEndpoint(request);
    }

    // Basic info endpoint
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          name: "cloudflare-mcp-server",
          title: "Cloudflare MCP Server",
          version: "1.0.0",
          protocol: "2025-06-18",
          transport: "streamable-http",
          endpoint: "/mcp",
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

async function handleMCPEndpoint(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
  };

  try {
    // Check for MCP-Protocol-Version header
    const protocolVersion = request.headers.get("MCP-Protocol-Version");
    if (protocolVersion && protocolVersion !== "2025-06-18") {
      return new Response("Unsupported MCP protocol version", {
        status: 400,
        headers,
      });
    }

    if (request.method === "GET") {
      // Handle GET request for SSE stream
      const acceptHeader = request.headers.get("Accept");
      if (!acceptHeader?.includes("text/event-stream")) {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            ...headers,
            Allow: "POST",
          },
        });
      }

      // For this stateless implementation, we don't support GET/SSE streams
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          ...headers,
          Allow: "POST",
        },
      });
    }

    if (request.method === "POST") {
      // Validate Accept header
      const acceptHeader = request.headers.get("Accept");
      if (!acceptHeader?.includes("application/json")) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Must accept application/json" },
          }),
          {
            status: 400,
            headers: { ...headers, "Content-Type": "application/json" },
          },
        );
      }

      const jsonRpcMessage = await request.json();
      console.log({ jsonRpcMessage });
      // Check if this is a response or notification
      if ("result" in jsonRpcMessage || "error" in jsonRpcMessage) {
        // This is a JSON-RPC response - accept it
        return new Response(null, {
          status: 202,
          headers,
        });
      }

      if ("method" in jsonRpcMessage && !("id" in jsonRpcMessage)) {
        // This is a JSON-RPC notification - accept it
        return new Response(null, {
          status: 202,
          headers,
        });
      }

      // This is a JSON-RPC request - handle it
      const response = await handleJSONRPCMessage(jsonRpcMessage);
      return new Response(JSON.stringify(response), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (request.method === "DELETE") {
      // Handle session termination (though this is stateless)
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          ...headers,
          Allow: "POST",
        },
      });
    }

    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        ...headers,
        Allow: "POST",
      },
    });
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
      {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      },
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

      // Resource Templates
      case "resources/templates/list":
        return handleResourceTemplatesList(id, params);

      // Prompts
      case "prompts/list":
        return handlePromptsList(id, params);

      case "prompts/get":
        return handlePromptGet(id, params);

      // Completion/Autocomplete
      case "completion/complete":
        return handleComplete(id, params);

      // Logging
      case "logging/setLevel":
        return handleSetLogLevel(id, params);

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
  console.log({ params });
  return {
    jsonrpc: "2.0",
    id,
    result: {
      // "2025-06-18" for newest features, not supported yet by inspector

      protocolVersion: "2025-03-26",
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
        prompts: { listChanged: false },
        logging: {},
        completions: {},
        experimental: {},
      },
      serverInfo: {
        name: "cloudflare-mcp-server",
        title: "Cloudflare MCP Server",
        version: "1.0.0",
      },
      instructions:
        "A modern MCP server running on Cloudflare Workers with enhanced tools, resources, prompts, and completion support.",
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
          title: "Current Time",
          description: "Get the current time in ISO format",
          inputSchema: {
            type: "object",
            properties: {},
          },
          outputSchema: {
            type: "object",
            properties: {
              timestamp: { type: "string", description: "ISO timestamp" },
              timezone: { type: "string", description: "Timezone info" },
              unix: { type: "number", description: "Unix timestamp" },
            },
            required: ["timestamp"],
          },
          annotations: {
            title: "Get Current Time",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
          },
          _meta: {
            category: "utility",
            lastModified: new Date().toISOString(),
          },
        },
        {
          name: "echo",
          title: "Echo Text",
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
          outputSchema: {
            type: "object",
            properties: {
              original: { type: "string", description: "The original text" },
              length: { type: "number", description: "Character count" },
            },
            required: ["original"],
          },
          annotations: {
            title: "Echo Input",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        {
          name: "random_number",
          title: "Random Number Generator",
          description: "Generate a random number between min and max",
          inputSchema: {
            type: "object",
            properties: {
              min: { type: "number", description: "Minimum value" },
              max: { type: "number", description: "Maximum value" },
            },
            required: ["min", "max"],
          },
          outputSchema: {
            type: "object",
            properties: {
              value: { type: "number", description: "The random number" },
              range: { type: "string", description: "The range used" },
            },
            required: ["value"],
          },
          annotations: {
            title: "Generate Random Number",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
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
      const now = new Date();
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Current time: ${now.toISOString()}`,
              annotations: {
                audience: ["user", "assistant"],
                priority: 1,
                lastModified: now.toISOString(),
              },
            },
          ],
          structuredContent: {
            timestamp: now.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            unix: Math.floor(now.getTime() / 1000),
          },
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
                annotations: {
                  audience: ["user"],
                  priority: 1,
                },
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
              annotations: {
                audience: ["user", "assistant"],
                priority: 0.8,
              },
            },
          ],
          structuredContent: {
            original: args.text,
            length: args.text.length,
          },
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
              annotations: {
                audience: ["user", "assistant"],
                priority: 0.7,
              },
            },
          ],
          structuredContent: {
            value: randomNum,
            range: `${min}-${max}`,
          },
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
          name: "worker-info",
          title: "Worker Information",
          description: "Information about this Cloudflare Worker",
          mimeType: "application/json",
          annotations: {
            audience: ["user", "assistant"],
            priority: 0.9,
            lastModified: new Date().toISOString(),
          },
          size: 500,
          _meta: {
            category: "system",
            readonly: true,
          },
        },
        {
          uri: "cloudflare://current-time",
          name: "current-time",
          title: "Current Server Time",
          description: "Current server time in various formats",
          mimeType: "application/json",
          annotations: {
            audience: ["user", "assistant"],
            priority: 0.8,
          },
          size: 300,
          _meta: {
            category: "utility",
            dynamic: true,
          },
        },
      ],
    },
  };
}

async function handleResourceRead(id, params) {
  const { uri } = params;

  switch (uri) {
    case "cloudflare://worker-info":
      const info = {
        name: "cloudflare-mcp-server",
        title: "Cloudflare MCP Server",
        version: "1.0.0",
        runtime: "Cloudflare Workers",
        protocol: "MCP 2025-06-18",
        capabilities: [
          "tools",
          "resources",
          "prompts",
          "completions",
          "logging",
        ],
        features: {
          stateless: true,
          scalable: true,
          global: true,
        },
      };

      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(info, null, 2),
              _meta: {
                size: JSON.stringify(info).length,
                encoding: "utf-8",
              },
            },
          ],
        },
      };

    case "cloudflare://current-time":
      const now = new Date();
      const timeInfo = {
        iso: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
        formatted: now.toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        utc: now.toUTCString(),
        components: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          hour: now.getHours(),
          minute: now.getMinutes(),
          second: now.getSeconds(),
        },
      };

      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(timeInfo, null, 2),
              _meta: {
                generated: now.toISOString(),
                size: JSON.stringify(timeInfo).length,
              },
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

// Resource Templates Handlers
function handleResourceTemplatesList(id, params) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      resourceTemplates: [
        {
          name: "dynamic-content",
          title: "Dynamic Content",
          uriTemplate: "cloudflare://content/{type}/{id}",
          description: "Access dynamic content by type and ID",
          mimeType: "application/json",
          annotations: {
            audience: ["assistant"],
            priority: 0.6,
          },
          _meta: {
            examples: [
              "cloudflare://content/user/123",
              "cloudflare://content/post/456",
            ],
          },
        },
        {
          name: "system-status",
          title: "System Status",
          uriTemplate: "cloudflare://status/{component}",
          description: "Get status information for system components",
          mimeType: "application/json",
          annotations: {
            audience: ["user", "assistant"],
            priority: 0.7,
          },
          _meta: {
            examples: [
              "cloudflare://status/memory",
              "cloudflare://status/network",
            ],
          },
        },
      ],
    },
  };
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
          title: "Friendly Greeting",
          description:
            "A friendly greeting prompt with optional personalization",
          arguments: [
            {
              name: "name",
              title: "Person's Name",
              description: "Name of the person to greet",
              required: false,
            },
            {
              name: "language",
              title: "Language",
              description: "Language for the greeting",
              required: false,
            },
          ],
          _meta: {
            category: "social",
            complexity: "simple",
          },
        },
        {
          name: "system_status",
          title: "System Status Report",
          description: "Comprehensive system status and information prompt",
          _meta: {
            category: "system",
            complexity: "detailed",
          },
        },
        {
          name: "troubleshooting",
          title: "Troubleshooting Assistant",
          description: "Interactive troubleshooting guide",
          arguments: [
            {
              name: "issue",
              title: "Issue Description",
              description: "Description of the problem",
              required: true,
            },
            {
              name: "severity",
              title: "Severity Level",
              description: "How critical is this issue (low, medium, high)",
              required: false,
            },
          ],
          _meta: {
            category: "support",
            complexity: "interactive",
          },
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
      const language = args?.language || "English";
      const greetings = {
        English: `Hello ${userName}! Welcome to the Cloudflare MCP Server.`,
        Spanish: `¡Hola ${userName}! Bienvenido al Servidor MCP de Cloudflare.`,
        French: `Bonjour ${userName}! Bienvenue sur le serveur MCP Cloudflare.`,
        German: `Hallo ${userName}! Willkommen beim Cloudflare MCP Server.`,
      };

      return {
        jsonrpc: "2.0",
        id,
        result: {
          description: `A friendly greeting in ${language}`,
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `${
                  greetings[language] || greetings.English
                } How can I help you today?`,
                annotations: {
                  audience: ["user"],
                  priority: 1,
                },
              },
            },
          ],
        },
      };

    case "system_status":
      const now = new Date();
      return {
        jsonrpc: "2.0",
        id,
        result: {
          description: "Comprehensive system status report",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `System Status Report:
- Server: Cloudflare MCP Server v1.0.0
- Protocol: MCP 2025-06-18
- Runtime: Cloudflare Workers
- Status: Online and operational
- Current Time: ${now.toISOString()}
- Uptime: Active (serverless)
- Available Tools: get_time, echo, random_number
- Available Resources: worker-info, current-time
- Available Prompts: greeting, system_status, troubleshooting
- New Features: Resource templates, completions, enhanced annotations
- Performance: Edge-optimized, globally distributed`,
                annotations: {
                  audience: ["user", "assistant"],
                  priority: 0.9,
                  lastModified: now.toISOString(),
                },
              },
            },
          ],
        },
      };

    case "troubleshooting":
      const issue = args?.issue || "unspecified issue";
      const severity = args?.severity || "medium";

      return {
        jsonrpc: "2.0",
        id,
        result: {
          description: "Interactive troubleshooting assistant",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Troubleshooting Assistant - ${severity.toUpperCase()} Priority

Issue: ${issue}

Let's work through this step by step:

1. First, let's gather some basic information
2. Check system status using the system_status prompt
3. Review recent changes or updates
4. Test basic functionality with available tools
5. Provide recommendations based on findings

Available diagnostic tools:
- get_time: Check system time and timezone
- echo: Test basic communication
- random_number: Test computational functions
- worker-info resource: Review system configuration

Would you like to start with any specific diagnostic step?`,
                annotations: {
                  audience: ["user"],
                  priority: 0.9,
                },
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

// Completion Handler
function handleComplete(id, params) {
  const { ref, argument } = params;
  const { name, value } = argument;

  // Handle different completion contexts
  if (ref.type === "ref/prompt") {
    // Prompt argument completion
    switch (ref.name) {
      case "greeting":
        if (name === "language") {
          const languages = [
            "English",
            "Spanish",
            "French",
            "German",
            "Italian",
            "Portuguese",
          ];
          const filtered = languages.filter((lang) =>
            lang.toLowerCase().startsWith(value.toLowerCase()),
          );

          return {
            jsonrpc: "2.0",
            id,
            result: {
              completion: {
                values: filtered,
                total: filtered.length,
                hasMore: false,
              },
            },
          };
        }
        break;

      case "troubleshooting":
        if (name === "severity") {
          const severities = ["low", "medium", "high", "critical"];
          const filtered = severities.filter((sev) =>
            sev.toLowerCase().startsWith(value.toLowerCase()),
          );

          return {
            jsonrpc: "2.0",
            id,
            result: {
              completion: {
                values: filtered,
                total: filtered.length,
                hasMore: false,
              },
            },
          };
        }
        break;
    }
  } else if (ref.type === "ref/resource") {
    // Resource template completion
    if (ref.uri === "cloudflare://content/{type}/{id}") {
      if (name === "type") {
        const types = ["user", "post", "comment", "file", "image", "document"];
        const filtered = types.filter((type) =>
          type.toLowerCase().startsWith(value.toLowerCase()),
        );

        return {
          jsonrpc: "2.0",
          id,
          result: {
            completion: {
              values: filtered,
              total: filtered.length,
              hasMore: false,
            },
          },
        };
      }
    } else if (ref.uri === "cloudflare://status/{component}") {
      if (name === "component") {
        const components = [
          "memory",
          "cpu",
          "network",
          "storage",
          "database",
          "cache",
        ];
        const filtered = components.filter((comp) =>
          comp.toLowerCase().startsWith(value.toLowerCase()),
        );

        return {
          jsonrpc: "2.0",
          id,
          result: {
            completion: {
              values: filtered,
              total: filtered.length,
              hasMore: false,
            },
          },
        };
      }
    }
  }

  // Default empty completion
  return {
    jsonrpc: "2.0",
    id,
    result: {
      completion: {
        values: [],
        total: 0,
        hasMore: false,
      },
    },
  };
}

// Logging Handler
let currentLogLevel = "info";

function handleSetLogLevel(id, params) {
  const { level } = params;
  const validLevels = [
    "debug",
    "info",
    "notice",
    "warning",
    "error",
    "critical",
    "alert",
    "emergency",
  ];

  if (!validLevels.includes(level)) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32602,
        message: "Invalid params",
        data: `Invalid log level. Must be one of: ${validLevels.join(", ")}`,
      },
    };
  }

  currentLogLevel = level;

  // In a real implementation, you might send a log message notification here
  // to confirm the level was set

  return {
    jsonrpc: "2.0",
    id,
    result: {},
  };
}

// Helper function to send log messages (for future use)
function createLogMessage(level, message, logger = "cloudflare-mcp-server") {
  return {
    jsonrpc: "2.0",
    method: "notifications/message",
    params: {
      level,
      logger,
      data: message,
    },
  };
}
