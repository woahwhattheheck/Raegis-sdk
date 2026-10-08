export interface PaginationInput {
  /** Opaque continuation token returned by the previous page. */
  cursor?: string;
  /** Maximum number of records requested for a page. */
  limit?: number;
}

export interface NormalizedPaginationInput {
  cursor?: string;
  limit: number;
}

export type PaginationContinuation =
  | { state: 'has_more'; cursor: string }
  | { state: 'complete' }
  | { state: 'unknown'; cursor?: string; reason: string };

export interface PaginationMetadata {
  /** Validated page size used for the read. */
  limit: number;
  /** Number of items returned in this page. */
  count: number;
  /** Explicit continuation state. Never infer "complete" from a missing cursor alone. */
  continuation: PaginationContinuation;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMetadata;
}
