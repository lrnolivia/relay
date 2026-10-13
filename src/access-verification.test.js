import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createAccessVerifier} from './access-verification.js';

test('shared authentication preserves fixed Relay issuer/audience, signature, expiry and bounded key cache',async()=>{
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),kid='shared-access-fixture';let now=Date.now(),reads=0;
 const claims={iss:'https://loewfi.cloudflareaccess.com',aud:['7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819'],exp:Math.floor(now/1000)+1000};
 const token=(changes={},header={})=>{const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),payload=encode({alg:'RS256',kid,...header})+'.'+encode({...claims,...changes});return payload+'.'+sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64url');};
 const request=jwt=>new Request('https://relay.loew.fi/recovery-control',{headers:jwt?{'cf-access-jwt-assertion':jwt}:{}});
 const verify=createAccessVerifier({clock:()=>now,requestKeys:async(url,options)=>{reads++;assert.equal(url,'https://loewfi.cloudflareaccess.com/cdn-cgi/access/certs');assert.equal(options.redirect,'manual');return Response.json({keys:[{...publicKey.export({format:'jwk'}),kid}]});}});
 assert.equal(await verify(request()),null);const jwt=token();assert.equal((await verify(request(jwt))).token,jwt);assert.equal((await verify(request(jwt))).claims.iss,claims.iss);assert.equal(reads,1);
 for(const changes of [{iss:'https://untrusted.example'},{aud:['another-app']},{exp:now/1000-1},{nbf:now/1000+100}])assert.equal(await verify(request(token(changes))),null);
 assert.equal(await verify(request(token({}, {alg:'none'}))),null);assert.equal(await verify(request(token({}, {kid:'unknown'}))),null);
 const invalid=jwt.split('.');invalid[2]=Buffer.alloc(256).toString('base64url');assert.equal(await verify(request(invalid.join('.'))),null);
 now+=300001;assert.ok(await verify(request(jwt)));assert.equal(reads,2);
 const redirected=createAccessVerifier({requestKeys:async()=>new Response(null,{status:302,headers:{Location:'https://untrusted.example'}})});assert.equal(await redirected(request(jwt)),null);
});
