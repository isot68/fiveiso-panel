import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import * as crypto from 'node:crypto';
import vm from 'node:vm';
const code=readFileSync(process.env.FIVEISO_BOOTSTRAP_FILE || new URL('../resource-packaging/server.js',import.meta.url),'utf8');
function runtime() {
 const key=crypto.randomBytes(32),iv=crypto.randomBytes(12), packageId='test-package';
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(packageId));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({serverJs:[{code:'exports("featureLoaded", () => true);'}],serverLua:[],clientLua:[],nui:''})),cipher.final()]);
 const payload=Buffer.concat([Buffer.from('FISO1'),iv,cipher.getAuthTag(),encrypted]).toString('base64');
 const calls=[], events=[], timers=[], requests=[], handlers={};let time=0;
 const files={'license.json':JSON.stringify({origin:'https://panel.example.test',serverId:'server',packageId,token:'t'.repeat(64)}),'runtime.fiso':payload};
 const context={Buffer,URL,console:{log(){},error(){}},Date:{now:()=>time},
  GetCurrentResourceName:()=> 'fiveiso',GetResourcePath:()=>'/resources/fiveiso',GetConvar:(_,fallback)=>fallback,
  SetConvar:(...a)=>calls.push(['convar',...a]),LoadResourceFile:(_,name)=>files[name],
  StopResource:()=>calls.push(['stop']),exports:(...a)=>calls.push(['export',...a]),emit:(...a)=>events.push(a),on:(event,fn)=>handlers[event]=fn,
  setImmediate:fn=>fn(),setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval:()=>{},
  require:name=>name==='node:crypto'?crypto:name==='node:os'?{hostname:()=> 'host'}:name==='node:https'?{
   request:(url,options,callback)=>{const req=new EventEmitter();req.end=body=>requests.push({url,options,body,callback});req.destroy=()=>req.emit('error',Error());return req;},
  }:null,
 };
 context.global=context;vm.runInNewContext(code,context);
 return {calls,events,files,requests,timers,key:key.toString('base64'),packageId,advance:value=>{time=value;timers.forEach(fn=>fn());},reply(status,body){const r=new EventEmitter();r.statusCode=status;r.destroy=()=>{};requests.at(-1).callback(r);r.emit('data',JSON.stringify(body));r.emit('end');}};
}
test('protected bootstrap does not load code before panel grants a key; loads once and stops after revocation',()=>{
 const r=runtime();assert.equal(r.calls.length,0);
 assert.match(r.requests[0].options.headers['X-FiveISO-Instance'],/^[a-f0-9]{64}$/);
 r.reply(200,{ok:true,packageId:r.packageId,key:r.key,leaseSeconds:90});
 assert.equal(r.calls.filter(x=>x[0]==='export').length,1);
 assert.equal(r.events.filter(x=>x[0]==='fiveiso:license:load').length,1);
 r.advance(30000);r.reply(200,{ok:true,packageId:r.packageId,key:r.key,leaseSeconds:90});
 assert.equal(r.calls.filter(x=>x[0]==='export').length,1);
 r.advance(60000);r.reply(403,{});assert.equal(r.calls.filter(x=>x[0]==='stop').length,1);
});
test('invalid key, false approval and startup outage never execute feature code',()=>{
 for(const mode of ['key','approval','outage']) {
  const r=runtime();
  if(mode==='outage')r.advance(90000);
  else r.reply(200,{ok:mode!=='approval',packageId:r.packageId,key:Buffer.alloc(32).toString('base64'),leaseSeconds:90});
  assert.equal(r.calls.filter(x=>x[0]==='export').length,0);
  assert.equal(r.calls.filter(x=>x[0]==='stop').length,1);
 }
});
