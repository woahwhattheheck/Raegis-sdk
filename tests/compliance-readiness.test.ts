import { Keypair, Networks } from '@stellar/stellar-sdk';
import { AegisClient } from '../src/client';
import { mapComplianceReadiness } from '../src/compliance';
import { ComplianceProtocolStatus } from '../src/types/compliance-readiness';

describe('compliance readiness', () => {
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
  const makeClient = () =>
    new AegisClient({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: Networks.TESTNET,
      contractId,
    });

  test.each<[ComplianceProtocolStatus, string, boolean, string]>([
    [true, 'approved', true, 'APPROVED'],
    [false, 'blocked', false, 'NOT_WHITELISTED'],
    ['revoked', 'revoked', false, 'REVOKED'],
    ['pending', 'pending', false, 'PENDING_REVIEW'],
    ['unknown', 'unknown', false, 'STATUS_UNKNOWN'],
    ['unavailable', 'unavailable', false, 'STATUS_UNAVAILABLE'],
  ])('maps %p to %s readiness', (status, state, eligible, code) => {
    const result = mapComplianceReadiness('GTEST', status, '2026-10-08T00:00:00.000Z');
    expect(result.state).toBe(state);
    expect(result.eligible).toBe(eligible);
    expect(result.code).toBe(code);
  });

  it('returns approved after a successful whitelist read', async () => {
    const client = makeClient();
    jest.spyOn(client.compliance, 'checkWhitelist').mockResolvedValue(true);
    const result = await client.compliance.checkReadiness(Keypair.random().publicKey());
    expect(result.state).toBe('approved');
    expect(result.eligible).toBe(true);
    expect(result.verified).toBe(true);
  });

  it('returns blocked after a successful negative whitelist read', async () => {
    const client = makeClient();
    jest.spyOn(client.compliance, 'checkWhitelist').mockResolvedValue(false);
    const result = await client.compliance.checkReadiness(Keypair.random().publicKey());
    expect(result.state).toBe('blocked');
    expect(result.code).toBe('NOT_WHITELISTED');
    expect(result.verified).toBe(true);
  });

  it('returns unavailable when the compliance read fails', async () => {
    const client = makeClient();
    jest.spyOn(client.compliance, 'checkWhitelist').mockRejectedValue(new Error('RPC unavailable'));
    const result = await client.compliance.checkReadiness(Keypair.random().publicKey());
    expect(result.state).toBe('unavailable');
    expect(result.code).toBe('STATUS_UNAVAILABLE');
    expect(result.verified).toBe(false);
    expect(result.reason).not.toContain('RPC unavailable');
  });

  it('rejects an invalid address without performing a compliance read', async () => {
    const client = makeClient();
    const spy = jest.spyOn(client.compliance, 'checkWhitelist');
    const result = await client.compliance.checkReadiness('not-a-stellar-address');
    expect(result.state).toBe('unknown');
    expect(result.code).toBe('INVALID_ADDRESS');
    expect(spy).not.toHaveBeenCalled();
  });
});
