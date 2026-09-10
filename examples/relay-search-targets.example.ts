import type { SearchTarget } from "../extensions/relay-search/config.ts";

/** Replace these reserved examples only after real provider/model testing. */
export const EXAMPLE_SEARCH_TARGETS: readonly SearchTarget[] = [
  {
    provider: "example-provider",
    id: "replace-with-tested-model-id",
    api: "openai-responses",
    toolType: "web_search",
  },
];
