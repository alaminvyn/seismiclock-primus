import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { encodeFunctionData,encodeDeployData,formatEther,parseAbi,serializeTransaction,decodeFunctionResult } from 'viem';
import { fixture,artifact,principal } from './local.mjs';

const url=process.env.SEISMIC_BASE_RPC || 'https://base-sepolia.drpc.org';
const rpc=(method,params=[])=>{
  const out=execFileSync('curl',['-fsS','--max-time','18','-H','Content-Type: application/json','--data-binary','@-',url],{encoding:'utf8',input:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const response=JSON.parse(out);
  if(response.error)throw Error(`${method}: ${response.error.message}`);
  return response.result;
};
const oneProof=JSON.parse(readFileSync('public/evidence/local-settlement-proof.json'));
const proof={...oneProof,timestamp:BigInt(oneProof.timestamp)};
const f=await fixture({time:new Date(Number(proof.timestamp)-10_000)});
try{
  const plan=artifact('SeismicDeployment');
  const creation=encodeDeployData({abi:plan.abi,bytecode:plan.bytecode,args:[f.funder,f.beneficiary]});
  const funding=await f.fund();
  const settlement=f.tx('settle',[proof]);
  const settle=await f.send(settlement);
  const gas=[BigInt(f.receipt.gasUsed),BigInt(funding.gasUsed),BigInt(settle.gasUsed)];
  const calls=[{data:creation},{to:f.escrow,data:f.tx('fund').data,value:principal},{to:f.escrow,data:settlement.data}];
  if(await Promise.resolve(rpc('eth_chainId'))!=='0x14a34')throw Error('Unexpected RPC chain');
  const gasPrice=BigInt(rpc('eth_gasPrice'));
  const abi=parseAbi(['function getL1FeeUpperBound(uint256) view returns (uint256)']);
  let totalL1=0n;
  for (let nonce=0;nonce<calls.length;nonce++){
    const blob=serializeTransaction({type:'eip1559',chainId:84532,nonce,gas:gas[nonce]*12n/10n,maxFeePerGas:gasPrice,maxPriorityFeePerGas:gasPrice/5n,...calls[nonce]},{r:`0x${'ef'.repeat(32)}`,s:`0x${'12'.repeat(32)}`,yParity:0});
    const result=rpc('eth_call',[{to:'0x420000000000000000000000000000000000000F',data:encodeFunctionData({abi,functionName:'getL1FeeUpperBound',args:[BigInt((blob.length-2)/2)]})},'latest']);
    totalL1+=decodeFunctionResult({abi,functionName:'getL1FeeUpperBound',data:result});
  }
  const totalGas=gas.reduce((a,b)=>a+b,0n);
  console.log(JSON.stringify({gas:gas.map(String),totalGas:String(totalGas),gasPriceWei:String(gasPrice),executionEth:formatEther(totalGas*gasPrice),l1DataUpperBoundEth:formatEther(totalL1),principalEth:formatEther(principal),estimateTotalEth:formatEther(totalGas*gasPrice+totalL1+principal)},null,2));
} finally {await f.close();}
