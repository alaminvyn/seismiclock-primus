import ganache from 'ganache';
import {readFileSync} from 'node:fs';
import {decodeEventLog, encodeDeployData, encodeFunctionData} from 'viem';

export const artifact = name => JSON.parse(readFileSync(new URL(`../artifacts/${name}.json`,import.meta.url)));
export const principal = 100_000_000_000_000n;
export async function fixture({time = new Date(), chainId = 84532, beneficiaryIndex = 1} = {}) {
  const provider = ganache.provider({chain:{chainId,hardfork:'shanghai',time},wallet:{deterministic:true},logging:{quiet:true}});
  const rpc = (method,params=[]) => provider.request({method,params});
  const accounts = await rpc('eth_accounts');
  const [funder] = accounts;
  const beneficiary = accounts[beneficiaryIndex];
  const deploy = artifact('SeismicDeployment');
  const escrowAbi = artifact('SeismicLock').abi;
  const verifierAbi = artifact('PrimusZKTLS').abi;
  const deployData = encodeDeployData({abi:deploy.abi,bytecode:deploy.bytecode,args:[funder,beneficiary]});
  async function send(tx) {
    const estimated = BigInt(await rpc('eth_estimateGas',[tx]));
    const hash = await rpc('eth_sendTransaction',[{...tx,gas:`0x${(estimated*13n/10n).toString(16)}`}]);
    const receipt = await rpc('eth_getTransactionReceipt',[hash]);
    if (receipt.status !== '0x1') throw Error('Local transaction reverted');
    return receipt;
  }
  const receipt = await send({from:funder,data:deployData});
  const deployment = receipt.logs.flatMap(log => {
    try {return [decodeEventLog({abi:deploy.abi,data:log.data,topics:log.topics})];}
    catch {return [];}
  }).find(x=>x.eventName==='Deployment');
  const {escrow,verifier} = deployment.args;
  const tx = (functionName,args=[],extra={}) => ({from:funder,to:escrow,data:encodeFunctionData({abi:escrowAbi,functionName,args}),...extra});
  const call = (functionName,args=[],extra={}) => rpc('eth_call',[tx(functionName,args,extra),'latest']);
  const fund = () => send(tx('fund',[],{value:`0x${principal.toString(16)}`}));
  return {accounts,funder,beneficiary,escrow,verifier,verifierAbi,escrowAbi,receipt,rpc,send,tx,call,fund,close:()=>provider.disconnect()};
}
