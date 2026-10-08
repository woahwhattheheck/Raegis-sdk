#  Raegis SDK

The official TypeScript SDK for the **Raegis RWA Protocol**. This library provides a clean, class-based interface to interact with Raegis Soroban smart contracts on the Stellar network.

##  Installation

```bash
npm install @aegis/sdk
```

## Quickstart

Prefer the narrowest client role that can do the job. Read-only compliance and
portfolio calls do **not** need a signing key.

### Read-only compliance query

```typescript
import { createReadOnlyClient } from '@aegis/sdk';

const reader = createReadOnlyClient({
  environment: 'testnet',
  contractId: 'C_YOUR_CONTRACT_ID',
});

const isApproved = await reader.compliance.checkWhitelist(
  'G_USER_PUBLIC_KEY',
);
console.log('Protocol whitelist result:', isApproved);
```

The read-only client exposes query modules without accepting a `Keypair`, which
keeps dashboard and support tooling from accidentally gaining signing
capability.

### Admin calls require signer capability

Create signer-backed clients only inside a trusted runtime. Pass signing
material into a narrow construction boundary after loading it from your
deployment environment or secret manager; do not hard-code it in source.

```typescript
import { createAdminClient } from '@aegis/sdk';
import { Keypair } from '@stellar/stellar-sdk';

function createTrustedAdminClient(signingSecret: string) {
  const signer = Keypair.fromSecret(signingSecret);

  return createAdminClient({
    environment: 'testnet',
    contractId: 'C_YOUR_CONTRACT_ID',
    keypair: signer,
  });
}

export async function mintFromTrustedRuntime(
  signingSecret: string,
  recipient: string,
  amount: number,
) {
  const admin = createTrustedAdminClient(signingSecret);
  admin.assertAdminAccess();
  return admin.asset.mint(recipient, amount);
}
```

`assertAdminAccess()` is an SDK capability guardrail, not a replacement for
on-chain authorisation. The deployed contract remains authoritative.

### Custom RPC configuration

Use a named environment preset when possible. If you need an explicit endpoint,
include the URL scheme and pair it with the matching Stellar network
passphrase:

```typescript
import { AegisClient } from '@aegis/sdk';
import { Networks } from '@stellar/stellar-sdk';

const customReader = new AegisClient({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
  contractId: 'C_YOUR_CONTRACT_ID',
});

const isApproved = await customReader.compliance.checkWhitelist(
  'G_USER_PUBLIC_KEY',
);
```

### Signing-key safety

- Never commit or hard-code signing secrets in source, examples, fixtures, logs,
  screenshots, or issue reports.
- Load signer material from the runtime's environment/secret manager immediately
  before creating a signer-backed client.
- Keep admin and issuer signers on trusted server-side or otherwise protected
  runtimes; do not expose raw signing material to browser bundles.
- Use `createReadOnlyClient` for dashboards, indexers, support tools, and any
  flow that does not submit state-changing transactions.
- Do not log a `Keypair`, its secret, or a signer-backed client while debugging.

See [Role-Aware Client Factory](./docs/role-aware-client-factory.md) for the
full capability matrix, `compliance-operator` usage, and security boundaries.

For direct `AegisClient` construction, use the signer-free custom example
above for reads and add `keypair` only when the specific operation requires
signing.

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

