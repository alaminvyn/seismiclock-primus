# Reviewer guide

1. Open the dashboard and inspect the USGS source record and original Primus proof.
2. The original proof verifies at the project verifier, but its gate recipient and context intentionally fail escrow policy. The local settlement proof belongs to the deterministic local test deployment.
3. Use the Base Sepolia explorer links for mined transactions. The replay button re-executes read-only calls at the recorded pre-settlement block. A current-state retry is rejected because the escrow is terminal.
4. Reproduce the genuine local settlement and mutation tests with `pnpm compile` and `pnpm test`.

The on-chain verifier is operated by SeismicLock. See [security](SECURITY.md) for signer provenance and the incompatibility with the Primus-operated Base Sepolia deployment.
