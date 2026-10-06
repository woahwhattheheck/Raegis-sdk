# Asset registry cache policy

The SDK is cache-free by default. Applications that choose to cache asset
registry reads own the storage, time-to-live, and invalidation behavior.

## Identity and freshness

Each cache entry is scoped by the exact tuple of network passphrase, contract
ID, and asset ID. Do not reuse an entry after any part of that tuple changes.

Use `isAssetRegistryCacheEntryFresh(entry, expectedScope, nowMs?)` before a
cached read. It rejects scope mismatches, expired entries, non-finite
timestamps, and entries written in the future. The expiry boundary is
exclusive: an entry with `expiresAtMs === nowMs` is stale.

`AssetRegistryCacheAdapter<T>` is intentionally small: `get`, `set`, and
`delete`. It does not select a persistence technology or TTL.

## Invalidation rules

Delete or bypass an affected entry when any of these occurs:

1. a successful local asset-registry write;
2. an asset-status or registry event for that asset;
3. an event-stream/indexer gap or reset;
4. a network or contract-deployment change;
5. an explicit operator refresh.

`AssetRegistryCacheInvalidationReason` provides stable names for those cases.

A failed refresh must not extend the previous `expiresAtMs`. If event
continuity is uncertain, perform an authoritative read instead of assuming that
silence means the asset is unchanged.

## Example

```ts
import {
  AssetRegistryCacheEntry,
  AssetRegistryCacheScope,
  isAssetRegistryCacheEntryFresh,
} from '@aegis/sdk';

const scope: AssetRegistryCacheScope = {
  networkPassphrase: client.networkPassphrase,
  contractId: client.contractId,
  assetId,
};

const cached = await cache.get(scope);
if (cached && isAssetRegistryCacheEntryFresh(cached, scope)) {
  renderAsset(cached.value);
} else {
  const value = await loadAssetFromAuthoritativeSource(assetId);
  const now = Date.now();
  const next: AssetRegistryCacheEntry<typeof value> = {
    scope,
    value,
    cachedAtMs: now,
    expiresAtMs: now + 30_000,
  };
  await cache.set(next);
  renderAsset(value);
}
```

Cached registry data is a read optimization, not authorization for a
state-changing operation. Refresh the authoritative state when a product's
correctness or safety depends on current registry state.
