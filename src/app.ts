import './style.css';
import {createPublicClient,createWalletClient,custom,encodeFunctionData,http,formatEther,fallback,isAddress,isHex,type Address,type Hash} from 'viem';
import {baseSepolia} from 'viem/chains';
import escrowArtifact from '../artifacts/SeismicLock.json';
import verifierArtifact from '../artifacts/PrimusZKTLS.json';
import type {Abi} from 'viem';

type Provider = {request(args:{method:string;params?:readonly unknown[]}):Promise<unknown>; on?(event:string,fn:()=>void):void};
const provider = (window as Window & {ethereum?:Provider}).ethereum;
const rpc = createPublicClient({chain:baseSepolia,transport:fallback([http(import.meta.env.VITE_BASE_SEPOLIA_RPC || 'https://base-sepolia.gateway.tenderly.co',{timeout:8000,retryCount:0}),http('https://base-sepolia.drpc.org',{timeout:8000,retryCount:0})])});
const $ = <T extends HTMLElement=HTMLElement>(id:string) => document.getElementById(id) as T;
const escrowAbi = escrowArtifact.abi as Abi;
const verifierAbi = verifierArtifact.abi as Abi;
const explorer='https://base-sepolia.blockscout.com';
const principal=100_000_000_000_000n;

type Attestation={
  recipient:Address;
  request:{url:string;header:string;method:string;body:string};
  reponseResolve:{keyName:string;parseType:string;parsePath:string}[];
  data:string;attConditions:string;timestamp:bigint;additionParams:string;
  attestors:{attestorAddr:Address;url:string}[];
  signatures:Hash[];
};
let proof:Attestation | undefined;
let proofName='Original gate proof';
let hasBoundProof=false;
let recordedCheckBlock:bigint|undefined;
let escrow:Address | undefined;
let verifier:Address | undefined;
let account:Address | undefined;
let canSettle=false;
let busy=false;
let cachedState=-1;
let funder:Address | undefined;
let expiresAt=0n;

function message(text:string,kind='') {
  $('feedback').textContent=text;
  $('feedback').dataset.kind=kind;
}
const short=(a:string)=>`${a.slice(0,8)}…${a.slice(-6)}`;
function link(label:string,path:string){
  const el=document.createElement('a');
  el.href=explorer+path;el.target='_blank';el.rel='noreferrer';el.textContent=label;
  $('chain-links').append(el);
}
function address(x:unknown):x is Address {return typeof x==='string'&&isAddress(x);}
function hash(x:unknown):x is Hash {return typeof x==='string'&&isHex(x)&&x.length===66;}
function record(x:unknown):x is Record<string,unknown> {return !!x&&typeof x==='object'&&!Array.isArray(x);}
function stringFields(x:unknown,keys:string[]):boolean {return record(x)&&keys.every(k=>typeof x[k]==='string');}
function decodeProof(raw:unknown):Attestation {
  if(!record(raw)||!address(raw.recipient)||!stringFields(raw.request,['url','header','method','body'])
    ||!stringFields(raw,['data','attConditions','additionParams'])
    ||!Array.isArray(raw.reponseResolve)||raw.reponseResolve.length!==8||!raw.reponseResolve.every(x=>stringFields(x,['keyName','parseType','parsePath']))
    ||!Array.isArray(raw.attestors)||raw.attestors.length!==1||!raw.attestors.every(x=>record(x)&&address(x.attestorAddr)&&typeof x.url==='string')
    ||!Array.isArray(raw.signatures)||raw.signatures.length!==1||!raw.signatures.every(x=>typeof x==='string'&&isHex(x)&&x.length===132)
    ||!/^\d{13}$/.test(String(raw.timestamp))) throw Error('The file does not contain a supported Primus attestation.');
  const result=raw as unknown as Attestation;
  return {...result,timestamp:BigInt(String(raw.timestamp))};
}
function renderProof(){
  if(!proof)return;
  $('proof-preview').textContent=JSON.stringify(proof,(_,value)=>typeof value==='bigint'?value.toString():value,2);
  $('checks').replaceChildren();
  $<HTMLButtonElement>('verify').disabled=!verifier;
}
function checkRow(label:string,outcome:string){
  const row=document.createElement('li');const value=document.createElement('span');
  value.textContent=outcome;value.dataset.pass=outcome==='Passed'?'yes':'no';
  row.append(label,value);$('checks').append(row);
}
function refreshControls(){
  $('transaction-controls').hidden=!escrow||!account;
  const isFunder=account?.toLowerCase()===funder?.toLowerCase();
  $<HTMLButtonElement>('fund').disabled=busy||!isFunder||cachedState!==0;
  $<HTMLButtonElement>('settle').disabled=busy||!canSettle||cachedState!==1;
  $<HTMLButtonElement>('refund').disabled=busy||!isFunder||cachedState!==1||BigInt(Math.floor(Date.now()/1000))<expiresAt;
}
async function chainState(){
  if(!escrow)return;
  const read=(functionName:string)=>rpc.readContract({address:escrow!,abi:escrowAbi,functionName});
  const [state,beneficiary,owner,expiry]=await Promise.all(['state','beneficiary','funder','expiresAt'].map(read));
  cachedState=Number(state);
  if(cachedState<0||cachedState>3||!address(beneficiary)||!address(owner))throw Error('Unexpected escrow state.');
  funder=owner;expiresAt=BigInt(String(expiry));
  $('state').textContent=['Awaiting funding','Funded','Settled','Refunded'][cachedState];
  $('balance').textContent=`${formatEther(cachedState===1?principal:0n)} ETH`;
  $('beneficiary').textContent=short(beneficiary);$('beneficiary').title=beneficiary;
  $('pipeline-settlement').textContent=['Deployed · awaiting funding','Funded · awaiting eligible proof','Settlement recorded on-chain','Principal refunded'][cachedState];
  refreshControls();
}
function errorText(err:unknown){
  if(err instanceof Error){
    const name=err.message.match(/(?:Error:|reverted with the following reason:)\s*([A-Za-z][A-Za-z0-9_ ]{2,50})/)?.[1];
    return name||('shortMessage' in err?String(err.shortMessage):err.message).split('\n')[0].slice(0,180);
  }
  return 'The request could not be completed.';
}
async function verify(blockNumber?:bigint){
  if(!proof||!verifier)return;
  canSettle=false;refreshControls();$('checks').replaceChildren();
  message(blockNumber?'Replaying read-only checks at the recorded block…':'Waiting for the Base Sepolia read-only call…');
  try{
    await rpc.simulateContract({address:verifier,abi:verifierAbi,functionName:'verifyAttestation',args:[proof],blockNumber});
    checkRow('Primus attestor signature','Passed');
  }catch(err){
    checkRow('Primus attestor signature','Rejected or RPC unavailable');
    message(errorText(err),'error');return;
  }
  if(!escrow)return;
  try {
    await rpc.simulateContract({address:escrow,abi:escrowAbi,functionName:'preview',args:[proof],blockNumber});
    for(const label of ['USGS source and response rules','Event status and coverage window','Magnitude and geographic bounds','Beneficiary and escrow context','Freshness and replay state'])checkRow(label,'Passed');
    canSettle=blockNumber===undefined;
    message(blockNumber?`Historical checks passed at Base Sepolia block ${blockNumber}. Current settlement state is unchanged.`:`${proofName} passed the read-only escrow call.`,'success');
  }catch(err){
    checkRow('Escrow policy','Rejected or RPC unavailable');
    message(`Signature accepted. Escrow check: ${errorText(err)}`,'error');
  }
  refreshControls();
}
async function connect(){
  if(!provider)throw Error('No injected wallet was detected.');
  const list=await provider.request({method:'eth_requestAccounts'});
  if(!Array.isArray(list)||!address(list[0]))throw Error('No wallet account selected.');
  const chain=await provider.request({method:'eth_chainId'});
  if(chain!=='0x14a34')throw Error('Select Base Sepolia in your wallet and connect again.');
  account=list[0];$('wallet').textContent=short(account);
  refreshControls();message('Wallet connected on Base Sepolia.');
}
async function write(functionName:'fund'|'settle'|'refund'){
  if(busy||!provider||!account||!escrow)return;
  if(await provider.request({method:'eth_chainId'})!=='0x14a34')throw Error('Select Base Sepolia in your wallet.');
  if(functionName==='settle'&&(!proof||!canSettle))throw Error('Verify a fresh, bound proof first.');
  busy=true;refreshControls();
  try{
    const args=functionName==='settle'?[proof]:[];
    const value=functionName==='fund'?principal:0n;
    const tx=await rpc.simulateContract({address:escrow,abi:escrowAbi,functionName,account,args,value});
    const maxFeePerGas=14_000_000n;
    const maxPriorityFeePerGas=1_000_000n;
    const estimated=await rpc.estimateContractGas(tx.request);
    const ceiling=functionName==='settle'?230_000n:58_000n;
    if(estimated>ceiling||await rpc.getGasPrice()>maxFeePerGas)throw Error('Live fees exceed the planned settlement budget assumptions.');
    const gas=estimated*115n/100n;
    const wallet=createWalletClient({chain:baseSepolia,transport:custom(provider)});
    message('Review the transaction in your wallet.');
    const txHash=await wallet.sendTransaction({account,to:escrow,data:encodeFunctionData({abi:escrowAbi,functionName,args}),value,gas,maxFeePerGas,maxPriorityFeePerGas});
    link(`${functionName} transaction`,`/tx/${txHash}`);
    const receipt=await rpc.waitForTransactionReceipt({hash:txHash,confirmations:2});
    if(receipt.status!=='success')throw Error('The transaction reverted.');
    canSettle=false;await chainState();message(`Confirmed on Base Sepolia · ${short(txHash)}`,'success');
  }finally{busy=false;refreshControls();}
}
function on(id:string,fn:()=>Promise<void>){$(id).addEventListener('click',()=>void fn().catch(error=>message(errorText(error),'error')));}
async function loadBound(){
  if(!hasBoundProof)return;
  const response=await fetch('/evidence/base-settlement-proof.json',{cache:'no-store'});
  if(!response.ok)throw Error('The Base Sepolia proof archive is unavailable.');
  proof=decodeProof(await response.json());proofName='Base Sepolia escrow proof';
  canSettle=false;renderProof();refreshControls();
  message('Escrow-bound proof loaded. Run the Base Sepolia read-only check.');
}
on('bound-proof',loadBound);
on('replay',async()=>{
  if(recordedCheckBlock===undefined)return;
  await loadBound();
  await verify(recordedCheckBlock);
});
on('wallet',connect);on('verify',()=>verify());on('fund',()=>write('fund'));on('settle',()=>write('settle'));on('refund',()=>write('refund'));
for(const event of ['accountsChanged','chainChanged'])provider?.on?.(event,()=>{
  account=undefined;canSettle=false;$('wallet').textContent='Connect wallet';refreshControls();
});
$<HTMLInputElement>('proof-file').addEventListener('change',async(event)=>{
  const input=event.currentTarget as HTMLInputElement;
  const file=input.files?.[0];if(!file)return;
  try{
    if(file.size>20_000)throw Error('Select a proof smaller than 20 KB.');
    proof=decodeProof(JSON.parse(await file.text()));proofName='Imported proof';
    canSettle=false;renderProof();refreshControls();
    message(verifier?'Proof loaded. Run the read-only check.':'Proof loaded. Base Sepolia deployment is pending.');
  }catch(err){message(errorText(err),'error');}
  finally{input.value='';}
});
async function load(){
  const [raw,config]=await Promise.all(['/evidence/usgs-proof.json','/evidence/deployment.json'].map(async url=>{
    const r=await fetch(url);if(!r.ok)throw Error('Could not load project evidence.');return r.json();
  }));
  proof=decodeProof(raw);
  if(config.chainId===84532&&address(config.escrow)&&address(config.verifier)){
    escrow=config.escrow;verifier=config.verifier;
    hasBoundProof=config.boundProof===true;
    $('bound-proof').hidden=!hasBoundProof;
    const historicalBlock=config.checksBeforeSettlement?.block;
    if(Number.isSafeInteger(historicalBlock)&&historicalBlock>0)recordedCheckBlock=BigInt(historicalBlock);
    $('replay').hidden=recordedCheckBlock===undefined;
    link('Escrow contract',`/address/${escrow}`);
    link('Project verifier',`/address/${verifier}`);
    for(const [label,key] of [['Deployment','deploymentTx'],['Funding','fundingTx'],['Settlement','settlementTx']]){
      if(hash(config[key]))link(label,`/tx/${config[key]}`);
    }
    renderProof();
    message('Original gate proof loaded. Its recipient and context belong to the gate exercise.');
    await chainState();
  }else{
    renderProof();
    message('Original Primus proof loaded. Local tests passed. Base Sepolia deployment is pending.');
  }
}
void load().catch(err=>message(errorText(err),'error'));
