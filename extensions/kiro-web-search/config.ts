/** Reviewed, protocol-specific capabilities. Empty means no helper can execute. */
export interface KiroTarget {
  readonly provider: string;
  readonly id: string;
  readonly api: "anthropic-messages";
  /** HTTPS origin only, no path/query/credentials. Authentication remains owned by Pi. */
  readonly baseUrl: string;
  readonly requiredUserAgent?: string;
  /** Off unless a bounded target-specific test proves the narrow adjacent-result variation. */
  readonly allowUnreferencedSingleResult?: boolean;
}
export const KIRO_TARGETS: readonly KiroTarget[] = [];
