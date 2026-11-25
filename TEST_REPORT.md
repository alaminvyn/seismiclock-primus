# Executed tests

30 passed, 0 failed in the local Ganache EVM configured with Base Sepolia chain ID and the Shanghai hardfork. The runtime used standalone Node 24.11.1 and Solidity 0.8.28.

- Verifier freezing and signer configuration, including rejected reinitialization and signer management.
- Original Primus gate proof acceptance and rejection of the same authentic proof by escrow recipient policy.
- A fresh genuine proof bound to the local contract settles the exact principal one time.
- Source, signed conditions, rule order, beneficiary, context, timestamp, geography, magnitude, coverage and signed-byte mutations.
- Missing and duplicate fields, ambiguous fixed-point numbers, wrong event ID, stale/future proofs and invalid signature encoding.
- Transfer failure rollback, reentrant settlement rejection, unauthorized access, expiry refund and terminal states.

TypeScript and the Vite production build passed. Desktop and 400 px mobile layout were visually inspected in Brave, and the signed proof disclosure was opened successfully. Production dependency audit reported no known vulnerabilities. Testnet post-deployment calls independently confirmed authentic verifier acceptance, tampered signature rejection, authentic gate proof rejection by beneficiary, valid policy preview and duplicate-settlement rejection. See the [evidence manifest](public/evidence/deployment.json) for the actual blocks and receipt status.

The refined browser build passed layout checks at 1920, 1440, 1280, 768 and 390 CSS pixels with no detected clipping or horizontal overflow. The browser loaded the settled Base Sepolia state, opened the proof inspector and replayed the recorded pre-settlement checks.
