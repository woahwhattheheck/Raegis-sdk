# Investor transfer eligibility preflight

`InvestorModule.checkTransferEligibility(source, destination, amount)` is a
read-only preflight for SDK callers that need a typed answer before deciding
whether to construct a transfer.

It validates both Stellar account public keys and requires a positive safe
integer amount before any network I/O. It checks the source whitelist state
first and short-circuits unless the source is authoritatively approved. The
destination is queried only after source approval.

The result is one of:

- `eligible` — both whitelist observations are authoritatively approved.
- `ineligible` — invalid input or an authoritative not-whitelisted result.
- `unknown` — a query completed without an authoritative boolean result.
- `unavailable` — the whitelist query itself could not be completed.

Reason codes are side-specific so callers can distinguish source and
destination failures without parsing human-readable text.

This helper intentionally does not inspect balances, sign transactions, or
submit transactions. It reports only the input and whitelist state observable
through this SDK.

`ComplianceModule.observeWhitelist()` exposes the typed whitelist observation
used by this preflight. Existing `checkWhitelist()` behavior is preserved:
only an authoritative approval returns `true`; every other state returns
`false`.
