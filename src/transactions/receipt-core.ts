import { Networks } from '@stellar/stellar-sdk';
import {
  TransactionReceiptErrorCode,
  TransactionReceiptStatus,
  TransactionReceiptStatusInput,
} from '../types/transaction-receipt';

export type ReceiptErrorFactory = (
  code: TransactionReceiptErrorCode,
  message: string,
) => Error;

const TRANSACTION_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;
const FAILURE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_.:-]{0,63}$/;
const POSITIVE_AMOUNT_PATTERN = /^(?:0*[1-9]\d*)(?:\.\d+)?$|^0*\.\d*[1-9]\d*$/;

const EXPLORER_TRANSACTION_BASES: Readonly<Record<string, string>> = {
  [Networks.PUBLIC]: 'https://stellar.expert/explorer/public/tx',
  [Networks.TESTNET]: 'https://stellar.expert/explorer/testnet/tx',
  [Networks.FUTURENET]: 'https://stellar.expert/explorer/futurenet/tx',
};

const STATUS_ALIASES: Readonly<Record<string, TransactionReceiptStatus>> = {
  SUCCESS: 'success',
  CONFIRMED: 'success',
  PENDING: 'pending',
  DUPLICATE: 'pending',
  NOT_FOUND: 'pending',
  FAILED: 'failed',
  ERROR: 'failed',
  TRY_AGAIN_LATER: 'unknown',
  UNKNOWN: 'unknown',
};

export function normalizeTransactionReceiptStatusCore(
  status: TransactionReceiptStatusInput | string,
): TransactionReceiptStatus {
  return STATUS_ALIASES[status.trim().toUpperCase()] ?? 'unknown';
}

export function normalizeTransactionHashCore(
  transactionHash: string,
  errorFactory: ReceiptErrorFactory,
): string {
  const normalizedHash = transactionHash.trim().toLowerCase();
  if (!TRANSACTION_HASH_PATTERN.test(normalizedHash)) {
    throw errorFactory(
      'INVALID_TRANSACTION_HASH',
      'Transaction hash must contain exactly 64 hexadecimal characters.',
    );
  }
  return normalizedHash;
}

export function buildTransactionExplorerUrlCore(
  transactionHash: string | null | undefined,
  networkPassphrase: string,
  explorerBaseUrl: string | undefined,
  errorFactory: ReceiptErrorFactory,
): string | null {
  if (!transactionHash) return null;

  const normalizedHash = normalizeTransactionHashCore(transactionHash, errorFactory);
  const standardBase = EXPLORER_TRANSACTION_BASES[networkPassphrase];
  const base = standardBase ?? normalizeCustomExplorerBase(explorerBaseUrl, errorFactory);
  return base ? `${base}/${normalizedHash}` : null;
}

export function normalizeReceiptObservedAtCore(
  observedAt: Date | string | undefined,
  errorFactory: ReceiptErrorFactory,
): string {
  const date = observedAt instanceof Date ? observedAt : new Date(observedAt ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw errorFactory('INVALID_TIMESTAMP', 'Receipt timestamp must be a valid date.');
  }
  return date.toISOString();
}

export function normalizeReceiptFailureCodeCore(
  failureCode: string | undefined,
  errorFactory: ReceiptErrorFactory,
): string | undefined {
  if (!failureCode) return undefined;

  const normalized = failureCode.trim().toUpperCase();
  if (!FAILURE_CODE_PATTERN.test(normalized)) {
    throw errorFactory(
      'INVALID_FAILURE_CODE',
      'Failure code must be 1-64 safe uppercase identifier characters.',
    );
  }
  return normalized;
}

export function isPositiveReceiptAmount(amount: string): boolean {
  return POSITIVE_AMOUNT_PATTERN.test(amount.trim());
}

function normalizeCustomExplorerBase(
  explorerBaseUrl: string | undefined,
  errorFactory: ReceiptErrorFactory,
): string | null {
  if (!explorerBaseUrl) return null;

  try {
    const parsed = new URL(explorerBaseUrl);
    if (parsed.protocol !== 'https:') throw new Error('Explorer URL must use HTTPS.');
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    throw errorFactory(
      'INVALID_EXPLORER_URL',
      'Custom explorer base URL must be a valid HTTPS URL.',
    );
  }
}
