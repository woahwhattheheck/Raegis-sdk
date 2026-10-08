import { AegisClient } from '../src/client';
import { Keypair, Networks, rpc, xdr } from '@stellar/stellar-sdk';

jest.mock('@stellar/stellar-sdk', () => {
  const original = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...original,
    rpc: {
      ...original.rpc,
      Server: jest.fn().mockImplementation(() => ({
        simulateTransaction: jest.fn(),
      })),
      Api: {
        ...original.rpc.Api,
        isSimulationSuccess: jest.fn(),
      },
    },
  };
});

describe('ComplianceModule.checkReadiness (#143)', () => {
  const address = Keypair.random().publicKey();
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
  let client: AegisClient;
  let server: jest.Mocked<{ simulateTransaction: jest.Mock }>;

  const whitelist = (approved: boolean) => {
    (rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(true);
    server.simulateTransaction.mockResolvedValue({
      result: { retval: xdr.ScVal.scvBool(approved).toXDR('base64') },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new AegisClient({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: Networks.TESTNET,
      contractId,
    });
    server = client.rpcServer as unknown as typeof server;
  });

  it('returns whitelist-approved readiness only for investor transfers', async () => {
    whitelist(true);
    const ready = await client.compliance.checkReadiness(address);
    expect(ready).toMatchObject({
      status: 'approved',
      code: 'WHITELIST_APPROVED',
      canAttempt: true,
      onChainWhitelisted: true,
      evidenceSource: 'contract_whitelist',
    });
    expect(server.simulateTransaction).toHaveBeenCalledTimes(1);
  });

  it('never interprets contract whitelist approval as administrator permission', async () => {
    whitelist(true);
    const ready = await client.compliance.checkReadiness(address, { operation: 'admin_action' });
    expect(ready).toMatchObject({
      status: 'unknown',
      code: 'ADMIN_AUTHORITY_NOT_QUERYABLE',
      canAttempt: false,
      onChainWhitelisted: true,
    });
  });

  it('keeps a failed whitelist check unclassified without independent evidence', async () => {
    whitelist(false);
    const ready = await client.compliance.checkReadiness(address);
    expect(ready).toMatchObject({
      status: 'unknown',
      code: 'WHITELIST_NOT_APPROVED',
      onChainWhitelisted: false,
      canAttempt: false,
    });
    await expect(client.compliance.checkWhitelist(address)).resolves.toBe(false);
  });

  it.each([
    ['blocked', 'EVIDENCE_BLOCKED'],
    ['revoked', 'EVIDENCE_REVOKED'],
    ['pending', 'EVIDENCE_PENDING'],
    ['unknown', 'EVIDENCE_UNKNOWN'],
  ] as const)('maps independent %s evidence without granting protocol permission', async (status, code) => {
    whitelist(false);
    const evidenceLookup = jest.fn().mockResolvedValue(status);
    const ready = await client.compliance.checkReadiness(address, { evidenceLookup });
    expect(evidenceLookup).toHaveBeenCalledWith(address);
    expect(ready).toMatchObject({
      status,
      code,
      evidenceSource: 'external_evidence',
      onChainWhitelisted: false,
      canAttempt: false,
    });
  });

  it('ignores an unexpected evidence state instead of trusting a provider response', async () => {
    whitelist(false);
    const ready = await client.compliance.checkReadiness(address, {
      evidenceLookup: async () => 'approved' as any,
    });
    expect(ready).toMatchObject({
      status: 'unknown',
      code: 'EVIDENCE_UNKNOWN',
      canAttempt: false,
    });
  });

  it('keeps a missing evidence provider distinct from a failed on-chain query', async () => {
    whitelist(false);
    const ready = await client.compliance.checkReadiness(address, {
      evidenceLookup: async () => { throw new Error('private-provider-secret'); },
    });
    expect(ready).toMatchObject({
      status: 'unknown',
      code: 'EVIDENCE_LOOKUP_FAILED',
      onChainWhitelisted: false,
    });
    expect(JSON.stringify(ready)).not.toContain('private-provider-secret');
  });

  it('reports an ambiguous Soroban simulation as unavailable, not blocked', async () => {
    (rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(false);
    server.simulateTransaction.mockResolvedValue({ error: 'simulation unavailable' });
    const ready = await client.compliance.checkReadiness(address);
    expect(ready).toMatchObject({
      status: 'unavailable',
      code: 'SIMULATION_UNAVAILABLE',
      onChainWhitelisted: null,
      canAttempt: false,
    });
    await expect(client.compliance.checkWhitelist(address)).resolves.toBe(false);
  });

  it('reports network failures without leaking the provider error or granting permission', async () => {
    server.simulateTransaction.mockRejectedValue(new Error('rpc failed https://user:secret@host'));
    const ready = await client.compliance.checkReadiness(address);
    expect(ready).toMatchObject({
      status: 'unavailable',
      code: 'RPC_UNAVAILABLE',
      onChainWhitelisted: null,
      canAttempt: false,
    });
    expect(JSON.stringify(ready)).not.toContain('secret');
  });

  it('rejects malformed addresses before any RPC or evidence lookup', async () => {
    const evidenceLookup = jest.fn();
    const ready = await client.compliance.checkReadiness('not-a-stellar-address', {
      evidenceLookup,
    });
    expect(ready).toMatchObject({
      address: '',
      status: 'unknown',
      code: 'INVALID_ADDRESS',
      onChainWhitelisted: null,
      canAttempt: false,
    });
    expect(server.simulateTransaction).not.toHaveBeenCalled();
    expect(evidenceLookup).not.toHaveBeenCalled();
  });
});
