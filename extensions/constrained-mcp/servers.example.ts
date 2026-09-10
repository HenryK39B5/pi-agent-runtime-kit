import type { McpAdapterOptions } from "pi-mcp-adapter";

/**
 * EXAMPLE ONLY. Replace every server entry after reviewing its operator,
 * transport, authentication, permissions, and write surface. Never commit secrets.
 */
export const REVIEWED_MCP_CONFIG = {
  settings: {
    toolPrefix: "server",
    mcpFooterStatus: "off",
    showStatusIcon: false,
    notifyOnStartupConnect: false,
    hostConfigDiscovery: "off",
    directTools: false,
    scriptMode: false,
    sampling: false,
    samplingAutoApprove: false,
    elicitation: false,
    autoAuth: false,
    outputGuard: true,
    toolResultRendering: "compact",
    collapsedResultLines: 1,
    requestTimeoutMs: 30_000,
    trace: { enabled: false },
  },
  mcpServers: {
    "example-header-server": {
      url: "https://mcp.example.invalid",
      headers: { Authorization: "${EXAMPLE_MCP_AUTH_HEADER}" },
      auth: false,
      protocolVersion: "auto",
      lifecycle: "lazy",
      idleTimeout: 10,
      requestTimeoutMs: 30_000,
      exposeResources: false,
      directTools: false,
      searchKeywords: { "*": ["example", "replace-me"] },
      debug: false,
      trace: false,
    },
    "example-oauth-server": {
      url: "https://oauth-mcp.example.invalid",
      auth: "oauth",
      protocolVersion: "auto",
      lifecycle: "lazy",
      idleTimeout: 10,
      requestTimeoutMs: 30_000,
      exposeResources: false,
      directTools: false,
      searchKeywords: { "*": ["oauth", "replace-me"] },
      debug: false,
      trace: false,
    },
  },
} as const satisfies NonNullable<McpAdapterOptions["config"]>;
