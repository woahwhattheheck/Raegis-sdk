import {
  buildMockBooleanSimulationResult,
  buildMockI128SimulationResult,
  createDeterministicComplianceFixtures,
} from '../src/testing/fixtures';

describe('deterministic compliance fixtures', () => {
  it('covers all required compliance states with reusable contract outcomes', () => {
    const fixtures = createDeterministicComplianceFixtures();

    expect(Object.keys(fixtures.compliance).sort()).toEqual(
      [
        'approved',
        'rejected',
        'pending',
        'unknown',
        'unauthorised',
        'invalid',
      ].sort()
    );

    expect(fixtures.compliance.approved).toMatchObject({
      state: 'approved',
      whitelisted: true,
      contractResponse: { kind: 'success' },
    });
    expect(fixtures.compliance.rejected).toMatchObject({
      state: 'rejected',
      whitelisted: false,
      contractResponse: { kind: 'success' },
    });
    expect(fixtures.compliance.pending.contractResponse).toEqual({
      kind: 'pending',
      retryAfterLedgers: 1,
    });
    expect(fixtures.compliance.unknown.contractResponse).toEqual({
      kind: 'unknown',
    });
    expect(fixtures.compliance.unauthorised.contractResponse).toMatchObject({
      kind: 'error',
      code: 'UNAUTHORISED',
    });
    expect(fixtures.compliance.invalid.contractResponse).toMatchObject({
      kind: 'error',
      code: 'INVALID_ADDRESS',
    });
  });

  it('uses stable synthetic public accounts without serialized credential strings', () => {
    const first = createDeterministicComplianceFixtures();
    const second = createDeterministicComplianceFixtures();

    expect(first.accounts).toEqual(second.accounts);
    expect(JSON.stringify(first)).not.toMatch(/\bS[A-Z2-7]{55}\b/);
    expect(first.accounts.admin.role).toBe('admin');
    expect(first.accounts.approvedInvestor.role).toBe('investor');
    expect(first.accounts.approvedInvestor.address).toMatch(/^G[A-Z2-7]{55}$/);
    expect(first.accounts.invalidInvestor.address).toBe('not-a-stellar-address');
  });

  it('provides deterministic asset metadata and simulation helpers', () => {
    const fixtures = createDeterministicComplianceFixtures();
    const approved = buildMockBooleanSimulationResult(true);
    const balance = buildMockI128SimulationResult(5_000_000_000n);

    expect(fixtures.assetMetadata.primary).toMatchObject({
      symbol: 'AEGIS-RWA',
      isRwa: true,
      contractId: fixtures.contractId,
    });
    expect(fixtures.assetMetadata.secondary).toMatchObject({
      symbol: 'AEGIS-CREDIT',
      isRwa: true,
      contractId: fixtures.secondaryContractId,
    });
    expect(approved.result.retval).toEqual(
      fixtures.compliance.approved.contractResponse.kind === 'success'
        ? fixtures.compliance.approved.contractResponse.simulation.result.retval
        : ''
    );
    expect(balance.result.retval).toEqual(expect.any(String));
    expect(balance.result.retval.length).toBeGreaterThan(0);
  });

  it('rejects invalid positive-i128 fixture values', () => {
    expect(() => buildMockI128SimulationResult(-1n)).toThrow(RangeError);
    expect(() => buildMockI128SimulationResult(1n << 127n)).toThrow(RangeError);
  });
});
