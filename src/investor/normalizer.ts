import {
  NormalizedInvestorPortfolio,
  NormalizedPortfolioAssetMetadata,
  NormalizedPortfolioHolding,
  PortfolioNormalizerOptions,
} from '../types/portfolio-normalizer';

type Row = Record<string, unknown>;
const DEFAULT_DECIMALS = 7;
const MAX_DECIMALS = 30;

const row = (value: unknown): Row | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Row)
    : null;

function first(source: Row | null, keys: readonly string[]): unknown {
  if (!source) return undefined;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = source[key];
    if (value !== null && value !== undefined) return value;
  }
  return undefined;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function stringFrom(primary: Row | null, nested: Row | null, keys: readonly string[]) {
  return text(first(primary, keys)) ?? text(first(nested, keys));
}

function integer(value: unknown): string | null {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isSafeInteger(value) ? String(value) : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^-?\d+$/.test(trimmed)
    ? trimmed.replace(/^(-?)0+(?=\d)/, '$1')
    : null;
}

function precision(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= MAX_DECIMALS
    ? parsed
    : null;
}

function unsupported(source: Row | null): boolean {
  if (!source) return false;
  return (
    source.supported === false ||
    source.isSupported === false ||
    source.unsupported === true ||
    (typeof source.status === 'string' &&
      source.status.toLowerCase() === 'unsupported')
  );
}

function metadataFor(
  source: Row | null,
  nested: Row | null,
  decimals: number | null,
  assetId: string | null,
): NormalizedPortfolioAssetMetadata {
  return {
    symbol: stringFrom(source, nested, ['symbol', 'assetSymbol', 'asset_symbol']),
    name: stringFrom(source, nested, ['name', 'assetName', 'asset_name']),
    decimals,
    category: stringFrom(source, nested, ['category', 'assetCategory', 'asset_category']),
    contractId: stringFrom(source, nested, ['contractId', 'contract_id']),
  };
}

export function formatPortfolioBalance(rawBalance: string, decimals: number): string {
  const normalized = integer(rawBalance);
  const scale = precision(decimals);
  if (normalized === null) {
    throw new TypeError('Portfolio balance must be an integer base-unit string.');
  }
  if (scale === null) {
    throw new RangeError(`Portfolio decimals must be between 0 and ${MAX_DECIMALS}.`);
  }

  const negative = normalized.startsWith('-');
  const absolute = negative ? normalized.slice(1) : normalized;
  const digits = absolute.replace(/^0+(?=\d)/, '') || '0';
  if (digits === '0') return '0';
  if (scale === 0) return `${negative ? '-' : ''}${digits}`;

  const padded = digits.padStart(scale + 1, '0');
  const whole = padded.slice(0, -scale);
  const fraction = padded.slice(-scale).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function getPortfolioHoldingDisplayLabel(
  holding: NormalizedPortfolioHolding,
): string {
  return holding.metadata.symbol ?? holding.metadata.name ?? holding.assetId ?? 'UNKNOWN';
}

export function normalizePortfolioHolding(
  input: unknown,
  options: PortfolioNormalizerOptions = {},
): NormalizedPortfolioHolding {
  const source = row(input);
  const nested = row(first(source, ['metadata', 'asset']));
  const assetId = stringFrom(source, nested, [
    'assetId',
    'asset_id',
    'contractId',
    'contract_id',
    'id',
  ]);

  const rawDecimals =
    first(source, ['decimals', 'assetDecimals', 'asset_decimals']) ??
    first(nested, ['decimals', 'assetDecimals', 'asset_decimals']);
  const defaultDecimals = precision(options.defaultDecimals ?? DEFAULT_DECIMALS);
  if (defaultDecimals === null) {
    throw new RangeError(`defaultDecimals must be between 0 and ${MAX_DECIMALS}.`);
  }
  const decimals =
    rawDecimals === undefined || rawDecimals === null
      ? defaultDecimals
      : precision(rawDecimals);

  const balance = integer(
    first(source, ['balance', 'rawBalance', 'raw_balance', 'amount', 'quantity']),
  );
  const metadata = metadataFor(source, nested, decimals, assetId);

  let status: NormalizedPortfolioHolding['status'] = 'supported';
  let code: NormalizedPortfolioHolding['code'];

  if (assetId === null) {
    status = 'unknown';
    code = 'MISSING_ASSET_ID';
  } else if (unsupported(source) || unsupported(nested)) {
    status = 'unsupported';
    code = 'UNSUPPORTED_ASSET';
  } else if (balance === null) {
    status = 'unsupported';
    code = 'INVALID_BALANCE';
  } else if (decimals === null) {
    status = 'unsupported';
    code = 'INVALID_DECIMALS';
  }

  return {
    status,
    ...(code ? { code } : {}),
    assetId,
    balance,
    decimalBalance:
      balance !== null && decimals !== null
        ? formatPortfolioBalance(balance, decimals)
        : null,
    metadata,
  };
}

export function normalizeInvestorPortfolio(
  inputs: readonly unknown[],
  options: PortfolioNormalizerOptions = {},
): NormalizedInvestorPortfolio {
  const holdings = inputs.map((input) => normalizePortfolioHolding(input, options));
  const supportedHoldingsCount = holdings.filter((h) => h.status === 'supported').length;
  const unknownHoldingsCount = holdings.filter((h) => h.status === 'unknown').length;
  const unsupportedHoldingsCount = holdings.filter((h) => h.status === 'unsupported').length;

  const state =
    holdings.length === 0
      ? 'empty'
      : supportedHoldingsCount === holdings.length
        ? 'ready'
        : supportedHoldingsCount === 0
          ? 'unusable'
          : 'partial';

  return {
    state,
    holdings,
    totalHoldingsCount: holdings.length,
    supportedHoldingsCount,
    unknownHoldingsCount,
    unsupportedHoldingsCount,
  };
}
