import {
  AdminActionReceipt,
  AdminActionReceiptInput,
  AdminActionStatus,
  AdminReceiptError,
  AdminTransactionStatusInput,
} from '../types/admin-receipt';
import {
  buildTransactionExplorerUrlCore,
  isPositiveReceiptAmount,
  normalizeReceiptFailureCodeCore,
  normalizeReceiptObservedAtCore,
  normalizeTransactionHashCore,
  normalizeTransactionReceiptStatusCore,
} from '../transactions/receipt-core';

const OPERATION_LABELS: Readonly<Record<AdminActionReceiptInput['operation'], string>> = {
  'whitelist-add': 'Whitelist addition',
  'whitelist-remove': 'Whitelist removal',
  'asset-register': 'Asset registration',
  'protocol-pause': 'Protocol pause',
  'protocol-unpause': 'Protocol unpause',
  'asset-mint': 'Asset mint',
};

const STATUS_LABELS: Readonly<Record<AdminActionStatus, string>> = {
  success: 'confirmed',
  pending: 'is pending confirmation',
  failed: 'failed',
  unknown: 'has an unknown outcome',
};

const adminReceiptError = (
  code: ConstructorParameters<typeof AdminReceiptError>[0],
  message: string,
): AdminReceiptError => new AdminReceiptError(code, message);

export function normalizeAdminActionStatus(
  status: AdminTransactionStatusInput | string,
): AdminActionStatus {
  return normalizeTransactionReceiptStatusCore(status);
}

export function buildAdminTransactionExplorerUrl(
  transactionHash: string | null | undefined,
  networkPassphrase: string,
  explorerBaseUrl?: string,
): string | null {
  return buildTransactionExplorerUrlCore(
    transactionHash,
    networkPassphrase,
    explorerBaseUrl,
    adminReceiptError,
  );
}

export function buildAdminActionReceipt<TInput extends AdminActionReceiptInput>(
  input: TInput,
): AdminActionReceipt<TInput> {
  validateTarget(input);

  const status = normalizeAdminActionStatus(input.status);
  const transactionHash = input.transactionHash
    ? normalizeTransactionHashCore(input.transactionHash, adminReceiptError)
    : null;

  if (status === 'success' && !transactionHash) {
    throw new AdminReceiptError(
      'MISSING_TRANSACTION_HASH',
      'A successful admin action receipt requires a transaction hash.',
    );
  }

  const observedAt = normalizeReceiptObservedAtCore(input.observedAt, adminReceiptError);
  const failureCode = normalizeReceiptFailureCodeCore(input.failureCode, adminReceiptError);

  const receipt: AdminActionReceipt<TInput> = {
    operation: input.operation,
    target: cloneTarget(input),
    status,
    transactionHash,
    explorerUrl: buildAdminTransactionExplorerUrl(
      transactionHash,
      input.networkPassphrase,
      input.explorerBaseUrl,
    ),
    observedAt,
    summary: `${OPERATION_LABELS[input.operation]} ${STATUS_LABELS[status]}.`,
    ...(failureCode ? { failureCode } : {}),
  };

  return Object.freeze(receipt);
}

function validateTarget(input: AdminActionReceiptInput): void {
  const requireValue = (value: string, field: string): void => {
    if (!value || !value.trim()) {
      throw new AdminReceiptError('INVALID_TARGET', `${field} is required.`);
    }
  };

  switch (input.operation) {
    case 'whitelist-add':
    case 'whitelist-remove':
      requireValue(input.target.address, 'Whitelist address');
      return;
    case 'asset-register':
      requireValue(input.target.assetId, 'Asset identifier');
      return;
    case 'protocol-pause':
    case 'protocol-unpause':
      requireValue(input.target.contractId, 'Contract identifier');
      return;
    case 'asset-mint':
      requireValue(input.target.assetId, 'Asset identifier');
      requireValue(input.target.recipient, 'Mint recipient');
      if (!isPositiveReceiptAmount(input.target.amount)) {
        throw new AdminReceiptError(
          'INVALID_AMOUNT',
          'Mint amount must be a positive decimal string.',
        );
      }
  }
}

function cloneTarget<TInput extends AdminActionReceiptInput>(
  input: TInput,
): TInput['target'] {
  return Object.freeze({ ...input.target }) as TInput['target'];
}
