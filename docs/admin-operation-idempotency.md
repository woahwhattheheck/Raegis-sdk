# Admin operation idempotency and retry guidance

Privileged Aegis operations can finish successfully, fail definitively, or become ambiguous after submission. Only a definitive failure is an ordinary retry case. A timeout or lost response is not proof that an admin transaction failed.

> This is SDK/operator guidance. It does not add an on-chain idempotency guarantee and is not legal, financial, or compliance advice.

## Receipt states and retry policy

`buildAdminActionReceipt()` normalizes transaction outcomes conservatively:

| Receipt status | Operator meaning | Retry policy |
| --- | --- | --- |
| `success` | Final success observed. | Do not retry. |
| `pending` | Outcome is not final; `DUPLICATE` and `NOT_FOUND` also normalize here. | Reconcile first; do not retry. |
| `unknown` | Success or failure is not proven. | Reconcile first; do not retry. |
| `failed` | Failure was observed. | Retry only after a fresh state check confirms the action is still required. |

A known transaction hash should be retained and reconciled before another transaction is submitted.

## State-targeting operations

Whitelist addition/removal and protocol pause/unpause target a desired state. Before retrying:

1. Read current authoritative state.
2. Stop if the desired state already exists.
3. Reconcile any known prior transaction hash.
4. Submit again only when the desired state is absent and the prior attempt is known not to be pending or successful.

This convergence procedure is not a contract-level idempotency guarantee. Another administrator can change state between the read and the next submission.

## Value-creating operations

Minting must not be repeated merely because the client timed out. Asset registration can also be uniqueness-sensitive depending on contract rules.

- Reconcile a known transaction hash first.
- Without a hash, inspect authoritative contract/network state for evidence that the operation landed.
- If the outcome remains uncertain, require manual reconciliation rather than automatic resubmission.
- A client-generated correlation ID is useful for logs but is not an on-chain idempotency key unless the contract explicitly enforces it.

## Retry decision flow

```text
desired state already present -> stop
otherwise, known prior hash -> reconcile status
  success -> stop
  pending/unknown -> investigate; do not resubmit
  failed -> re-read authoritative state
desired state still absent -> revalidate signer, role, network, contract, and inputs
submit one new attempt
```

When no transaction hash exists, start with authoritative state reconciliation. For a value-creating action, unresolved ambiguity should stop automated retry.

## Revalidate privilege and configuration

A retry is a new privileged action. Before signing it:

- confirm the intended network and contract;
- revalidate the current signer and role/capability assumption;
- re-read mutable preconditions such as whitelist or pause state;
- rebuild from current state instead of reusing a stale signed transaction;
- show the operator the exact action and target before requesting a signature.

`assertAdminAccess()` and `assertWhitelistAccess()` are client-side capability guards; contract authorization remains authoritative.

## Concurrent administrators

A read-before-write check is not a lock. Dashboards should refresh authoritative state immediately before enabling a retry, surface the last observed transaction hash and receipt status, suppress automatic resubmission while an earlier attempt is pending or unknown, and refresh again after confirmation.

Prefer contract-native sequencing, nonce, or version controls when they exist. Do not present an SDK-only workflow as stronger than the contract semantics.

## Common failure cases

| Situation | Safe response |
| --- | --- |
| Signature rejected before submission | Review the request and allow an explicit new attempt. |
| RPC requests retry later | Re-check state and retry only when there is no evidence of an accepted transaction. |
| A transaction hash was returned and confirmation timed out | Preserve and reconcile the hash; do not submit a second transaction yet. |
| RPC reports `DUPLICATE` | Treat as pending/ambiguous and reconcile. |
| A known hash is temporarily `NOT_FOUND` | Treat as pending/ambiguous; indexing lag is not proof of failure. |
| Mint result is ambiguous with no hash | Inspect authoritative state; require manual reconciliation if uncertainty remains. |
| Whitelist add timed out but a fresh read shows approval | Stop; the desired state already exists. |

## Operator checklist

- [ ] Previous outcome is not already successful.
- [ ] No pending/unknown attempt remains unreconciled.
- [ ] Any known transaction hash has been checked.
- [ ] Current contract state still requires the action.
- [ ] Repeating a value-creating action is proven safe.
- [ ] Network, contract, signer, role, and target were revalidated.
- [ ] No stale signed transaction or cached authorization decision is reused.
- [ ] Diagnostic records contain only the minimum public reconciliation data.

See [Admin action receipts](./admin-action-receipts.md) for the typed receipt model used by this workflow.
