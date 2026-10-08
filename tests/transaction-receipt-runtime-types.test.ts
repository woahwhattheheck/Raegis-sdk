import { Networks } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import {
  buildTransactionReceipt,
  buildTransactionExplorerUrl,
  normalizeTransactionReceiptStatus,
} from '../src';

const mint = {
  operation: 'asset-mint' as const,
  target: { assetId: 'RWA-1', recipient: 'GRECIPIENT', amount: '2' },
  status: 'PENDING',
  networkPassphrase: Networks.TESTNET,
};

describe('receipt runtime type boundaries', () => {
  it('keeps malformed RPC statuses unknown instead of throwing or confirming', () => {
    expect(normalizeTransactionReceiptStatus(null as unknown as string)).toBe('unknown');
    const receipt = buildTransactionReceipt({
      ...mint, status: 7 as unknown as string,
    });
    expect(receipt.status).toBe('unknown');
    expect(receipt.summary).toContain('unknown outcome');
  });

  it('rejects wrong-type hashes and amounts with classified receipt errors', () => {
    expect(() => buildTransactionExplorerUrl(123 as unknown as string, Networks.TESTNET))
      .toThrow(expect.objectContaining({ code: 'INVALID_TRANSACTION_HASH' }));
    expect(() => buildTransactionReceipt({
      ...mint, target: { ...mint.target, amount: 7 as unknown as string },
    })).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
  });

  it('rejects invalid optional runtime metadata instead of coercing it', () => {
    expect(() => buildTransactionReceipt({
      ...mint, failureCode: 123 as unknown as string,
    })).toThrow(expect.objectContaining({ code: 'INVALID_FAILURE_CODE' }));
    expect(() => buildTransactionReceipt({
      ...mint, observedAt: null as unknown as string,
    })).toThrow(expect.objectContaining({ code: 'INVALID_TIMESTAMP' }));
  });
});
