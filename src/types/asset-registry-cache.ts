/**
 * Identity for one consumer-owned asset registry cache entry.
 */
export interface AssetRegistryCacheScope {
  networkPassphrase: string;
  contractId: string;
  assetId: string;
}

export interface AssetRegistryCacheEntry<T> {
  scope: AssetRegistryCacheScope;
  value: T;
  cachedAtMs: number;
  expiresAtMs: number;
}

export interface AssetRegistryCacheAdapter<T> {
  get(
    scope: AssetRegistryCacheScope
  ):
    | AssetRegistryCacheEntry<T>
    | undefined
    | Promise<AssetRegistryCacheEntry<T> | undefined>;
  set(entry: AssetRegistryCacheEntry<T>): void | Promise<void>;
  delete(scope: AssetRegistryCacheScope): void | Promise<void>;
}

export type AssetRegistryCacheInvalidationReason =
  | 'asset-write'
  | 'asset-status-event'
  | 'registry-event-gap'
  | 'network-change'
  | 'contract-change'
  | 'manual';

export function isSameAssetRegistryCacheScope(
  left: AssetRegistryCacheScope,
  right: AssetRegistryCacheScope
): boolean {
  return (
    left.networkPassphrase === right.networkPassphrase &&
    left.contractId === right.contractId &&
    left.assetId === right.assetId
  );
}

export function isAssetRegistryCacheEntryFresh<T>(
  entry: AssetRegistryCacheEntry<T>,
  expectedScope: AssetRegistryCacheScope,
  nowMs: number = Date.now()
): boolean {
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(entry.cachedAtMs) ||
    !Number.isFinite(entry.expiresAtMs)
  ) {
    return false;
  }

  if (
    entry.cachedAtMs > nowMs ||
    entry.expiresAtMs <= entry.cachedAtMs ||
    entry.expiresAtMs <= nowMs
  ) {
    return false;
  }

  return isSameAssetRegistryCacheScope(entry.scope, expectedScope);
}
