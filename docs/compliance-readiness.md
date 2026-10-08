# Compliance readiness — investor and admin operations

This SDK's compliance readiness API reports **observable protocol state**, not legal KYC clearance. It is an additive typed alternative to the older `checkWhitelist(address): Promise<boolean>` call.

```ts
import { AegisClient } from '@aegis/sdk';

const client = new AegisClient(config);
const result = await client.compliance.checkReadiness(investorAddress);

if (result.canAttempt) {
  // You may now TRY a restricted investor action, subject to a fresh
  // contract-side authorization and transaction simulation at execution time.
} else {
  showComplianceStatus(result.status, result.code);
}
```

## State model

| `status` | When it is returned | `canAttempt` |
| --- | --- | --- |
| `approved` | A successful contract simulation returned whitelist boolean `true`, for an investor transfer | `true` |
| `blocked` | Whitelist was `false` and an **independent, caller-supplied** status lookup explicitly returned `blocked` | `false` |
| `revoked` | Whitelist `false` plus external `revoked` evidence | `false` |
| `pending` | Whitelist `false` plus external `pending` evidence | `false` |
| `unknown` | Whitelist `false` without a status explanation, invalid address, failed external evidence, or admin rights not queryable | `false` |
| `unavailable` | Soroban simulation was missing/failed/non-boolean or network read threw | `false` |

The contract currently exposes **only** `is_whitelisted`. A `false` value does not distinguish blocked, revoked, pending, not-yet-reviewed or otherwise missing approval. The SDK never invents those distinctions and never treats an RPC failure as a confirmed denied status. It sets `onChainWhitelisted: null` for unavailable reads. The legacy boolean method retains its compatibility behavior: invalid/failed simulations return false; network exceptions still throw.

## Optional independent status explanations

When a compliant, authenticated backend can provide a **separately verified** reason for a non-whitelisted address, supply an evidence lookup:

```ts
const result = await client.compliance.checkReadiness(investorAddress, {
  operation: 'investor_transfer',
  evidenceLookup: async (address) => {
    const entry = await trustedComplianceBackend.lookup(address);
    // Your backend must authenticate the provider and authorization to query.
    return entry.status; // blocked | revoked | pending | unknown
  },
});
```

External classifications are always marked `evidenceSource: 'external_evidence'` and `canAttempt: false`. A wrong/unknown provider value returns `unknown`; lookup failures are `EVIDENCE_LOOKUP_FAILED` without copying provider errors into user-facing data. Do not supply user-editable UI state as trusted evidence. The SDK does not authenticate compliance services or prove regulatory identity.

## Admin/issuer permissions

```ts
const admin = await client.compliance.checkReadiness(address, {
  operation: 'admin_action',
});
```

Even a true whitelist result yields `status: 'unknown'`, `code: 'ADMIN_AUTHORITY_NOT_QUERYABLE'`, `canAttempt: false`, because the current Soroban contract exposes no role-query API. The SDK cannot infer admin rights from a local signer or investor whitelist. See [Role Discovery](role-discovery.md). For admin actions, always verify capabilities at the actual contract authorization boundary.

## Dashboard integration

The six statuses can drive a visible banner or badge, but **not** access control by themselves:

- `approved`: “Protocol whitelist active — transaction still requires authorization”
- `blocked`: “Blocked according to your compliance provider”
- `revoked`: “Previously approved status revoked by your provider”
- `pending`: “Compliance review pending”
- `unknown`: “Eligibility cannot be determined”
- `unavailable`: “Cannot reach the protocol; try again”

Display the typed `code` for customer support, never raw network/provider messages. Include `checkedAt` to show staleness; re-evaluate before every material action. `canAttempt` is a *dashboard hint*, not authority, legal clearance, personal identity verification or a promise that a transaction will succeed.

## Reason codes

- `WHITELIST_APPROVED`, `WHITELIST_NOT_APPROVED`: definite contract boolean result
- `EVIDENCE_BLOCKED`, `EVIDENCE_REVOKED`, `EVIDENCE_PENDING`, `EVIDENCE_UNKNOWN`: independent provider's explanation
- `EVIDENCE_LOOKUP_FAILED`: on-chain boolean false, optional external lookup failed
- `INVALID_ADDRESS`: rejected before network access
- `SIMULATION_UNAVAILABLE`: failed, missing or invalid Soroban simulation result
- `RPC_UNAVAILABLE`: exception during network lookup (redacted, no provider details)
- `ADMIN_AUTHORITY_NOT_QUERYABLE`: no contract API to prove admin/issuer role

## Testing scope

`tests/compliance-readiness.test.ts` contains focused, offline mocked-Soroban cases for the approved path, unknown false whitelist, all optional evidence statuses, misleading/throwing provider inputs, bad addresses, unavailable simulation, RPC failure and the admin-authority limitation. No live KYC provider, blockchain submission, device or wallet balance data is required.
