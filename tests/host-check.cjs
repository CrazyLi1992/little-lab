const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=fs.existsSync(path.join(__dirname,'../host.js'))?'../':'../dist/';
const P=require(base+'host-protocol.js');
assert(P.id().length<=23);assert.notEqual(P.id(),P.id());
assert.equal(typeof P.command('timeSync',{timestamp:'$utc'},'test').params.timestamp,'number');
const post={action:'post',id:'001',sn:'test',params:{report_type:'non_realtime'}};
assert.deepEqual(P.ack(post),{action:'postResponse',id:'001',sn:'test',params:{status:'ok',report_type:'non_realtime'}});
assert(!P.matches({action:'getConfigResponse',id:'1',sn:'other'},{action:'getConfig',id:'1',sn:'test'}));
for(const plan of ['{}','[]','[{"type":"send","action":"x","typo":1}]','[{"type":"delay","ms":-1}]','[{"type":"send","raw":"x","waitReply":true}]'])assert.throws(()=>P.plan(plan));
class Element{
 constructor(){this.value='';this.textContent='';this.children=[];this.checked=false;}
 append(...x){this.children.push(...x)} replaceChildren(){this.children=[]} add(option){this.children.push(option);if(this.children.length===1)this.value=option.value}
 click(){if(!this.disabled)return this.onclick?.()}
}
const elements={};const el=id=>elements[id]??=new Element();
for(const [k,v] of Object.entries({sn:'test',up:'isolated/up',down:'isolated/down','ack-status':'ok','ack-delay':'0',preset:'read'}))el(k).value=v;
let current,seq=0;const timers=new Map(),published=[];
const fake=()=>({events:{},on(k,fn){this.events[k]=fn},emit(k,...a){this.events[k]?.(...a)},end(){this.emit('close')},subscribe(t,o,cb){cb(null,[{qos:1}])},publish(t,raw,o,cb){published.push({t,raw,o,cb})}});
vm.runInNewContext(fs.readFileSync(path.join(__dirname,base,'host.js'),'utf8'),{HostProtocol:P,document:{getElementById:el,createElement:()=>new Element()},Option:function(text,value){this.text=text;this.value=value},mqtt:{connect(){return current=fake()}},crypto:require('node:crypto').webcrypto,TextEncoder,AbortController,localStorage:{getItem(){return null},setItem(){}},addEventListener(){},setTimeout(fn,ms){timers.set(++seq,{fn,ms});return seq},clearTimeout(id){timers.delete(id)},console});
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const receive=(message,retain=false)=>current.emit('message','isolated/up',{toString:()=>JSON.stringify(message)},{retain});
(async()=>{
 assert(el('send').disabled);el('connect').click();current.emit('connect');assert(!el('send').disabled);assert.equal(published.length,0);
 receive(post);assert.equal(published.length,0);
 el('auto-ack').checked=true;receive({...post,sn:'other'});receive(post,true);assert.equal([...timers.values()].filter(t=>t.ms===0).length,0);
 receive(post);const ackEntry=[...timers.entries()].find(([,t])=>t.ms===0);assert(ackEntry);timers.delete(ackEntry[0]);ackEntry[1].fn();assert.equal(JSON.parse(published.at(-1).raw).id,'001');assert.equal(published.at(-1).o.retain,false);published.at(-1).cb(null);
 el('plan').value=JSON.stringify([{type:'send',action:'getConfig',waitReply:true},{type:'checkpoint',message:'pause'}]);el('run').click();const sent=published.at(-1);receive({...JSON.parse(sent.raw),action:'getConfigResponse'});sent.cb(null);await flush();assert(el('progress').textContent==='pause');el('resume').click();await flush();assert(!el('run').disabled);
 el('plan').value=JSON.stringify([{type:'send',action:'getConfig',waitReply:true},{type:'send',action:'never'}]);el('run').click();const n=published.length;el('stop').click();await flush();assert(!el('run').disabled);assert.equal(published.length,n);published.at(-1).cb(null);await flush();assert.equal(published.length,n);
 receive(post);el('disconnect').click();assert.equal(timers.size,0);assert(el('send').disabled);
 console.log('Passed: protocol/plan validation, exact reply correlation, early reply, ACK scope/retained, checkpoint/resume, immediate stop, disconnect cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
