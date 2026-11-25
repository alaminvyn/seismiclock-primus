import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {decodeEventLog,decodeFunctionResult,encodeFunctionData,isAddress,isAddressEqual,formatEther,zeroAddress} from 'viem';

const endpoint=process.env.SEISMIC_BASE_RPC || 'https://base-sepolia.gateway.tenderly.co';
const signer='0x5Ed3176045F68617B0958a61ac1868875C98C14d';
const rpc=(method,params=[])=>{
  const data=execFileSync('curl',['-fsS','--max-time','18','-H','Content-Type: application/json','--data-binary','@-',endpoint],{input:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),encoding:'utf8'});
  const response=JSON.parse(data);
  if(response.error)throw Error(`${method}: ${response.error.message}`);
  return response.result;
};
const contract=name=>JSON.parse(readFileSync(`artifacts/${name}.json`));
const stage=process.argv[2];
const hash=process.argv[3];
assert.match(hash??'',/^0x[0-9a-f]{64}$/i);
assert.equal(rpc('eth_chainId'),'0x14a34');
const receipt=rpc('eth_getTransactionReceipt',[hash]);
assert.equal(receipt?.status,'0x1','Require a successful Base Sepolia receipt');
const finalized=rpc('eth_getBlockByNumber',['finalized',false]);
const isFinalized=BigInt(finalized.number)>=BigInt(receipt.blockNumber);
assert.ok(isFinalized||process.env.SEISMIC_ALLOW_MINED==='1','Receipt is not yet on a finalized L2 block');
const manifestFile='public/evidence/deployment.json';
const manifest=JSON.parse(readFileSync(manifestFile));
const auth=contract('PrimusZKTLS');
const escrowArtifact=contract('SeismicLock');
const read=(address,abi,functionName,args=[])=>decodeFunctionResult({abi,functionName,data:rpc('eth_call',[{to:address,data:encodeFunctionData({abi,functionName,args})},receipt.blockNumber])});
function event(abi,name,address) {
  for(const log of receipt.logs){
    if(!isAddressEqual(log.address,address))continue;
    try{
      const result=decodeEventLog({abi,topics:log.topics,data:log.data});
      if(result.eventName===name)return result.args;
    }catch{/* Ignore other event signatures. */}
  }
  throw Error(`Missing ${name} event`);
}
if(stage==='deployment'){
  assert.ok(isAddress(receipt.contractAddress));
  const {verifier,escrow}=event(contract('SeismicDeployment').abi,'Deployment',receipt.contractAddress);
  assert.equal(rpc('eth_getCode',[verifier,receipt.blockNumber]),auth.runtime);
  assert.equal(read(verifier,auth.abi,'owner'),zeroAddress);
  assert.ok(isAddressEqual(read(verifier,auth.abi,'_attestors',[0n])[0],signer));
  assert.ok(isAddressEqual(read(escrow,escrowArtifact.abi,'verifier'),verifier));
  const funder=read(escrow,escrowArtifact.abi,'funder');
  const beneficiary=read(escrow,escrowArtifact.abi,'beneficiary');
  assert.ok(isAddressEqual(funder,receipt.from)&&isAddressEqual(beneficiary,receipt.from));
  const p=JSON.parse(readFileSync('public/evidence/usgs-proof.json'));
  read(verifier,auth.abi,'verifyAttestation',[{...p,timestamp:BigInt(p.timestamp)}]);
  Object.assign(manifest,{escrow,verifier,funder,beneficiary,deploymentTx:hash});
}else if(stage==='funding'){
  const registered=event(escrowArtifact.abi,'Funded',manifest.escrow);
  assert.equal(registered.amount,100_000_000_000_000n);
  assert.ok(isAddressEqual(registered.funder,manifest.funder));
  manifest.fundingTx=hash;
}else if(stage==='settlement'){
  const paid=event(escrowArtifact.abi,'Settled',manifest.escrow);
  assert.equal(paid.amount,100_000_000_000_000n);
  assert.ok(isAddressEqual(paid.beneficiary,manifest.beneficiary));
  manifest.settlementTx=hash;
}else throw Error('Stage must be deployment, funding, or settlement');
const fee=BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice)+BigInt(receipt.l1Fee??'0x0')+BigInt(receipt.operatorFee??'0x0');
manifest.receipts??={};
manifest.receipts[stage]={block:Number(BigInt(receipt.blockNumber)),gasUsed:Number(BigInt(receipt.gasUsed)),feeEth:formatEther(fee),finalized:isFinalized,l1FeeAvailable:receipt.l1Fee!==undefined};
writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
