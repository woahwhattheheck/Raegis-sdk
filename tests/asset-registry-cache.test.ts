import {
  AssetRegistryCacheEntry,
  AssetRegistryCacheScope,
  isAssetRegistryCacheEntryFresh,
  isSameAssetRegistryCacheScope,
} from '../src';

const scope: AssetRegistryCacheScope = {
  networkPassphrase: 'network-a',
  contractId: 'contract-a',
  assetId: 'asset-a',
};

function entry(
  overrides: Partial<AssetRegistryCacheEntry<string>> = {}
): AssetRegistryCacheEntry<string> {
  return {
    scope,
    value: 'active',
    cachedAtMs: 1000,
    expiresAtMs: 2000,
    ...overrides,
  };
}

describe('asset registry cache policy', () => {
  test('freshness requires exact scope and a live lifetime', () => {
    expect(isAssetRegistryCacheEntryFresh(entry(), scope, 1500)).toBe(true);
    expect(isAssetRegistryCacheEntryFresh(entry(), scope, 2000)).toBe(false);
    expect(
      isAssetRegistryCacheEntryFresh(
        entry(),
        { ...scope, assetId: 'asset-b' },
        1500
      )
    ).toBe(false);
  });

  test('future and invalid timestamps are stale', () => {
    expect(
      isAssetRegistryCacheEntryFresh(
        entry({ cachedAtMs: 1600 }),
        scope,
        1500
      )
    ).toBe(false);
    expect(
      isAssetRegistryCacheEntryFresh(
        entry({ expiresAtMs: Number.POSITIVE_INFINITY }),
        scope,
        1500
      )
    ).toBe(false);
  });

  test('scope matching is exact across all identity fields', () => {
    expect(isSameAssetRegistryCacheScope(scope, { ...scope })).toBe(true);
    expect(
      isSameAssetRegistryCacheScope(scope, {
        ...scope,
        contractId: 'contract-b',
      })
    ).toBe(false);
    expect(
      isSameAssetRegistryCacheScope(scope, {
        ...scope,
        networkPassphrase: 'network-b',
      })
    ).toBe(false);
  });
});
