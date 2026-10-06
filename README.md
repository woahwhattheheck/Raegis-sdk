#  Raegis SDK

The official TypeScript SDK for the **Raegis RWA Protocol**. This library provides a clean, class-based interface to interact with Raegis Soroban smart contracts on the Stellar network.

##  Installation

```bash
npm install @aegis/sdk
```

## Quickstart

Prefer the role-aware factory and a named environment preset. The `testnet` preset
uses the SDK's known-good `https://soroban-testnet.stellar.org` RPC endpoint and
Stellar testnet passphrase. If you override `rpcUrl`, pass a complete URL including
the `https://` scheme; plain `http://` is accepted only by the `local` preset.

### Read-only usage

Read-only clients do **not** need a secret key. This is the recommended shape for
dashboards, indexers, and other callers that only query protocol state.

```typescript
import { createReadOnlyClient } from '@aegis/sdk';

const reader = createReadOnlyClient({
  environment: 'testnet',
  contractId: 'C_YOUR_CONTRACT_ID',
});

const isApproved = await reader.compliance.checkWhitelist('G_USER_PUBLIC_KEY');
const portfolio = await reader.investor.getPortfolio('G_USER_PUBLIC_KEY');
```

For a private RPC while retaining the testnet network passphrase, use a full HTTPS
override:

```typescript
const reader = createReadOnlyClient({
  environment: 'testnet',
  rpcUrl: 'https://my-private-soroban-rpc.example.com',
  contractId: 'C_YOUR_CONTRACT_ID',
});
```

### Signed/admin usage

Write-capable role clients require signer capability. Keep Stellar seed material out
of source control and application bundles. The environment-variable example below is
for a trusted Node.js/server/CLI process; do not expose a server seed to browser code.

```typescript
import { createAdminClient } from '@aegis/sdk';
import { Keypair } from '@stellar/stellar-sdk';

const adminSecret = process.env.AEGIS_ADMIN_SECRET;
if (!adminSecret) {
  throw new Error('AEGIS_ADMIN_SECRET is required for this admin operation');
}

const admin = createAdminClient({
  environment: 'testnet',
  contractId: 'C_YOUR_CONTRACT_ID',
  keypair: Keypair.fromSecret(adminSecret),
});

admin.assertAdminAccess();
await admin.asset.mint('G_INVESTOR_PUBLIC_KEY', 10_000);
```

`createInvestorClient`, `createComplianceOperatorClient`, and `createIssuerClient`
follow the same signer boundary for write operations. Never hard-code an `S...` seed
in documentation, tests that may be copied into production, committed configuration,
or frontend code. Browser applications should keep signing in an appropriate wallet
integration instead of embedding privileged seed material.

See [Role-Aware Client Factory](./docs/role-aware-client-factory.md) for the full
capability matrix and [Environment Presets](./docs/environments.md) for RPC/network
configuration and mainnet gating.

For direct `AegisClient` construction (advanced/custom read-only setups), omit the
`keypair` entirely:

```typescript
import { AegisClient } from '@aegis/sdk';

const aegis = new AegisClient({
  environment: 'testnet',
  contractId: 'C_YOUR_CONTRACT_ID',
});
```
## Role Discovery & Capability Checks
Check what an address is classified as, and what it can currently attempt through the SDK.
This is a client-side convenience for UI gating, not on-chain authorization — see the
[full documentation](./docs/role-discovery.md) for important caveats.
```typescript
const roleResult = await aegis.role.discoverRole('G_USER_PUBLIC_KEY');
console.log('Role:', roleResult.role); // 'investor' | 'unauthorized' | 'unknown'

const capability = await aegis.role.checkCapability('G_USER_PUBLIC_KEY', 'receive_transfer');
console.log('Can receive transfer?', capability.isPermitted);
```

## Contract Event Decoder
Decode Soroban contract events into typed audit-trail models for dashboards and indexers.

```typescript
import { decodeContractEvent } from '@aegis/sdk';

const event = decodeContractEvent({
  topic: rpcEvent.topic,
  value: rpcEvent.value,
  txHash: rpcEvent.txHash,
});

if (event.kind === 'transfer') {
  console.log(event.from, event.to, event.amount);
}
```

See [Contract Event Decoder](./docs/contract-events.md) for supported topics, unknown fallback behaviour, and dashboard integration guidance.

## Testing
To run the SDK unit tests locally:

```
npm run test
```

Run the full release gate, including TypeScript compilation and browser/Node
runtime compatibility checks:

```bash
npm run check
```

### Pre-submit verification

Run all checks (lint, format, build, test, compat) in a single command before
submitting a PR:

```bash
npm run verify
```

See [Test-First Contribution Guide](docs/test-first-contribution.md) for when behavior changes need happy-path, negative-path, and no-test justification coverage.

See [Verification Command](docs/verification.md) for detailed usage and
troubleshooting guidance.

See [Runtime Compatibility](docs/runtime-compatibility.md) for the supported
environments, what the automated probes cover, and integration guidance.

For step-by-step instructions on reproducing and fixing CI check failures, see the [CI Resolution Workflow](docs/ci-resolution-workflow.md).

## Contributing
We welcome contributions! Please check our [CONTRIBUTING.md](CONTRIBUTING.md) for our branching strategy and code style guidelines.

Before submitting a PR, follow our [Test-First Contribution Guide](docs/test-first-contribution-guide.md) to understand when tests are required, what type of tests are expected per module, and how to prove your change works correctly.

Please also review our [Low-Effort PR Examples](docs/low-effort-pr-examples.md) to understand the quality standards for accepted contributions and to see examples of what to avoid (e.g., superficial changes, partial implementations, and untested code).

### Review Process
PRs submitted to this repository are reviewed against our [Pull Request Reviewer Checklist](docs/reviewer-checklist.md), which covers code implementation, unit test coverage, CI build compatibility, API reference documentation, security/compliance, and acceptance criteria.

### Acceptance Criteria Traceability
Every PR **must** include an [acceptance criteria traceability table](docs/acceptance-criteria-traceability.md) that maps SDK modules, tests, docs, and behaviour verification to each acceptance criterion from the linked issue. This makes evaluation straightforward for maintainers and GrantFox reviewers.

