import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeFunctionResult,encodeFunctionData,toFunctionSelector} from 'viem';
import {fixture,principal} from './local.mjs';

const raw=JSON.parse(readFileSync('public/evidence/local-settlement-proof.json'));
const original={...raw,timestamp:BigInt(raw.timestamp)};
const origin=JSON.parse(readFileSync('public/evidence/usgs-proof.json'));
const time=new Date(Number(original.timestamp)-10_000);
const hex=n=>`0x${n.toString(16)}`;
const mutate=(key,value)=>({...original,data:JSON.stringify({...JSON.parse(original.data),[key]:value})});
const revert=async (promise,signature)=>{
  const selector=toFunctionSelector(signature);
  await assert.rejects(promise,error=>String(error.data ?? '').startsWith(selector));
};
test('atomic frozen verifier and authentic contract-bound settlement',async t=>{
  const f=await fixture({time});
  t.after(()=>f.close());
  const verifierCall=(functionName,args=[],from=f.funder)=>f.rpc('eth_call',[{to:f.verifier,from,data:encodeFunctionData({abi:f.verifierAbi,functionName,args})},'latest']);
  const state=async()=>Number(BigInt(await f.call('state')));
  const balance=addr=>f.rpc('eth_getBalance',[addr,'latest']).then(BigInt);
  await t.test('zero owner, pinned verifier and exactly one official signer',async()=>{
    assert.equal(BigInt(await verifierCall('owner')),0n);
    assert.equal(BigInt(await f.call('verifier')),BigInt(f.verifier));
    const data=await verifierCall('_attestors',[0n]);
    const [signer]=decodeFunctionResult({abi:f.verifierAbi,functionName:'_attestors',data});
    assert.equal(signer, '0x5Ed3176045F68617B0958a61ac1868875C98C14d');
    await assert.rejects(verifierCall('_attestors',[1n]));
    await assert.rejects(verifierCall('removeAttestor',[signer]));
    await assert.rejects(verifierCall('setAttestor',[{attestorAddr:f.funder,url:''}]));
    await assert.rejects(verifierCall('initialize',[f.funder,[{attestorAddr:f.funder,url:''}]]));
  });
  await t.test('verifier accepts preserved gate proof', async()=>{
    assert.equal(await verifierCall('verifyAttestation',[{...origin,timestamp:BigInt(origin.timestamp)}]),'0x');
  });
  await t.test('funding is restricted to the precommitted funder and amount',async()=>{
    await revert(f.call('fund',[],{from:f.beneficiary,value:hex(principal)}),'Unauthorized()');
    await revert(f.call('fund',[],{value:hex(principal-1n)}),'WrongDeposit()');
    await revert(f.call('preview',[original]),'WrongState(uint8)');
    const funded=await f.fund();
    assert.equal(await state(),1);
    console.log('Local gas deployment',BigInt(f.receipt.gasUsed).toString(),'funding',BigInt(funded.gasUsed).toString());
  });
  const cases=[
    ['wrong beneficiary',{...original,recipient:f.funder},'WrongRecipient()'],
    ['other escrow / policy context',{...original,additionParams:original.additionParams.replace(':v1:',':v2:')},'WrongContext()'],
    ['stale proof',{...original,timestamp:original.timestamp-1_900_000n},'ProofTimeInvalid()'],
    ['future proof',{...original,timestamp:original.timestamp+1_900_000n},'ProofTimeInvalid()'],
    ['seconds instead of milliseconds',{...original,timestamp:original.timestamp/1000n},'ProofTimeInvalid()'],
    ['wrong request',{...original,request:{...original.request,url:'https://example.com'}},'SourceMismatch()'],
    ['wrong signed conditions',{...original,attConditions:original.attConditions+' '},'RulesMismatch()'],
    ['wrong signed rule',{...original,reponseResolve:original.reponseResolve.slice(1)},'RulesMismatch()'],
    ['extra header',{...original,request:{...original.request,header:'{}'}},'SourceMismatch()'],
    ['duplicate field',{...original,data:original.data.replace('"magnitude":"7.8"','"magnitude":"7.8","magnitude":"7.8"')},'InvalidPayload()'],
    ['missing field',{...original,data:original.data.replace('"status":"reviewed",','')},'InvalidPayload()'],
    ['ambiguous decimal',mutate('latitude','037.2256'),'InvalidPayload()'],
    ['excess fractional precision',mutate('longitude','37.0143001'),'InvalidPayload()'],
    ['wrong event ID',mutate('eventId','different'),'InvalidPayload()'],
    ['below threshold',mutate('magnitude','7.499999'),'MagnitudeBelowThreshold()'],
    ['outside geography',mutate('latitude','38.000001'),'OutsideGeofence()'],
    ['outside event window',mutate('eventTime','1675646249999'),'EventOutsideCoverage()'],
    ['in-policy tampered magnitude',mutate('magnitude','7.9'),'Error(string)'],
    ['inclusive policy boundaries still require signature',{...mutate('magnitude','7.5'),data:mutate('magnitude','7.5').data.replace('"37.2256"','"37"').replace('"37.0143"','"38"')},'Error(string)'],
    ['invalid signature shape',{...original,signatures:['0x']},'SignatureShapeInvalid()'],
    ['invalid signature bytes',{...original,signatures:[original.signatures[0].replace(/^0x../,'0x00')]},'Error(string)'],
  ];
  for (const [name,proof,error] of cases) await t.test(name,()=>revert(f.call('preview',[proof]),error));
  await t.test('authentic gate proof fails escrow recipient policy',()=>revert(f.call('preview',[{...origin,timestamp:BigInt(origin.timestamp)}]),'WrongRecipient()'));
  await t.test('refusing recipient rolls back state and preserves principal',async()=>{
    await f.rpc('evm_setAccountCode',[f.beneficiary,'0x60006000fd']);
    await revert(f.call('settle',[original]),'TransferFailed()');
    assert.equal(await state(),1);
    assert.equal(await balance(f.escrow),principal);
    await f.rpc('evm_setAccountCode',[f.beneficiary,'0x']);
  });
  await t.test('settlement callback cannot reenter with the same proof',async()=>{
    const snapshot=await f.rpc('evm_snapshot');
    try {
      const payload=f.tx('settle',[original]).data.slice(2);
      const size=(payload.length/2).toString(16).padStart(4,'0');
      // Copy embedded calldata and reenter. The receiver reverts if reentry succeeds.
      const tail=`6000600061${size}6000600073${f.escrow.slice(2)}5af1156100005760006000fd5b00`;
      const head=`61${size}610000600039`;
      const jump=((head+tail).length/2-2).toString(16).padStart(4,'0');
      const runtime=`0x${head.replace('610000','61'+((head+tail).length/2).toString(16).padStart(4,'0'))}${tail.replace('610000','61'+jump)}${payload}`;
      await f.rpc('evm_setAccountCode',[f.beneficiary,runtime]);
      await f.send(f.tx('settle',[original]));
      assert.equal(await state(),2);
      assert.equal(await balance(f.escrow),0n);
    } finally {
      await f.rpc('evm_revert',[snapshot]);
    }
  });
  await t.test('valid proof settles exact principal once',async()=>{
    const before=await balance(f.beneficiary);
    await f.call('preview',[original]);
    const receipt=await f.send(f.tx('settle',[original]));
    assert.equal(await balance(f.beneficiary),before+principal);
    assert.equal(await balance(f.escrow),0n);
    assert.equal(await state(),2);
    await revert(f.call('settle',[original]),'WrongState(uint8)');
    console.log('Local gas settle',BigInt(receipt.gasUsed).toString());
  });
});
test('expiry refund is restricted and terminal',async t=>{
  const f=await fixture({time});
  t.after(()=>f.close());
  await f.fund();
  await revert(f.call('refund',[],{from:f.beneficiary}),'Unauthorized()');
  await revert(f.call('refund'),'EscrowStillActive()');
  await f.rpc('evm_increaseTime',[604800]);
  await f.rpc('evm_mine');
  await revert(f.call('settle',[original]),'EscrowExpired()');
  await f.send(f.tx('refund'));
  assert.equal(BigInt(await f.call('state')),3n);
  assert.equal(BigInt(await f.rpc('eth_getBalance',[f.escrow,'latest'])),0n);
  await revert(f.call('refund'),'WrongState(uint8)');
});
