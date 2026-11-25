# Deployment

Network is Base Sepolia, chain ID 84532. The deployment wallet serves as the fixed funder and beneficiary for this historical round trip. The escrow principal is 0.0001 test ETH.

## Transactions

1. Create `SeismicDeployment` with the approved test account in both constructor arguments. It creates the non-proxy verifier, initializes its sole signer and freezes authority, then creates the escrow.
2. Confirm the verifier owner is zero, the signer is the official Core SDK production signer, the escrow pins the verifier, and the funder and beneficiary match the approved wallet. Fund the escrow with exactly 0.0001 ETH.
3. Generate a fresh actual-escrow proof after funding. Check the verifier and escrow preview by read-only calls before asking for wallet confirmation of settlement.

Launch `pnpm dev` and open `/deployment-console.html` on loopback for the wallet-based initial transaction. The console is excluded from the production build, and the chain, active sender, wallet balance and live gas estimate are checked before the wallet request.

## Estimate

| Operation | Measured gas in local EVM |
|---|---:|
| Atomic deployment | 4,048,108 |
| Funding | 46,115 |
| Genuine-proof settlement | 193,121 |
| Total | 4,287,344 |

At the sampled Base Sepolia price of 6,000,000 wei per gas, execution is approximately 0.000025724 ETH. The Base fee oracle estimated an additional data-fee upper bound of 0.000001918 ETH for the sample transaction sizes. Estimated total including principal is 0.000127642 ETH. Final wallet costs depend on the live fee market and the final proof calldata.

## Proof generation

Set the project App ID and App Secret only in the proof runner environment. Never publish credentials.

```sh
node scripts/prove.cjs ESCROW_ADDRESS BENEFICIARY_ADDRESS path/to/fresh-proof.json
```

A funded escrow rejects proofs issued prior to funding. Issue a new proof if it reaches the 30-minute limit. The archived proof stays available for independent verifier-only checks after expiration.

## Frontend deployment

Import the public repository into Vercel as Vite, with `pnpm run build` and output `dist`. Configure a public Base Sepolia RPC if required. Verify the production deployment commit against the published repository and check the dashboard's deployment and transaction links. GitHub Pages and mainnet are outside this workflow.


## Actual testnet execution

The three mined receipts used 4,762,709 gas. Actual total network fees were 0.000029828779515868 test ETH, including reported data fees. The 0.0001 test ETH funded principal was released to the designated test wallet. The data and gas in testnet receipts may differ from isolated local transaction estimates. The public evidence manifest records exact receipt values.
