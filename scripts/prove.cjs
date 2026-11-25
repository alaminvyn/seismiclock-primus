'use strict';
const fs = require('node:fs');
const path = require('node:path');
const publicProof = require('../public/evidence/usgs-proof.json');
const [escrow, recipient, destination] = process.argv.slice(2);
if (![escrow,recipient].every(x => /^0x[0-9a-fA-F]{40}$/.test(x ?? '')) || !destination) {
  throw Error('Usage: node scripts/prove.cjs ESCROW BENEFICIARY OUTPUT');
}
const sdkModule = process.env.SEISMIC_SDK_PATH || '@primuslabs/zktls-core-sdk';
const {PrimusCoreTLS} = require(sdkModule);
async function main() {
  const credentials = process.env.SEISMIC_PRIMUS_CREDENTIALS ?
    JSON.parse(fs.readFileSync(process.env.SEISMIC_PRIMUS_CREDENTIALS,'utf8')) :
    {appId:process.env.PRIMUS_APP_ID,secret:process.env.PRIMUS_APP_SECRET};
  if (!credentials.appId || !credentials.secret) throw Error('Primus credentials are missing');
  const sdk = new PrimusCoreTLS();
  await sdk.init(credentials.appId, credentials.secret, 'wasm');
  const scope = `seismiclock:v1:84532:${escrow.toLowerCase()}:us6000jllz`;
  const request = sdk.generateRequestParams(
    {url:publicProof.request.url,method:'GET',header:{},body:''},
    publicProof.reponseResolve.map(rule=>({...rule,parseType:'json'})), recipient);
  request.setAttMode({algorithmType:'proxytls',resultType:'plain'});
  request.setAdditionParams(JSON.stringify({scope}));
  const proof = await sdk.startAttestation(request, 85000);
  if (!sdk.verifyAttestation(proof) ||
      proof.additionParams !== JSON.stringify({algorithmType:'proxytls',scope}) ||
      proof.recipient.toLowerCase() !== recipient.toLowerCase() ||
      JSON.parse(proof.data).eventId !== 'us6000jllz') throw Error('Proof signature or binding check failed');
  fs.writeFileSync(path.resolve(destination),JSON.stringify(proof,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log('Genuine contract-bound USGS attestation generated');
}
main().then(()=>process.exit(0),error=>{
  console.error('Proof generation failed',error.name,error.code??'');
  process.exit(1);
});
