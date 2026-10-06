# Admin action receipts

Admin action receipts turn a transaction outcome into a small, typed object that
an admin dashboard can render without retaining a raw RPC response.

Supported operations are:

- whitelist addition and removal;
- asset registration;
- protocol pause and unpause; and
- asset minting.

## Build a receipt

```ts
import { Networks } from "@stellar/stellar-sdk";
import { buildAdminActionReceipt } from "@aegis/sdk";

const receipt = buildAdminActionReceipt({
  operation: "asset-mint",
  target: {
    assetId: "RWA-2026-001",
    recipient: "G...",
    amount: "125.50",
  },
  status: "SUCCESS",
  transactionHash: "a".repeat(64),
  networkPassphrase: Networks.TESTNET,
});

console.log(receipt.status); // success
console.log(receipt.explorerUrl); // Stellar Expert testnet transaction URL
```

The builder accepts common Soroban RPC states and maps them conservatively:

| Input state                            | Receipt status |
| -------------------------------------- | -------------- |
| `SUCCESS`, `CONFIRMED`                 | `success`      |
| `PENDING`, `DUPLICATE`, `NOT_FOUND`    | `pending`      |
| `FAILED`, `ERROR`                      | `failed`       |
| `TRY_AGAIN_LATER`, unrecognised values | `unknown`      |

An unknown outcome is never presented as successful. A successful receipt must
include a 64-character transaction hash.

## Explorer links

Public Network, Testnet, and Futurenet hashes receive network-specific Stellar
Expert links. For a private network, pass an explicit HTTPS transaction explorer
base URL:

```ts
const receipt = buildAdminActionReceipt({
  operation: "protocol-pause",
  target: { contractId: "C..." },
  status: "FAILED",
  transactionHash: "b".repeat(64),
  networkPassphrase: "Private Aegis Network",
  explorerBaseUrl: "https://explorer.example/transactions",
  failureCode: "TX_BAD_AUTH",
});
```

If a custom network has no explorer base URL, `explorerUrl` is `null`.

## Data handling

The receipt contains only the operation, its typed target, normalized status,
transaction hash, explorer link, observation time, generated summary, and an
optional safe failure code. Raw RPC responses, signatures, secret keys,
envelopes, and arbitrary metadata are intentionally not copied.

For ambiguous outcomes and privileged retry decisions, follow [Admin operation
idempotency and retry guidance](./admin-operation-idempotency.md) before submitting
another transaction.

Receipts describe observed transaction state. They are not legal, financial, or
compliance guarantees.
