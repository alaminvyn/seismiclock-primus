import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const file='public/evidence/deployment.json';
const manifest=JSON.parse(readFileSync(file));
const endpoint=process.env.SEISMIC_BASE_RPC || 'https://base-sepolia.gateway.tenderly.co';
const rpc=(method,params=[])=>{
  const out=execFileSync('curl',['-fsS','--max-time','12','-H','Content-Type: application/json','--data-binary','@-',endpoint],{encoding:'utf8',input:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const json=JSON.parse(out);
  if(json.error)throw Error(`${method}: ${json.error.message}`);
  return json.result;
};
assert.equal(rpc('eth_chainId'),'0x14a34');
const tip=Number(BigInt(rpc('eth_getBlockByNumber',['finalized',false]).number));
let remaining=0;
for(const [stage,data] of Object.entries(manifest.receipts??{})){
  if(data.finalized)continue;
  if(data.block>tip){remaining++;continue;}
  const receipt=rpc('eth_getTransactionReceipt',[manifest[stage+'Tx']]);
  assert.equal(receipt.status,'0x1');
  assert.equal(Number(BigInt(receipt.blockNumber)),data.block);
  const block=rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
  assert.equal(block.hash,receipt.blockHash);
  data.finalized=true;
}
writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
console.log({finalizedTip:tip,receiptsAwaitingFinality:remaining});
