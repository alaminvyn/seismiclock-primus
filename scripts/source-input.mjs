import {readFileSync,writeFileSync} from 'node:fs';
import {keccak256,stringToHex} from 'viem';
import path from 'node:path';

const names={SeismicDeployment:'contracts/SeismicDeployment.sol',SeismicLock:'contracts/SeismicLock.sol',PrimusZKTLS:'contracts/vendor/PrimusZKTLS.sol'};
for(const [name,file] of Object.entries(names)){
 const {metadata}=JSON.parse(readFileSync(`artifacts/${name}.json`));
 const sources=Object.fromEntries(Object.entries(metadata.sources).map(([key,reference])=>{
  const content=readFileSync(key.startsWith('@')?path.join('node_modules',key):key,'utf8');
  if(keccak256(stringToHex(content))!==reference.keccak256)throw Error(`Source hash mismatch for ${key}`);
  return [key,{content}];
 }));
 const {compilationTarget,...settings}=metadata.settings;
 const standardJson={language:'Solidity',sources,settings:{...settings,outputSelection:{'*':{'*':['abi','evm.bytecode','evm.deployedBytecode','metadata']}}}};
 writeFileSync(`artifacts/${name}.verification.json`,JSON.stringify({stdJsonInput:standardJson,compilerVersion:metadata.compiler.version,contractIdentifier:`${file}:${name}`},null,2)+'\n');
}
