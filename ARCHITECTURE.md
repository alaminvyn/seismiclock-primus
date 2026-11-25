# Architecture

The Node.js Core SDK requests the official USGS GeoJSON catalog with a narrow time window and requires event ID `us6000jllz`. It reveals eight fields from one feature and binds the attestation to a beneficiary and a JSON scope containing chain ID, escrow address, policy version and event ID. The direct event-ID endpoint encountered a Primus response-size mismatch. The catalog response produced authentic attestations.

The atomic deployment constructor creates the upstream PrimusZKTLS contract, installs the published production attestor as its sole signer, renounces ownership, and deploys an escrow with the verifier address immutable. Initialization and authority freezing finish in the same transaction as creation.

The escrow fixes the funder, beneficiary, 0.0001 ETH principal, event and historical coverage interval. It enforces the exact canonical request, ordered response rules, conditions, context, JSON field order and value encodings. Valid settlement is terminal before the destination is called. The funder may refund exactly the principal after seven days if still funded.

Vercel serves a static dashboard. The proof runner executes locally and secrets stay in its environment or private local configuration. Wallet writes go directly through the connected Base Sepolia wallet.
