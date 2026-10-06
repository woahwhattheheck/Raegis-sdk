# Compliance and legal boundaries

The Aegis SDK exposes protocol state and developer-facing helpers for RWA applications. Those signals are useful for deciding what an application may attempt or display, but they are **not legal, regulatory, financial, KYC, AML, accreditation, suitability, or investment advice**.

This guide defines the boundary between what the SDK and Aegis contract can establish, what a dashboard may safely infer, and what remains an off-chain legal or operational responsibility.

## Evidence and responsibility boundaries

| Surface | What it can establish | What it cannot establish |
| --- | --- | --- |
| Aegis Soroban contract | Whether a submitted operation satisfies the contract's current rules and state at execution time | Whether an action is lawful in a jurisdiction, whether a person has completed an off-chain compliance process, or whether an investment is suitable |
| `ComplianceModule.checkWhitelist(address)` | The contract's current `is_whitelisted` result when the RPC simulation succeeds | The reason an address is or is not whitelisted; identity verification status outside the protocol; legal clearance |
| `RoleModule` | A client-side classification derived from whitelist state plus local signer configuration | Contract-side admin/issuer authority, legal status, or a guaranteed transaction outcome |
| Role-aware client factories | The capability intent declared by the caller and the local signer surface exposed by the SDK | Proof that the signer has an on-chain role or that the contract will authorize the requested operation |
| Contract-event decoder | A typed interpretation of known protocol event topics, with an `unknown` fallback | Legal/compliance conclusions, transaction signature verification, or off-chain authorization |
| Admin action receipts | A conservative normalized view of an observed transaction state and optional explorer link | Legal approval, accounting finality, or proof that an off-chain compliance process was completed |
| Dashboard/UI | Presentation, warnings, and gating based on the evidence above | Authority to convert protocol signals into legal conclusions or silently reinterpret unknown states as approved |
| Off-chain compliance process | Organization-specific identity, jurisdiction, policy, legal, and operational decisions | This responsibility is outside the SDK and contract and must be defined by the organization operating the application |

The contract is the final authority for **protocol execution**. It is not the final authority for law, regulation, identity verification, or investment suitability.

## Interpreting common states

Applications should preserve the distinction between positive, negative, and indeterminate evidence.

| Observed state | Safe interpretation | Do not present it as |
| --- | --- | --- |
| Whitelist query returns `true` | "Protocol whitelist active" or "Address is whitelisted by the contract" | "KYC legally complete", "regulator approved", or "safe to invest" |
| Whitelist query returns `false` | "Protocol whitelist inactive" | A reason for rejection, a sanctions result, or a legal determination |
| Role discovery returns `investor` | The address is currently whitelisted under the SDK's client-side model | A contract-side admin/issuer role or verified investor eligibility under law |
| Role discovery returns `unauthorized` | The address is not currently whitelisted | A statement about identity, fraud, sanctions, or legal disqualification |
| Role discovery returns `unknown` | The SDK cannot determine the state from current evidence | Approved, denied, or "probably approved" |
| A local signer is present | The SDK has signing material for the address | Proof of an on-chain role or permission |
| A role-aware client is created as `admin`, `issuer`, or `compliance-operator` | The caller selected that local capability surface | Proof that the contract recognizes the signer in that role |
| Receipt status is `success` | The SDK observed a successful transaction state with the required hash | Legal compliance, accounting settlement, or off-chain approval |
| Receipt status is `pending` or `unknown` | Outcome is not yet established | Success |
| Event decoder returns `unknown` | The topic or payload is unsupported, incomplete, or malformed | A known compliance or business event |

Unknown and unavailable states are first-class states. They must not be coerced to success, approval, or authorization.

## Contract, SDK, and dashboard boundary

### Contract

The contract determines whether a protocol operation is accepted under its current state and authorization rules. A dashboard should treat contract rejection as authoritative for that attempted protocol operation.

A successful contract call still does not answer off-chain questions such as:

- whether the operator completed a required identity or sanctions process;
- whether a jurisdiction permits a transfer or offering;
- whether the asset's legal documentation is current;
- whether the user is eligible or suitable for an investment; or
- whether an organization has completed its own approval workflow.

### SDK

The SDK provides typed access to contract/RPC evidence and local capability guards.

In particular:

- `ComplianceModule.checkWhitelist()` reports protocol whitelist state.
- `RoleModule` is a developer-experience and dashboard-gating helper. Its capability results are deliberately not contract-verified; callers must still handle contract rejection.
- Role-aware factories prevent accidental use of operations outside the caller's declared SDK role, but the declared role is not proof of an on-chain role.
- Event decoding must retain the `unknown` fallback for unsupported or malformed events.
- Receipt normalization is conservative: unrecognized or indeterminate outcomes remain `unknown`.

Do not add helper names, comments, examples, or error messages that imply legal certification from these surfaces.

### Dashboard

A dashboard may use SDK evidence to decide which controls to show, what warnings to display, and when to request review. It should:

1. label protocol state explicitly, for example **Protocol whitelist active** rather than **KYC approved**;
2. distinguish local signer/capability state from contract authorization;
3. preserve `unknown`, `pending`, and unavailable states instead of converting them to a binary approved/denied result;
4. handle contract rejection even when a prior client-side capability check was positive;
5. show the evidence timestamp or refresh state when stale data could change the user's decision; and
6. route legal or policy determinations to the organization's off-chain process.

## Failure and edge cases

### RPC or network failure

A failed whitelist query, unavailable RPC endpoint, or incomplete network response is an evidence failure. The application should show an unavailable/unknown state and allow an appropriate retry. It must not assume the last positive state still applies unless the product has an explicit, documented freshness policy.

### Stale indexer or event data

Events are useful for audit views, but indexed data may lag contract state. Use direct contract/RPC reads when current authorization matters. An event is not a substitute for the current state required by an operation.

### Unknown event topics

New contract topics or malformed payloads intentionally fall back to `kind: 'unknown'` in the decoder's non-strict mode. UI code must preserve that result, not drop the row or relabel it as a known compliance event.

### Signer and role mismatch

A configured local signer only shows that the client can sign with that key. A caller-selected role only controls the SDK surface. Neither establishes that the contract recognizes the signer as an admin, issuer, or compliance operator.

### Transaction ambiguity

A `pending`, `NOT_FOUND`, `TRY_AGAIN_LATER`, or unrecognized result must remain pending/unknown under the receipt model. Do not trigger an off-chain "approved" state merely because a transaction was submitted.

### Sensitive information

Never place secret keys, seeds, raw signing material, credentials embedded in RPC URLs, or unnecessary identity data in diagnostics, receipts, events, screenshots, logs, support bundles, or issue reports. Prefer the repository's redacted diagnostics and typed receipt/event surfaces.

## Dashboard wording examples

Prefer wording that names the evidence:

- "Protocol whitelist active"
- "Protocol whitelist inactive"
- "Compliance status unavailable"
- "Signer configured locally"
- "Transaction confirmed"
- "Transaction pending"
- "Unsupported contract event"

Avoid wording that expands the evidence into a legal conclusion:

- "Legally KYC approved"
- "Regulator approved"
- "Compliant in all jurisdictions"
- "Authorized investor"
- "Guaranteed permitted"
- "Legally settled"

## Contributor and reviewer checklist

For changes that touch compliance, roles, events, receipts, admin flows, or dashboard guidance:

- [ ] Protocol state is described as protocol state, not legal or regulatory status.
- [ ] Client-side role/capability predictions are not described as on-chain authorization.
- [ ] Local signer presence is not treated as proof of an admin/issuer/compliance role.
- [ ] `unknown`, unavailable, pending, malformed, and unsupported states remain explicit.
- [ ] Contract rejection is handled even after a positive client-side prediction.
- [ ] Event and receipt documentation does not overstate transaction or legal finality.
- [ ] Examples and logs contain no real secrets or unnecessary identity data.
- [ ] Dashboard labels identify the evidence source when ambiguity matters.
- [ ] Any off-chain legal or policy requirement is routed to the operator's own process rather than implemented as an SDK assumption.
- [ ] New public behavior is covered by the normal repository tests; documentation-only changes do not invent runtime test claims.

## Related documentation

- [Role Discovery & Capability Checks](./role-discovery.md)
- [Contract Event Decoder](./contract-events.md)
- [Admin action receipts](./admin-action-receipts.md)
- [Pull Request Reviewer Checklist](./reviewer-checklist.md)

This guide changes documentation only. It does not add authorization, compliance, transaction, event, or signer behavior to the SDK.
