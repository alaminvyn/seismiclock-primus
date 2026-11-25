import './style.css';
import {createPublicClient,createWalletClient,custom,decodeEventLog,encodeDeployData,formatEther,fallback,http,isAddress,type Abi,type Address,type Hex} from 'viem';
import {baseSepolia} from 'viem/chains';
import artifact from '../artifacts/SeismicDeployment.json';

const button=(id:string)=>document.getElementById(id) as HTMLButtonElement;
const log=document.getElementById('log')!;
const provider=(window as Window & {ethereum?:{request(args:{method:string;params?:readonly unknown[]}):Promise<unknown>}}).ethereum;
const allowed=import.meta.env.DEV && ['localhost','127.0.0.1'].includes(location.hostname);
const rpc=createPublicClient({chain:baseSepolia,transport:fallback([http(import.meta.env.VITE_BASE_SEPOLIA_RPC || 'https://base-sepolia.gateway.tenderly.co',{timeout:8000,retryCount:0}),http('https://base-sepolia.drpc.org',{timeout:8000,retryCount:0})])});
const abi=artifact.abi as Abi;
let account:Address|undefined;
let sent=false;
let gas=0n;
const maxFeePerGas=14_000_000n;
const maxPriorityFeePerGas=1_000_000n;
async function chain(){
  if(!allowed||!provider)throw Error('Use this console on localhost with the Base Sepolia wallet.');
  if(await provider.request({method:'eth_chainId'})!=='0x14a34')throw Error('Select Base Sepolia in your wallet.');
  return provider;
}
async function connect(){
  const wallet=await chain();
  const accounts=await wallet.request({method:'eth_requestAccounts'});
  if(!Array.isArray(accounts)||!isAddress(accounts[0]))throw Error('No account selected.');
  const sender:Address=accounts[0];
  const bytecode=encodeDeployData({abi,bytecode:artifact.bytecode as Hex,args:[sender,sender]});
  const [balance,estimate,gasPrice]=await Promise.all([
    rpc.getBalance({address:sender}),
    rpc.estimateGas({account:sender,data:bytecode}),
    rpc.getGasPrice(),
  ]);
  if(gasPrice>maxFeePerGas||estimate>4_300_000n)throw Error('Live deployment fee exceeds the approved transaction budget assumptions.');
  gas=estimate*115n/100n;
  if(balance<200_000_000_000_000n)throw Error('The selected wallet has less than the authorized total ceiling.');
  account=sender;
  log.textContent=`Funder and beneficiary: ${account}\nBalance: ${formatEther(balance)} test ETH\nLive deployment estimate: ${estimate} gas\nIndicative execution fee: ${formatEther(estimate*gasPrice)} ETH plus L1 data\nEscrow principal in separate funding transaction: 0.0001 ETH`;
  button('deploy').disabled=sent;
}
async function deploy(){
  if(sent||!account)return;
  const wallet=createWalletClient({chain:baseSepolia,transport:custom(await chain())});
  const [active]=await wallet.getAddresses();
  if(active?.toLowerCase()!==account.toLowerCase())throw Error('Reconnect the designated account.');
  const data=encodeDeployData({abi,bytecode:artifact.bytecode as Hex,args:[account,account]});
  button('deploy').disabled=true;
  const hash=await wallet.sendTransaction({account,data,value:0n,gas,maxFeePerGas,maxPriorityFeePerGas});
  sent=true;
  log.textContent+=`\nDeployment submitted: ${hash}`;
  const receipt=await rpc.waitForTransactionReceipt({hash,confirmations:2});
  if(receipt.status!=='success')throw Error('Deployment transaction reverted.');
  for(const entry of receipt.logs){
    if(entry.address.toLowerCase()!==receipt.contractAddress?.toLowerCase())continue;
    try{
      const event=decodeEventLog({abi,data:entry.data,topics:entry.topics});
      if(event.eventName==='Deployment')log.textContent+=`\n${JSON.stringify(event.args,null,2)}\nDeployment gas: ${receipt.gasUsed}`;
    }catch{/* The caller address and event signature identify the deployment log. */}
  }
}
function on(id:string,fn:()=>Promise<void>){
  button(id).addEventListener('click',()=>void fn().catch(err=>{
    log.textContent+=`\n${String(err.shortMessage??err.message).split('\n')[0]}`;
    if(id==='deploy'&&!sent)button('deploy').disabled=false;
  }));
}
on('connect',connect);on('deploy',deploy);
