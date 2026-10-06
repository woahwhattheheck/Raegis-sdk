# Testing Utilities

The Aegis SDK ships a **local mock client** for unit tests, Storybook fixtures, and dashboard examples. The mock client returns predictable responses without connecting to Soroban RPC.

## Import path and public export decision

Mock utilities are published on a **dedicated subpath**, not the main package entry:

```typescript
import { createMockAegisClient, createMockFixtures } from '@aegis/sdk/testing';
```

They are **intentionally excluded** from `@aegis/sdk` so production bundles do not pull in test helpers by default. The subpath is part of the public API for integrators building dashboards and test suites, but it is documented as **test-only** and must not be used in production runtime code.

| Export | Purpose |
|--------|---------|
| `@aegis/sdk` | Production client (`AegisClient`) |
| `@aegis/sdk/testing` | Local mock client and fixtures |

## Quickstart

```typescript
import { createMockAegisClient, createMockFixtures } from '@aegis/sdk/testing';

const fixtures = createMockFixtures();
const client = createMockAegisClient({ keypair: fixtures.signer });

// Configure predictable state
client.setWhitelisted(fixtures.investorAddress, true);
client.setBalance(fixtures.investorAddress, '5000000000'); // raw integer (7 decimals → 500.00)

// Compliance
const isApproved = await client.compliance.checkWhitelist(fixtures.investorAddress);

// Investor portfolio read model
const portfolio = await client.investor.getPortfolio(fixtures.investorAddress);

// Asset writes return mock transaction receipts (no live RPC)
const txHash = await client.asset.mint(fixtures.investorAddress, 1000);
console.log(client.transactions[0]); // { hash, type, from, to, amount, timestamp }
```

## API overview

### `createMockAegisClient(config?)`

Creates an in-memory `MockAegisClient` with the same module surface as `AegisClient`:

* `client.compliance.checkWhitelist(address)` → `Promise<boolean>`
* `client.asset.mint(to, amount)` → `Promise<string>` (mock tx hash)
* `client.asset.transfer(to, amount)` → `Promise<string>` (mock tx hash)
* `client.investor.getPortfolio(address, options?)` → `Promise<InvestorPortfolio>`

### State helpers

| Method | Description |
|--------|-------------|
| `setWhitelisted(address, boolean)` | KYC / whitelist status |
| `setBalance(address, balance, contractId?)` | Raw integer balance string |
| `setAssetMetadata(contractId, metadata)` | Override asset metadata |
| `reset()` | Clear all in-memory state and receipts |

### Fixtures

| Export | Description |
|--------|-------------|
| `createMockFixtures()` | Ephemeral keypairs and addresses (no hardcoded real credentials) |\n| `createDeterministicComplianceFixtures()` | Stable synthetic compliance/account/asset scenarios for repeatable tests |\n| `buildMockBooleanSimulationResult(value)` | Minimal successful whitelist-simulation response |\n| `buildMockI128SimulationResult(value)` | Minimal successful positive-i128 balance response |
| `MOCK_CONTRACT_ID` | Placeholder contract ID |
| `MOCK_SECONDARY_CONTRACT_ID` | Second asset for multi-holding tests |
| `DEFAULT_MOCK_ASSET_METADATA` | Default RWA metadata |
| `buildMockTxHash(seq, type)` | Deterministic fake tx hash builder |

### Deterministic compliance fixture framework\n\nUse `createDeterministicComplianceFixtures()` from `src/testing/fixtures` when a test needs the same public accounts and protocol scenarios on every run. The fixture set includes admin and investor public addresses, primary/secondary RWA metadata, and contract-response shapes for `approved`, `rejected`, `pending`, `unknown`, `unauthorised`, and `invalid` states.\n\nThese are test scenarios, not a new production compliance-state API. Successful fixtures include reusable simulation results; unresolved/error fixtures let tests exercise boundaries without inventing one-off payloads.\n\nDeterministic account records expose public addresses only. They are derived from fixed synthetic test inputs so addresses are stable, but the fixture set returns and serializes no credential strings. Do not fund or reuse these addresses outside tests.\n\nThe same module exports `buildMockBooleanSimulationResult()` and `buildMockI128SimulationResult()` so RPC-wiring tests can share compact XDR inputs instead of duplicating hand-built values.\n### Simulating failures

Pass `simulateComplianceFailure: true` to `createMockAegisClient` to make compliance checks throw, which drives `getPortfolio` to return `status: 'unavailable'`.

## Fake data policy

* `createMockFixtures()` generates ephemeral keypairs at runtime via `Keypair.random()`; those credentials are temporary and must never be used on a real network.\n* Deterministic compliance fixtures return stable public account records only and serialize no credential strings.
* Contract IDs and transaction hashes use clearly fake prefixes (`CAAAA...`, `mock_tx_...`).
* Mock transaction receipts are stored in `client.transactions` for assertions.

## When to use mock vs. RPC mocks

| Scenario | Recommended approach |
|----------|---------------------|
| Dashboard / UI snapshot tests | `@aegis/sdk/testing` mock client |
| Deterministic compliance/account scenarios | `createDeterministicComplianceFixtures()` |\n| Testing production module RPC wiring | Jest mocks on `@stellar/stellar-sdk` (see `tests/investor.test.ts`) |
| End-to-end against testnet | Real `AegisClient` |

## Running tests

```bash
npm run test
```

Mock client coverage lives in `tests/mock-client.test.ts` and `tests/mock-client-examples.test.ts`. Deterministic fixture coverage lives in `tests/compliance-fixtures.test.ts`; `tests/investor.test.ts` consumes the same fixture module for production RPC-wiring tests.
