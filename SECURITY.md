# Security and limitations

## Verifier trust

Primus operates the attestor that signs USGS evidence. SeismicLock operates the on-chain verifier deployment, compiled from verbatim upstream MIT-licensed source. The Primus-operated Base Sepolia verifier rejected the authentic proof with `Invalid signature`. Its signer mapping returned zero for the recovered and source-confirmed Core SDK production attestor.

The project deployment has no proxy or signer-management owner. Rotation or revocation requires a fresh verifier, a new escrow and new proofs. An already funded escrow can use its expiry refund. Disclosure of a signer key would invalidate trust in its proofs. The exercise is limited to Base Sepolia.

## Settlement controls

The escrow checks exact request components, proof conditions and each response rule before verification. Exact canonical grammar and full consumption of the bounded data field prevent ambiguous data/conditions boundaries in the upstream packed encoding. Numeric conversion is bounded, rejects alternate forms, and retains six decimal places. The attestation timestamp is milliseconds, with a 30-minute age limit, 30-second skew allowance and funding-time floor.

Funds only leave for immutable beneficiaries or the original funder. Both payout paths commit terminal state before the external call and revert atomically on transfer failure. Replay is rejected by the escrow state and contract-specific signed scope. USGS revisions describe snapshots; the proof cannot establish the absence of a newer revision.
