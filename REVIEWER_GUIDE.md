# Reviewer guide

1. Open the dashboard and inspect the USGS source record and original Primus proof.
2. The original proof verifies at the project verifier, but its gate recipient and context intentionally fail escrow policy. The local settlement proof belongs to the deterministic local test deployment.
3. Use the Base Sepolia Blockscout links below to inspect the contracts and finalized receipts. The replay button re-executes read-only calls at the recorded pre-settlement block. A current-state retry is rejected because the escrow is terminal.
4. Reproduce the genuine local settlement and mutation tests with `pnpm compile` and `pnpm test`.

The on-chain verifier is operated by SeismicLock. See [security](SECURITY.md) for signer provenance and the incompatibility with the Primus-operated Base Sepolia deployment.

## Base Sepolia explorer links

- [Escrow contract on Blockscout](https://base-sepolia.blockscout.com/address/0xaceD02D1C2547cBcaB1d20E608C5eC65C58EBBd1)
- [Project verifier on Blockscout](https://base-sepolia.blockscout.com/address/0xebD80C84e4Ae5433D48a6C5b85aAa5a2cC2d8e30)
- [Deployment receipt on Blockscout](https://base-sepolia.blockscout.com/tx/0xd2f688edcf8e4bda1b128e4a14a5c6310325d4151835a653e6c7a78a92a97b76)
- [Funding receipt on Blockscout](https://base-sepolia.blockscout.com/tx/0x13016fe227215726c8f356982e165e210291f46ccad4911bfc860a8df2bfd174)
- [Settlement receipt on Blockscout](https://base-sepolia.blockscout.com/tx/0x4eb0184c5eb16a6c640d466a26b65712e393084ef6e5b619a945d089ebd3c66f)
