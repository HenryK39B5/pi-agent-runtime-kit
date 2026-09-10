import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMcpAdapter } from "pi-mcp-adapter";
import { REVIEWED_MCP_CONFIG } from "./servers.example.ts";
import { withRegistryCommandCompletions } from "./commands.ts";

// Programmatic config is intentionally isolated from ambient/project MCP files.
const adapter = createMcpAdapter({ config: REVIEWED_MCP_CONFIG });

export default function constrainedMcp(pi: ExtensionAPI) {
  adapter(withRegistryCommandCompletions(pi, Object.keys(REVIEWED_MCP_CONFIG.mcpServers)));
}
