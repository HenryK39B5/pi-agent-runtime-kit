/**
 * Reviewed capability declarations, not model-name inference or remote discovery.
 * Keep this list empty until a provider/model/API combination has been tested.
 * No URLs, credentials, proxy settings, or model parameters belong here.
 */
export interface SearchTarget {
  readonly provider: string;
  readonly id: string;
  readonly api: "openai-responses";
  readonly toolType: "web_search" | "web_search_preview";
}

export const SEARCH_TARGETS: readonly SearchTarget[] = [];

// Deliberate opt-in. Changing model does not itself enable search.
export const SEARCH_DEFAULT_ENABLED = false;
