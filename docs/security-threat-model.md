# SDK security threat model

This document describes security boundaries and failure modes for the Raegis TypeScript SDK.
It is an engineering threat model for protocol-facing software, not legal, financial, KYC,
sanctions, or accreditation advice. Contract-side authorization remains authoritative.

## Scope

In scope:

- SDK configuration and RPC selection.
- In-memory signer/keypair handling.
- Read-only compliance and portfolio queries.
- Asset mint/transfer transaction construction and submission.
- Role-aware client factories and UI capability gating.
- Network error classification and support diagnostics.
- Admin-facing receipt data.
- Dashboard and service integrations consuming SDK results.

Out of scope:

- Custody infrastructure outside this process.
- Endpoint/operator security of third-party RPC providers.
- Smart-contract correctness beyond assumptions explicitly consumed by the SDK.
- Off-chain identity/KYC provider correctness.
- Host/device compromise.
- Production key-management systems not implemented by this repository.

## Assets and security goals

| Asset | Goal |
| --- | --- |
| Signing key material | Never expose or copy secrets into logs, diagnostics, receipts, or untrusted UI state. |
| Transaction intent | Preserve network, contract, signer, recipient, amount, and operation intent through signing/submission. |
| Compliance state | Treat protocol-visible status conservatively; never upgrade an unknown/unavailable read into approval. |
| Administrative capability | Prevent SDK role declarations from being mistaken for contract authorization. |
| Network configuration | Avoid silent cross-network or insecure-endpoint use. |
| Support diagnostics | Be useful without leaking RPC payloads, credentials, signatures, or arbitrary provider data. |
| User-facing state | Distinguish denied, unknown, unavailable, pending, and successful states where the underlying source supports it. |

## Trust boundaries

### Application to SDK

The application supplies configuration, addresses, amounts, and sometimes a
`Keypair`. Inputs crossing this boundary are not automatically trustworthy.
TypeScript types improve developer ergonomics but do not validate runtime JSON,
environment variables, persisted values, or dynamically loaded configuration.

### SDK to signer

`AegisClient` currently accepts an optional Stellar `Keypair` and retains it in
process memory. `requireSigner()` prevents write operations when no signer exists,
but the SDK does not provide a hardware-wallet, browser-wallet, remote-signer, or
secret-storage abstraction. Applications are responsible for how private keys enter,
remain in, and leave the process.

### SDK to Stellar RPC

RPC responses are remote, fallible input. The configured RPC endpoint can return
timeouts, rate limits, malformed data, stale data, or an unexpected network view.
`runNetworkOperation()` normalizes network failures; consumers still need to avoid
treating read failure as an authoritative negative or blindly retrying state-changing
operations.

### SDK role model to contract authorization

Role-aware factories narrow the TypeScript surface according to a caller-declared
role. These guards are useful least-privilege developer controls, but they do not prove
that the signer has the corresponding on-chain role. The contract remains the final
authorization boundary.

### SDK to dashboard/support surfaces

Dashboard state, error messages, analytics, and support artifacts are lower-trust
destinations than signer and raw RPC objects. Data copied into those surfaces must be
redacted and semantically conservative.

## Threats, current controls, and required handling

### T1: Secret exposure from signer material

**Threat:** A raw secret, `Keypair`, signature, or provider object is logged,
serialized, attached to a diagnostic, or stored in UI state.

**Current controls:**

- Read-only clients do not require a keypair.
- `requireSigner()` fails explicitly when a write path lacks a signer.
- Network diagnostics expose stable safe messages rather than raw provider messages.
- Admin receipt builders accept narrow typed inputs rather than arbitrary RPC objects.

**Required application behavior:**

- Never log or serialize `AegisClient.keypair`, secret seeds, signatures, or signed
  envelopes for routine diagnostics.
- Pass public keys or transaction hashes to UI/support layers instead of signer objects.
- Prefer an external signer/wallet integration when one is available rather than
  long-lived raw secret material in application state.

**Residual risk:** The current client stores a `Keypair` directly in memory and has no
dedicated external-signer abstraction.

### T2: Caller-declared role mistaken for authorization

**Threat:** An application constructs an `issuer` or `admin` client and assumes the
role declaration proves on-chain permission.

**Current controls:**

- Role-aware interfaces remove unsupported methods from the typed surface.
- `assertAdminAccess()` and `assertWhitelistAccess()` validate the SDK-declared
  capability set.
- Documentation states the contract is authoritative.

**Required handling:**

- Treat SDK role guards as least-privilege client controls only.
- Handle contract rejection even after a capability guard succeeds.
- Do not expose privileged UX solely because a caller chose an `admin` factory.

**Residual risk:** The current contract interface exposed to this SDK does not provide
a general role-discovery primitive for proving issuer/admin roles.

### T3: Compliance read failure treated as rejection or approval

**Threat:** A failed or malformed compliance query is collapsed into an eligibility
decision.

**Current behavior:** `ComplianceModule.checkWhitelist()` returns `false` when a
simulation is not successful or lacks a result. This preserves a fail-closed boolean,
but it cannot distinguish an observed negative whitelist value from an unavailable
read.

**Required handling:**

- For restricted actions, fail closed when the read is unavailable.
- Do not present a network failure as a definitive compliance rejection.
- Prefer richer typed readiness/status APIs when available so `blocked`,
  `unknown`, and `unavailable` remain distinct.
- Never infer off-chain legal/KYC completion from protocol whitelist state.

### T4: Wrong or unsafe network configuration

**Threat:** Transactions or reads are sent to the wrong network, an insecure endpoint,
or a mismatched passphrase.

**Current controls:**

- Environment presets centralize known RPC/passphrase pairs.
- Mainnet preset use requires explicit opt-in while marked unavailable.
- HTTP overrides are rejected for named non-local environments.
- Empty passphrases and malformed endpoint URLs are rejected.
- Network-failure classification has an explicit invalid-passphrase category.

**Residual risk:** Fully custom configuration intentionally permits plain HTTP. That is
appropriate for controlled local/test infrastructure only; production applications
should use authenticated HTTPS infrastructure and explicitly verify endpoint ownership.

### T5: Transaction replay, duplicate submission, or ambiguous outcome

**Threat:** A write is resubmitted after a timeout or unknown provider outcome and the
same intent executes twice, or an application assumes a hash implies finality.

**Current behavior:**

- Asset writes sign and submit a transaction once through `sendTransaction`.
- Network failure metadata distinguishes retryable transport conditions.
- Admin receipts model `pending`, `failed`, and `unknown` rather than equating
  every response with success.

**Required handling:**

- Do not automatically retry a state-changing submission merely because a transport
  error is marked retryable.
- Reconcile transaction status by hash/intent before constructing a replacement.
- Keep read retries separate from write retries.
- Treat transaction submission and transaction confirmation as distinct states.

**Residual risk:** `AssetModule` currently constructs transactions with a placeholder
source sequence and contains a TODO for pre-submission simulation. Production
integrations must not assume that path is a complete transaction lifecycle.

### T6: Malicious or malformed RPC data

**Threat:** Provider responses contain malformed XDR/data, surprising object shapes,
or attacker-controlled strings that reach business logic or user-visible diagnostics.

**Current controls:**

- Network failure normalization maps malformed-response patterns to a stable code.
- Safe diagnostic messages avoid copying arbitrary provider messages.
- Parsing is isolated behind SDK helpers.

**Required handling:**

- Validate runtime values before treating them as typed SDK state.
- Do not render raw RPC/provider objects directly in a dashboard.
- Treat decode failure as unavailable/unknown rather than success.

### T7: Diagnostic leakage

**Threat:** Error causes expose endpoint URLs, headers, payloads, credentials, or
provider internals.

**Current controls:**

- `classifyNetworkFailure()` returns fixed safe messages.
- The original cause on `NetworkFailure` is non-enumerable.
- `buildAdminActionReceipt()` copies a narrow allowlisted result rather than a raw
  transaction/provider object.

**Required handling:**

- Support telemetry should record stable error codes and safe metadata first.
- Raw `cause` objects should stay inside trusted debugging boundaries.
- Do not stringify arbitrary exceptions into public UI or persistent analytics.

### T8: Compliance/authorization bypass through UI gating

**Threat:** A dashboard hides/shows a button based on local role or whitelist state,
then skips the contract-enforced check because the UI already "approved" the action.

**Mitigation:** UI gating is advisory. Every state-changing operation must continue
through normal signing and contract authorization. Client-side capability checks are
not security boundaries.

### T9: Admin-key misuse

**Threat:** A high-privilege signer is reused for routine investor/read operations,
increasing blast radius or allowing a compromised integration to perform unintended
privileged actions.

**Mitigation:**

- Prefer the narrowest role-aware client for each process.
- Use read-only clients for dashboards/indexers.
- Separate admin/issuer processes and credentials from ordinary investor flows.
- Require explicit application-level review/approval around privileged operations.
- Record safe transaction receipts without secret material.

### T10: Cross-environment confusion

**Threat:** A contract ID, network passphrase, or RPC endpoint from one environment is
combined with another.

**Mitigation:**

- Prefer named environment presets.
- Treat custom endpoint/passphrase overrides as an explicit trust decision.
- Surface `INVALID_NETWORK_PASSPHRASE` distinctly from transient network failures.
- Include network identity in operator-visible confirmation/receipt UX where relevant.

## Retry policy

| Operation class | Retry guidance |
| --- | --- |
| Pure read/query | Safe to retry with bounded backoff when the error is transient. |
| Read used for authorization UX | Retry the read; remain fail-closed until a trustworthy result exists. |
| Transaction construction/signing | Rebuild only from fresh account/network state. |
| Transaction submission | Do not blindly retry; reconcile the prior transaction/intent first. |
| Status/receipt lookup | Safe to retry as a read, using transaction identity as the correlation key. |

A `retryable` transport classification does not mean a signed state-changing
transaction is safe to submit again.

## Security-sensitive integration checklist

Before shipping an SDK integration:

- [ ] Read-only processes use a read-only client and receive no private key.
- [ ] Signer secrets are never logged, serialized, placed in analytics, or copied into
      receipts/diagnostics.
- [ ] The configured contract ID, RPC endpoint, passphrase, and environment are reviewed
      together.
- [ ] Production RPC uses HTTPS and an explicitly trusted endpoint.
- [ ] Caller-declared SDK roles are not treated as on-chain role proof.
- [ ] Contract rejection is handled even after an SDK capability check passes.
- [ ] Compliance query failure remains distinct from observed approval/rejection where
      the consuming API can represent that distinction.
- [ ] State-changing RPC failures are reconciled before any resubmission.
- [ ] Dashboard/support output contains stable codes and safe summaries rather than raw
      provider objects.
- [ ] Admin/issuer signers are isolated from lower-privilege application paths.
- [ ] Transaction confirmation is distinguished from submission.
- [ ] Security assumptions introduced by new modules are added to this threat model or
      linked from it.

## Review triggers

Revisit this model when any of the following changes:

- signer/wallet abstraction or secret custody;
- contract role discovery or admin/issuer authorization;
- whitelist/compliance status model;
- transaction construction, simulation, retry, or submission flow;
- network/environment configuration;
- RPC provider or diagnostic data copied to UI/support surfaces;
- administrative operations or receipt schemas.

## Known gaps tracked by current source

These are boundaries to preserve during future work rather than claims that the SDK
already solves them:

1. Browser/external-wallet signing is not implemented; the client stores an optional
   in-memory `Keypair`.
2. Role-aware client roles are locally declared and do not prove contract roles.
3. Boolean `checkWhitelist()` cannot distinguish a negative result from every
   unsuccessful simulation path.
4. `AssetModule` still has a TODO for pre-submission simulation and uses a placeholder
   source sequence in its current transaction construction path.
5. Custom non-preset configuration can permit HTTP and therefore requires an explicit
   deployment trust decision.

These gaps should remain visible in reviews so later features do not accidentally turn
a developer convenience into an authorization or custody guarantee.
