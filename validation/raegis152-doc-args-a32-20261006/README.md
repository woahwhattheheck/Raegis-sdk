# Raegis #152 documentation argument audit

This packet retains the unchanged frozen local proposal and independent documentation checks for existing Raegis SDK PR #172. Outside publisher source commit `a32ea132b95cfb2d68b76407ff06a7e6d47df6f6` has the exact proposed tree `ccac3f6b8f0bbf21f948d064c7bf2af54fcf5b68`: two documentation rows include the encoded signer public key, while all 99 other source blobs remain unchanged.

`proposal-receipt.json` is the original 50007eae receipt. `publication-binding.json` separately records the subsequent immutable source, PR/ref/tree/diff readbacks, attribution and CI observation. `owner/` records actual static check commands, stdout and Markdown link evidence. The captured verifier preserves its original harness path and exact bytes; it is not advertised as an SDK runtime test or a portable CI runner.

No SDK build, lint, format, unit test or full release gate was executed. Runtime compatibility run 37393998802 was completed/action_required with zero jobs, so no CI pass or product-failure is claimed. Documentation-only no-new-method justification is permitted; repository release/CI requirements before review or approval remain pending.

The evidence commit is separate from the product source branch. Existing PR #172 remains canonical, and the source repair is attributed to the outside publisher.
