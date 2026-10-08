# Compliance status transitions

`mapComplianceStatusTransition(previous, current)` gives SDK consumers a typed,
deterministic description of a protocol compliance-state change.

It is descriptive, not authoritative. The mapper does not grant on-chain
permissions and does not make legal/KYC, accreditation, sanctions, or financial
determinations. The contract remains the authority for a real state-changing
operation.

## Status vocabulary

The transition mapper uses six protocol-facing states:

- `approved`
- `blocked`
- `revoked`
- `pending`
- `unknown`
- `unavailable`

Only destination `approved` produces `action: 'allow'`. `blocked`,
`revoked`, and `pending` produce `deny`. `unknown` and `unavailable`
produce `refresh`, so missing information is never converted into approval.

## Example

```ts
import { mapComplianceStatusTransition } from '@aegis/sdk';

const transition = mapComplianceStatusTransition('pending', 'approved');

transition.code;               // 'ELIGIBILITY_GRANTED'
transition.action;             // 'allow'
transition.changed;            // true
transition.eligibilityChanged; // true
```

The result includes previous/current state, eligibility before and after, whether
eligibility changed, a stable transition code, conservative UI guidance, a refresh
flag, and a human-readable reason.

## Stable transition codes

| Code | Meaning |
| --- | --- |
| `NO_CHANGE` | The observed state is unchanged. |
| `ELIGIBILITY_GRANTED` | The destination became `approved`. |
| `ELIGIBILITY_LOST` | A previously `approved` state moved to a non-approved state. |
| `REVIEW_PENDING` | The destination is `pending`. |
| `RESTRICTION_CHANGED` | `blocked` and `revoked` changed between each other. |
| `STATUS_UNAVAILABLE` | A readable state became unavailable. |
| `STATUS_RECOVERED` | A previously unavailable state became readable again. |
| `STATUS_UNKNOWN` | The destination cannot establish protocol status. |
| `STATUS_RESOLVED` | A previously unknown state resolved to a known state. |
| `STATUS_CHANGED` | A remaining non-eligibility state change. |

## Runtime values

TypeScript callers get the `ComplianceStatus` union at compile time. Data arriving
from JSON, indexers, storage, or future adapters should first use
`isComplianceStatus(value)`. Unknown strings are rejected rather than silently
treated as a known compliance state.

## Dashboard guidance

- `allow`: observed protocol state is `approved`; the contract still authorizes
  the real operation.
- `deny`: show the state-specific reason and keep restricted UX disabled.
- `refresh`: status is incomplete or unavailable; retry the read rather than guessing.

## Acceptance criteria traceability

| Issue #26 criterion | Implementation |
| --- | --- |
| Transition mapping implemented/specified | `src/compliance-transition.ts` exposes a deterministic typed mapper and runtime guard. |
| Edge cases and failure states | No-change, eligibility gain/loss, restriction changes, pending, unknown, unavailable, recovery, and resolution are explicit. |
| Security/compliance assumptions documented | This document and source comments preserve protocol-only semantics and contract authority. |
| Tests/fixtures/checklists | `tests/compliance-transition.test.ts` covers the major transition classes and invalid runtime values. |
| README/docs navigation | README links to this document and the package root exports the API/types. |
| Ecosystem compatibility | The six status names match current Raegis compliance/readiness vocabulary without requiring an RPC or contract change. |
