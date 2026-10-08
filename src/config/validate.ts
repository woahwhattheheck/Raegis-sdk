import { Keypair } from '@stellar/stellar-sdk';
import { AEGIS_ENVIRONMENTS, AegisEnvironmentName } from './environments';
import { ConfigValidationError } from '../errors/config';

/**
 * Configuration accepted by `AegisClient`.
 *
 * Provide either:
 *  - `environment`: a named preset (`testnet` | `local` | `mainnet`), optionally
 *    overriding `rpcUrl` and/or `networkPassphrase`, or
 *  - explicit `rpcUrl` and `networkPassphrase` values (legacy/fully custom setups).
 */
export interface AegisClientConfig {
  contractId: string;
  keypair?: Keypair;
  environment?: AegisEnvironmentName;
  rpcUrl?: string;
  networkPassphrase?: string;
  /** Required to opt into the `mainnet` preset while it is marked unavailable. */
  allowMainnet?: boolean;
}

export interface ResolvedAegisConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  keypair?: Keypair;
}

function validateRpcUrl(rpcUrl: string, opts: { allowInsecure: boolean }): void {
  let parsed: URL;
  try {
    parsed = new URL(rpcUrl);
  } catch {
    throw new ConfigValidationError(`Invalid rpcUrl: "${rpcUrl}" is not a valid URL.`, 'INVALID_RPC_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ConfigValidationError(
      `Invalid rpcUrl: unsupported protocol "${parsed.protocol}" in "${rpcUrl}".`,
      'INVALID_RPC_URL'
    );
  }

  if (parsed.protocol === 'http:' && !opts.allowInsecure) {
    throw new ConfigValidationError(
      `Insecure rpcUrl "${rpcUrl}" is not allowed for this environment. Use an https:// endpoint, or the "local" environment preset for plain http.`,
      'INVALID_RPC_URL'
    );
  }
}

function validateNetworkPassphrase(networkPassphrase: string): void {
  if (typeof networkPassphrase !== 'string' || networkPassphrase.trim().length === 0) {
    throw new ConfigValidationError('Invalid networkPassphrase: must be a non-empty string.', 'INVALID_NETWORK_PASSPHRASE');
  }
}

/**
 * Resolves and validates an `AegisClientConfig` into concrete rpcUrl/networkPassphrase
 * values, merging in an environment preset when one is specified.
 */
export function resolveClientConfig(config: AegisClientConfig): ResolvedAegisConfig {
  if (!config || typeof config.contractId !== 'string' || config.contractId.length === 0) {
    throw new ConfigValidationError('AegisClientConfig.contractId is required.', 'MISSING_CONFIG');
  }

  let rpcUrl: string;
  let networkPassphrase: string;

  if (config.environment) {
    const preset = AEGIS_ENVIRONMENTS[config.environment];
    if (!preset) {
      throw new ConfigValidationError(
        `Unknown environment "${config.environment}". Valid options: ${Object.keys(AEGIS_ENVIRONMENTS).join(', ')}.`,
        'MISSING_CONFIG'
      );
    }

    if (!preset.available && !config.allowMainnet) {
      throw new ConfigValidationError(
        `The "${preset.name}" environment is not yet available (${preset.description}). ` +
          'Pass `allowMainnet: true` to opt in explicitly once you understand the risks.',
        'ENVIRONMENT_UNAVAILABLE'
      );
    }

    const allowInsecure = config.environment === 'local';

    if (config.rpcUrl) {
      validateRpcUrl(config.rpcUrl, { allowInsecure });
    }
    if (config.networkPassphrase) {
      validateNetworkPassphrase(config.networkPassphrase);
    }

    rpcUrl = config.rpcUrl ?? preset.rpcUrl;
    networkPassphrase = config.networkPassphrase ?? preset.networkPassphrase;
  } else {
    if (!config.rpcUrl || !config.networkPassphrase) {
      throw new ConfigValidationError(
        'AegisClientConfig requires either an "environment" preset (testnet/local/mainnet) ' +
          'or explicit "rpcUrl" and "networkPassphrase" values.',
        'MISSING_CONFIG'
      );
    }

    validateRpcUrl(config.rpcUrl, { allowInsecure: true });
    validateNetworkPassphrase(config.networkPassphrase);

    rpcUrl = config.rpcUrl;
    networkPassphrase = config.networkPassphrase;
  }

  return {
    rpcUrl,
    networkPassphrase,
    contractId: config.contractId,
    keypair: config.keypair,
  };
}


/** Shared input accepted by paginated SDK reads. Network cursors remain opaque. */
export interface PaginationInput {
  cursor?: string;
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
  limit: number;
  count: number;
  continuation: PaginationContinuation;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMetadata;
}

export type PaginationValidationErrorCode = 'INVALID_CURSOR' | 'INVALID_LIMIT';

export class PaginationValidationError extends Error {
  public readonly code: PaginationValidationErrorCode;

  constructor(message: string, code: PaginationValidationErrorCode) {
    super(message);
    this.name = 'PaginationValidationError';
    this.code = code;
    Object.setPrototypeOf(this, PaginationValidationError.prototype);
  }
}

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;
const MAX_CURSOR_LENGTH = 2048;
const OFFSET_CURSOR_PREFIX = 'offset:';

/** Validates cursor/limit without probing a remote provider. */
export function normalizePaginationInput(
  input: PaginationInput = {},
  defaults: { defaultLimit?: number; maxLimit?: number } = {}
): NormalizedPaginationInput {
  const defaultLimit = defaults.defaultLimit ?? DEFAULT_PAGE_LIMIT;
  const maxLimit = defaults.maxLimit ?? MAX_PAGE_LIMIT;
  const limit = input.limit ?? defaultLimit;

  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new PaginationValidationError(
      `Pagination limit must be an integer between 1 and ${maxLimit}.`,
      'INVALID_LIMIT'
    );
  }

  if (input.cursor === undefined) {
    return { limit };
  }

  if (
    typeof input.cursor !== 'string' ||
    input.cursor.trim().length === 0 ||
    input.cursor.length > MAX_CURSOR_LENGTH
  ) {
    throw new PaginationValidationError(
      'Pagination cursor must be a non-empty string within the supported size.',
      'INVALID_CURSOR'
    );
  }

  return { cursor: input.cursor.trim(), limit };
}

/**
 * Converts a provider page into an explicit continuation state.
 * A full page plus cursor is deliberately "unknown": the cursor enables another
 * read but does not prove that another record exists.
 */
export function inferPaginationContinuation(input: {
  cursor?: string;
  count: number;
  limit: number;
  sourceExhausted?: boolean;
}): PaginationContinuation {
  if (input.sourceExhausted === true || input.count < input.limit) {
    return { state: 'complete' };
  }

  if (input.cursor) {
    return {
      state: 'unknown',
      cursor: input.cursor,
      reason:
        'The source returned a full page and a cursor but no explicit has-more marker.',
    };
  }

  return {
    state: 'unknown',
    reason: 'The source returned a full page without an explicit continuation signal.',
  };
}

/** Pages an SDK-owned in-memory collection with deterministic offset cursors. */
export function paginateArray<T>(
  items: readonly T[],
  input: PaginationInput = {}
): PaginatedResult<T> {
  const pagination = normalizePaginationInput(input);
  const start = decodeOffsetCursor(pagination.cursor, items.length);
  const pageItems = items.slice(start, start + pagination.limit);
  const nextOffset = start + pageItems.length;

  return {
    items: pageItems,
    pagination: {
      limit: pagination.limit,
      count: pageItems.length,
      continuation:
        nextOffset < items.length
          ? { state: 'has_more', cursor: `${OFFSET_CURSOR_PREFIX}${nextOffset}` }
          : { state: 'complete' },
    },
  };
}

function decodeOffsetCursor(cursor: string | undefined, length: number): number {
  if (!cursor) return 0;

  const match = /^offset:(\d+)$/.exec(cursor);
  if (!match) {
    throw new PaginationValidationError(
      'This in-memory page expects a cursor returned by the SDK paging helper.',
      'INVALID_CURSOR'
    );
  }

  const offset = Number(match[1]);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > length) {
    throw new PaginationValidationError(
      'Pagination cursor points outside the available collection.',
      'INVALID_CURSOR'
    );
  }

  return offset;
}
