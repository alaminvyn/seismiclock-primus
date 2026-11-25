import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {encodeFunctionData,decodeFunctionResult,toFunctionSelector} from 'viem';

const endpoint=process.env.SEISMIC_BASE_RPC||'https://base-sepolia.gateway.tenderly.co';
const load=file=>JSON.parse(readFileSync(file));
const rpc=(method,params=[])=>JSON.parse(execFileSync('curl',['-fsS','--max-time','18','-H','Content-Type: application/json','--data-binary','@-',endpoint],{input:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),encoding:'utf8'}));
const m=load('public/evidence/deployment.json');
const proof=file=>{const p=load(`public/evidence/${file}.json`);return {...p,timestamp:BigInt(p.timestamp)};};
const gate=proof('usgs-proof');
const bound=proof('base-settlement-proof');
const esc=load('artifacts/SeismicLock.json').abi;
const ver=load('artifacts/PrimusZKTLS.json').abi;
assert.equal(rpc('eth_chainId').result,'0x14a34');
const block=rpc('eth_blockNumber').result;
const call=(to,abi,functionName,args=[])=>rpc('eth_call',[{to,data:encodeFunctionData({abi,functionName,args}),from:m.beneficiary},block]);
const verify=p=>call(m.verifier,ver,'verifyAttestation',[p]);
const preview=p=>call(m.escrow,esc,'preview',[p]);
const altered={...bound,data:bound.data.replace('"7.8"','"7.9"')};
assert.notEqual(bound.data,altered.data);
assert.equal(verify(gate).result,'0x');
assert.equal(verify(bound).result,'0x');
assert.match(verify(altered).error?.message??'',/revert|invalid signature/i);
const response=preview(bound);
const rejected=preview(gate);
const after=process.argv.includes('--after');
if(after){
 for(const item of [response,rejected])assert.ok(item.error?.data?.startsWith(toFunctionSelector('WrongState(uint8)')));
}else{
 assert.ok(response.result,JSON.stringify(response.error));
 const valid=decodeFunctionResult({abi:esc,functionName:'preview',data:response.result});
 assert.equal(valid.magnitudeE6,7800000n);
 assert.ok(rejected.error?.data?.startsWith(toFunctionSelector('WrongRecipient()')),JSON.stringify(rejected.error));
 const estimate=rpc('eth_estimateGas',[{to:m.escrow,from:m.beneficiary,data:encodeFunctionData({abi:esc,functionName:'settle',args:[bound]})}]);
 assert.ok(estimate.result,JSON.stringify(estimate.error));
 console.log('Estimated settlement gas',Number(BigInt(estimate.result)));
}
const label=after?'duplicateAfterSettlement':'checksBeforeSettlement';
m[label]={block:Number(BigInt(block)),originalSignature:'accepted',boundSignature:'accepted',tamperedSignature:'rejected',escrowBound:after?'duplicate-rejected':'accepted',escrowOriginal:after?'terminal-state-rejected':'beneficiary-rejected'};
m.boundProof=true;
writeFileSync('public/evidence/deployment.json',JSON.stringify(m,null,2)+'\n');
console.log(m[label]);
