import { Networks } from '@stellar/stellar-sdk';
import {
  AdminReceiptError,
  buildAdminActionReceipt,
  buildAdminTransactionExplorerUrl,
  normalizeAdminActionStatus,
} from '../src';

const HASH = 'A'.repeat(64);

describe('Admin action receipts', () => {
  it('builds a confirmed whitelist receipt with a Public Network explorer link', () => {
    const receipt = buildAdminActionReceipt({
      operation: 'whitelist-add',
      target: { address: 'GADMINRECIPIENT' },
      status: 'SUCCESS',
      transactionHash: HASH,
      networkPassphrase: Networks.PUBLIC,
      observedAt: '2026-07-28T09:00:00.000Z',
    });

    expect(receipt).toEqual({
      operation: 'whitelist-add',
      target: { address: 'GADMINRECIPIENT' },
      status: 'success',
      transactionHash: HASH.toLowerCase(),
      explorerUrl: `https://stellar.expert/explorer/public/tx/${HASH.toLowerCase()}`,
      observedAt: '2026-07-28T09:00:00.000Z',
      summary: 'Whitelist addition confirmed.',
    });
  });

  it('normalizes pending and failed RPC states without overstating finality', () => {
    expect(normalizeAdminActionStatus('DUPLICATE')).toBe('pending');
    expect(normalizeAdminActionStatus('NOT_FOUND')).toBe('pending');
    expect(normalizeAdminActionStatus('ERROR')).toBe('failed');
    expect(normalizeAdminActionStatus('a-new-rpc-state')).toBe('unknown');
  });

  it('represents pending asset registration without requiring a transaction hash', () => {
    const receipt = buildAdminActionReceipt({
      operation: 'asset-register',
      target: { assetId: 'USDC:GISSUER' },
      status: 'PENDING',
      networkPassphrase: Networks.TESTNET,
      observedAt: new Date('2026-07-28T09:01:00.000Z'),
    });

    expect(receipt.status).toBe('pending');
    expect(receipt.transactionHash).toBeNull();
    expect(receipt.explorerUrl).toBeNull();
    expect(receipt.summary).toBe('Asset registration is pending confirmation.');
  });

  it('supports failed pause actions and custom network explorer links', () => {
    const receipt = buildAdminActionReceipt({
      operation: 'protocol-pause',
      target: { contractId: 'CCUSTOMCONTRACT' },
      status: 'FAILED',
      transactionHash: HASH,
      networkPassphrase: 'Private Aegis Network',
      explorerBaseUrl: 'https://explorer.aegis.example/transactions/',
      failureCode: 'tx_bad_auth',
      observedAt: '2026-07-28T09:02:00.000Z',
    });

    expect(receipt.status).toBe('failed');
    expect(receipt.failureCode).toBe('TX_BAD_AUTH');
    expect(receipt.explorerUrl).toBe(
      `https://explorer.aegis.example/transactions/${HASH.toLowerCase()}`,
    );
  });

  it('represents unknown mint outcomes and only copies approved receipt fields', () => {
    const input = {
      operation: 'asset-mint' as const,
      target: {
        assetId: 'RWA-1',
        recipient: 'GRECIPIENT',
        amount: '125.50',
      },
      status: 'TRY_AGAIN_LATER',
      networkPassphrase: Networks.FUTURENET,
      observedAt: '2026-07-28T09:03:00.000Z',
      secret: 'SENSITIVE_VALUE_MUST_NOT_BE_COPIED',
      rawRpcResponse: { envelopeXdr: 'SENSITIVE_XDR' },
    };

    const receipt = buildAdminActionReceipt(input);

    expect(receipt.status).toBe('unknown');
    expect(receipt.explorerUrl).toBeNull();
    expect(receipt).not.toHaveProperty('secret');
    expect(receipt).not.toHaveProperty('rawRpcResponse');
    expect(JSON.stringify(receipt)).not.toContain('SENSITIVE');
  });

  it('rejects malformed hashes and successful receipts without a hash', () => {
    expect(() =>
      buildAdminTransactionExplorerUrl('not-a-hash', Networks.PUBLIC),
    ).toThrow(AdminReceiptError);

    expect(() =>
      buildAdminActionReceipt({
        operation: 'asset-register',
        target: { assetId: 'USDC:GISSUER' },
        status: 'PENDING',
        transactionHash: '',
        networkPassphrase: Networks.TESTNET,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_TRANSACTION_HASH',
      }),
    );

    expect(() =>
      buildAdminActionReceipt({
        operation: 'protocol-unpause',
        target: { contractId: 'CAEGIS' },
        status: 'SUCCESS',
        networkPassphrase: Networks.TESTNET,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'MISSING_TRANSACTION_HASH',
      }),
    );
  });

  it('rejects unsafe custom explorer URLs and non-positive mint amounts', () => {
    expect(() =>
      buildAdminTransactionExplorerUrl(
        HASH,
        'Private Aegis Network',
        'http://insecure.example/tx',
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_EXPLORER_URL',
      }),
    );

    expect(() =>
      buildAdminActionReceipt({
        operation: 'asset-mint',
        target: {
          assetId: 'RWA-1',
          recipient: 'GRECIPIENT',
          amount: '0',
        },
        status: 'PENDING',
        networkPassphrase: Networks.TESTNET,
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_AMOUNT',
      }),
    );
  });
});
