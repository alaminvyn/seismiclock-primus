# SeismicLock

Proof-powered emergency settlement on Base Sepolia. The historical exercise follows USGS event `us6000jllz` through a genuine Primus Core SDK attestation, a project-operated Primus verifier, and a one-shot Solidity escrow.

**Status:** Local verification and Base Sepolia settlement demonstrated. See the deployment evidence for the successful receipts and current finality status. This is a historical testnet exercise.

```sh
pnpm install --ignore-scripts
pnpm compile
pnpm test
pnpm typecheck
pnpm build
pnpm dev
```

Use a standalone Node.js runtime for the local Ganache tests. The packaged desktop Node runtime can reject Ganache's native dependency.

- [Escrow contract on Blockscout](https://base-sepolia.blockscout.com/address/0xaceD02D1C2547cBcaB1d20E608C5eC65C58EBBd1)
- [Project verifier on Blockscout](https://base-sepolia.blockscout.com/address/0xebD80C84e4Ae5433D48a6C5b85aAa5a2cC2d8e30)
- [Deployment receipt on Blockscout](https://base-sepolia.blockscout.com/tx/0xd2f688edcf8e4bda1b128e4a14a5c6310325d4151835a653e6c7a78a92a97b76)
- [Funding receipt on Blockscout](https://base-sepolia.blockscout.com/tx/0x13016fe227215726c8f356982e165e210291f46ccad4911bfc860a8df2bfd174)
- [Settlement receipt on Blockscout](https://base-sepolia.blockscout.com/tx/0x4eb0184c5eb16a6c640d466a26b65712e393084ef6e5b619a945d089ebd3c66f)
- [Reviewer guide](REVIEWER_GUIDE.md)
- [Architecture](ARCHITECTURE.md)
- [Security and verifier trust model](SECURITY.md)
- [Test report](TEST_REPORT.md)
- [Deployment](DEPLOYMENT.md)
- [Submission](SUBMISSION.md)
