# SeismicLock

**Proof-powered emergency settlement.** SeismicLock demonstrates conditional release of test funds against a reviewed earthquake record. A deterministic historical USGS catalog query is authenticated by Primus Proxy TLS, then the disclosure and signed policy scope are checked in Solidity.

## Primus integration

The project integrates the Enterprise Core SDK, explicit JSONPath extraction, signed beneficiary and escrow context, and Primus's open-source Solidity verifier. The project-operated deployment pins Primus's independently verified production signer and freezes management authority atomically. The Primus-operated Base Sepolia verifier rejected this signer. [Trust model](SECURITY.md)

## Evidence and reproduction

- [USGS historical earthquake](https://earthquake.usgs.gov/earthquakes/eventpage/us6000jllz)
- [Original authentic attestation](public/evidence/usgs-proof.json)
- [Contract-bound local test attestation](public/evidence/local-settlement-proof.json)
- [Reviewer guide](REVIEWER_GUIDE.md) and [executed tests](TEST_REPORT.md)

## Base Sepolia evidence

| Item | Evidence |
|---|---|
| Project-operated verifier | [Blockscout](https://base-sepolia.blockscout.com/address/0xebD80C84e4Ae5433D48a6C5b85aAa5a2cC2d8e30) · [Sourcify exact match](https://sourcify.dev/server/v2/contract/84532/0xebD80C84e4Ae5433D48a6C5b85aAa5a2cC2d8e30) |
| Escrow | [Blockscout](https://base-sepolia.blockscout.com/address/0xaceD02D1C2547cBcaB1d20E608C5eC65C58EBBd1) · [Sourcify exact match](https://sourcify.dev/server/v2/contract/84532/0xaceD02D1C2547cBcaB1d20E608C5eC65C58EBBd1) |
| Deployment | [Blockscout receipt](https://base-sepolia.blockscout.com/tx/0xd2f688edcf8e4bda1b128e4a14a5c6310325d4151835a653e6c7a78a92a97b76) |
| Funding | [Blockscout receipt](https://base-sepolia.blockscout.com/tx/0x13016fe227215726c8f356982e165e210291f46ccad4911bfc860a8df2bfd174) |
| Settlement | [Blockscout receipt](https://base-sepolia.blockscout.com/tx/0x4eb0184c5eb16a6c640d466a26b65712e393084ef6e5b619a945d089ebd3c66f) |

The escrow released 0.0001 test ETH. Before settlement, read-only calls accepted the fresh bound proof and rejected a magnitude change and the authentic gate proof's mismatched beneficiary. After settlement, a read-only call rejected another submission. The [live transaction and verification manifest](public/evidence/deployment.json) links the evidence and reports chain finality separately from successful receipt status.

## Dashboard captures

- [Desktop at 1920 px](output/screenshots/dashboard-desktop.png)
- [Mobile at 390 px](output/screenshots/dashboard-mobile.png)

## Project links

- [Live production dashboard](https://seismiclock-primus.vercel.app/)
- [Public GitHub repository](https://github.com/alaminvyn/seismiclock-primus)
- [Security and limitations](SECURITY.md)
- [Base Sepolia test and fee records](DEPLOYMENT.md)

The deployment, funding and settlement receipts reached Base Sepolia finality. The three transactions used 4,762,709 gas and incurred 0.000029828779515868 test ETH in network fees, including reported L1 data fees. The 0.0001 test ETH principal was released to the designated beneficiary.
