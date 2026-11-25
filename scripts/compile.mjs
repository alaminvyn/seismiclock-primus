import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const names = ['SeismicDeployment','SeismicLock','UsgsPolicy'];
const sources = Object.fromEntries(names.map(name => [`contracts/${name}.sol`, {content:fs.readFileSync(`contracts/${name}.sol`,'utf8')}]));
const input = {
  language:'Solidity', sources,
  settings:{optimizer:{enabled:true,runs:200}, evmVersion:'shanghai', outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','metadata']}}},
};
const output = JSON.parse(solc.compile(JSON.stringify(input),{import(file){
  const full = file.startsWith('@') ? path.join('node_modules',file) : file;
  return fs.existsSync(full)?{contents:fs.readFileSync(full,'utf8')}:{error:`Missing import ${file}`};
}}));
for (const error of output.errors ?? []) console.error(error.formattedMessage);
if (output.errors?.some(error => error.severity === 'error')) process.exit(1);
fs.mkdirSync('artifacts', {recursive:true});
for (const contracts of Object.values(output.contracts)) {
  for (const [name, compiled] of Object.entries(contracts)) {
    if (![...names,'PrimusZKTLS'].includes(name)) continue;
    fs.writeFileSync(`artifacts/${name}.json`,JSON.stringify({abi:compiled.abi,bytecode:`0x${compiled.evm.bytecode.object}`,runtime:`0x${compiled.evm.deployedBytecode.object}`,metadata:JSON.parse(compiled.metadata)},null,2)+'\n');
  }
}
console.log(`Compiled with ${solc.version()}`);
