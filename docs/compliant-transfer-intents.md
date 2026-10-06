# Compliant transfer intents

Use the transfer-intent preflight before submitting an RWA transfer:

```ts
const intent = await client.asset.buildTransferIntent(recipient, amount);
const hash = await client.asset.submitTransferIntent(intent);
```

`client.asset.transfer(recipient, amount)` uses the same build-to-submit path.

The builder validates the recipient, amount, contract ID, and network before any
compliance query. It checks the configured signer first and the recipient
second. A rejected sender short-circuits the recipient check, and an unavailable
compliance query fails closed.

Before submission, the SDK rechecks that the current signer, contract ID, and
network passphrase still match the checked intent. If they changed, submission
stops with `INTENT_CONFIG_MISMATCH`.

Preflight failures use `CompliantTransferIntentError.code`:
`INVALID_RECIPIENT`, `INVALID_AMOUNT`, `INVALID_CONTRACT`,
`INVALID_NETWORK`, `SENDER_NOT_COMPLIANT`,
`RECIPIENT_NOT_COMPLIANT`, `COMPLIANCE_CHECK_FAILED`, and
`INTENT_CONFIG_MISMATCH`.

These checks describe SDK and protocol readiness. The contract remains
authoritative when the transaction is submitted.
