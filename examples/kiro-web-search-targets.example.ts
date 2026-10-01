import type { KiroTarget } from "../extensions/kiro-web-search/config.ts";
/** Shape only. This invalid endpoint is not a working service or a capability claim. */
export const EXAMPLE_KIRO_TARGETS: readonly KiroTarget[] = [{
  provider: "replace-with-reviewed-provider",
  id: "replace-with-tested-model-id",
  api: "anthropic-messages",
  baseUrl: "https://gateway.example.invalid",
  allowUnreferencedSingleResult: false,
}];
