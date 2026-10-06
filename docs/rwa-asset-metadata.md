# RWA asset metadata parser

The SDK exports a runtime parser for asset metadata received from contract,
indexer, API, or dashboard boundaries. It returns the same `AssetMetadata`
shape used by the investor portfolio model.

## Metadata shape

Required fields:

| Field | Runtime rule |
| --- | --- |
| `symbol` | non-empty string |
| `name` | non-empty string |
| `decimals` | non-negative safe integer |
| `isRwa` | boolean |

Optional fields:

| Field | Runtime rule |
| --- | --- |
| `category` | non-empty string when present |
| `contractId` | non-empty string when present |

String values are trimmed. Unknown fields are ignored so metadata producers can
add fields without breaking older SDK consumers.

## Parsing

```typescript
import {
  parseRwaAssetMetadata,
  safeParseRwaAssetMetadata,
} from '@aegis/sdk';

const metadata = parseRwaAssetMetadata({
  symbol: 'AEGIS-RWA',
  name: 'Aegis Tokenized Real Estate',
  decimals: 7,
  isRwa: true,
  category: 'Real Estate',
});

const result = safeParseRwaAssetMetadata(untrustedInput);
if (!result.success) {
  for (const issue of result.error.issues) {
    console.warn(issue.field, issue.code, issue.message);
  }
}
```

`parseRwaAssetMetadata` throws `AssetMetadataValidationError` with all detected
field issues. `safeParseRwaAssetMetadata` returns a discriminated result instead
of throwing, and `isRwaAssetMetadata` exposes the same rules as a type guard.

## Boundary and compliance assumptions

This parser validates metadata structure only. It does **not** prove that a
contract exists, that an issuer is authorized, that metadata is current, that an
asset is whitelisted, or that any legal/compliance requirement has been met.
Callers should obtain those facts from protocol state and trusted data sources
rather than inferring them from metadata text.
