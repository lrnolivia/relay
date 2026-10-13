import test from 'node:test';
import assert from 'node:assert/strict';
import {readCompiledRecoveryArchive,providerRecoveryConfiguration,compatibleRecoveryConfiguration,recoveryConfigurationDigest} from './compiled-recovery.js';
import {recoveryArchiveFixture,recoveryVersionFixture,recoverySourceConfiguration,zipRecoveryFiles,fixtureSource} from '../test/fixtures/recovery-archive.mjs';

test('bounded runtime ZIP validates every restored digest and compiled runtime contract',()=>{
 const f=recoveryArchiveFixture(),result=readCompiledRecoveryArchive(f.archive,fixtureSource,f.receipt);
 assert.equal(result.files.length,5);assert.equal(result.module.toString(),f.files[1][1]);
 assert.throws(()=>readCompiledRecoveryArchive(f.archive,'b'.repeat(40),f.receipt),/receipt identity/);
 const bad=structuredClone(f.receipt);bad.files[0].sha256='f'.repeat(64);assert.throws(()=>readCompiledRecoveryArchive(f.archive,fixtureSource,bad),/digest mismatch/);
});
test('ZIP links, duplicate paths, excess output, unsupported flags and hidden bytes are rejected',()=>{
 const f=recoveryArchiveFixture(),start=f.archive.readUInt32LE(f.archive.length-6);
 for(const mutate of [b=>b.writeUInt16LE(1,start+8),b=>b.writeUInt32LE(0o120777*65536,start+38),b=>b.writeUInt32LE(17*1024*1024,start+24),b=>b.writeUInt32LE(1,start+42),b=>b.writeUInt16LE(1,b.length-2)]){
  const raw=Buffer.from(f.archive);mutate(raw);assert.throws(()=>readCompiledRecoveryArchive(raw,fixtureSource,f.receipt));
 }
 assert.throws(()=>readCompiledRecoveryArchive(zipRecoveryFiles([...f.files.slice(0,4),f.files[0]]),fixtureSource,f.receipt),/duplicate entry/);
 const raw=Buffer.from(f.archive);raw[40]^=0xff;assert.throws(()=>readCompiledRecoveryArchive(raw,fixtureSource,f.receipt));
});
test('provider configuration excludes secret values and pins each inherited binding to an exact version',()=>{
 const old=providerRecoveryConfiguration(recoveryVersionFixture()),next=providerRecoveryConfiguration(recoveryVersionFixture('66666666-7777-8888-9999-aaaaaaaaaaaa'));
 const metadata=compatibleRecoveryConfiguration(old,next,recoverySourceConfiguration());
 assert.ok(metadata.bindings.every(x=>x.type==='inherit'&&x.version_id===next.version_id));assert.doesNotMatch(JSON.stringify(old),/Bearer/);
 const secret=recoveryVersionFixture();secret.resources.bindings[2].text='synthetic-secret';assert.throws(()=>providerRecoveryConfiguration(secret),/unsupported provider binding/);
 for(const mutate of [v=>v.resources.bindings[1].namespace_id='b'.repeat(32),v=>v.resources.bindings[0].bucket_name='different',v=>v.resources.bindings[3].text='disabled',v=>v.resources.script_runtime.migration_tag='new-schema']){
  const changed=recoveryVersionFixture();mutate(changed);assert.throws(()=>compatibleRecoveryConfiguration(old,providerRecoveryConfiguration(changed),recoverySourceConfiguration()),/bindings or durable schema/);
 }
 assert.equal(recoveryConfigurationDigest(old),recoveryConfigurationDigest(structuredClone(old)));
});
