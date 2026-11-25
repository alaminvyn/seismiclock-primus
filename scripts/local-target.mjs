import {fixture} from './local.mjs';
import {decodeFunctionResult} from 'viem';
const f=await fixture();
console.log(JSON.stringify({escrow:f.escrow,beneficiary:f.beneficiary,scope:JSON.parse(decodeFunctionResult({abi:f.escrowAbi,functionName:'expectedContext',data:await f.call('expectedContext')})).scope,deploymentGas:Number(BigInt(f.receipt.gasUsed)),fundingGas:Number(BigInt((await f.fund()).gasUsed))}));
await f.close();
