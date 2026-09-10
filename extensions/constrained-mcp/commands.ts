import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type CommandOptions = Parameters<ExtensionAPI["registerCommand"]>[1];

export function mcpAuthArgumentCompletions(prefix: string, serverNames: readonly string[]) {
  const normalized = prefix.trimStart();
  const items = serverNames
    .filter(serverName => serverName.startsWith(normalized))
    .map(serverName => ({ value: serverName, label: serverName }));
  return items.length ? items : null;
}

/** Preserve upstream command behavior and fill only a missing finite-registry completion. */
export function withRegistryCommandCompletions(pi: ExtensionAPI, serverNames: readonly string[]): ExtensionAPI {
  return new Proxy(pi, {
    get(target, property) {
      if (property === "registerCommand") {
        return (name: string, options: CommandOptions) => target.registerCommand(name,
          name === "mcp-auth" && !options.getArgumentCompletions
            ? { ...options, getArgumentCompletions: prefix => mcpAuthArgumentCompletions(prefix, serverNames) }
            : options);
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
