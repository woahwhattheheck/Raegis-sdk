import { Keypair, Networks } from '@stellar/stellar-sdk';
import { AegisClient } from '../src/client';

describe('transfer eligibility', () => {
  const makeClient = () =>
    new AegisClient({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: Networks.TESTNET,
      contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    });

  it('validates before network reads', async () => {
    const client = makeClient();
    const observe = jest.spyOn(client.compliance, 'observeWhitelist');
    const result = await client.investor.checkTransferEligibility(
      'bad',
      Keypair.random().publicKey(),
      1,
    );
    expect(result.reasonCode).toBe('INVALID_SOURCE_ADDRESS');
    expect(observe).not.toHaveBeenCalled();
  });

  it('short-circuits on source rejection', async () => {
    const client = makeClient();
    const observe = jest.spyOn(client.compliance, 'observeWhitelist').mockResolvedValue({
      status: 'not-whitelisted',
      approved: false,
      reasonCode: 'NOT_WHITELISTED',
    });
    const result = await client.investor.checkTransferEligibility(
      Keypair.random().publicKey(),
      Keypair.random().publicKey(),
      1,
    );
    expect(result.reasonCode).toBe('SOURCE_NOT_WHITELISTED');
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it('returns eligible after both approvals', async () => {
    const client = makeClient();
    jest.spyOn(client.compliance, 'observeWhitelist').mockResolvedValue({
      status: 'approved',
      approved: true,
      reasonCode: 'WHITELIST_APPROVED',
    });
    const result = await client.investor.checkTransferEligibility(
      Keypair.random().publicKey(),
      Keypair.random().publicKey(),
      1,
    );
    expect(result.status).toBe('eligible');
    expect(result.eligible).toBe(true);
  });
});
