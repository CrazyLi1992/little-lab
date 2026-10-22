const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {webcrypto}=require('node:crypto');
class Element {
 constructor(){this.value='';this.textContent='';this.children=[];this.events={};this.dataset={};}
 addEventListener(k,fn){this.events[k]=fn} append(...x){this.children.push(...x)} prepend(x){x.parent=this;this.children.unshift(x)}
 get lastElementChild(){return this.children.at(-1)} remove(){this.parent.children.pop()} replaceChildren(){this.children=[]}
 click(){if(!this.disabled)this.events.click()}
}
const ids=['client-id','sub-topic','pub-topic','payload','qos','connect','disconnect','subscribe','unsubscribe','publish','status','subscription','feedback','log','clear'];
const el=Object.fromEntries(ids.map(x=>[x,new Element()]));el.qos.value='0';el.payload.value='test';
const timers=new Map();let seq=0,current,call;
function fakeClient(){return {events:{},on(k,fn){this.events[k]=fn},emit(k,...a){this.events[k]?.(...a)},end(){this.ended=true;this.emit('close')},subscribe(t,o,cb){call={kind:'sub',t,o,cb}},unsubscribe(t,cb){call={kind:'unsub',t,cb}},publish(t,p,o,cb){call={kind:'pub',t,p,o,cb}}};}
const window={events:{},addEventListener(k,f){this.events[k]=f},mqtt:{connect(url,options){assert.equal(url,'wss://broker.emqx.io:8084/mqtt');assert.equal(options.reconnectPeriod,0);current=fakeClient();return current}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../mqtt-tool.js'),'utf8'),{window,document:{getElementById:id=>el[id.slice(5)],createElement:()=>new Element()},crypto:webcrypto,Uint32Array,TextEncoder,TextDecoder,Date,setTimeout:fn=>{timers.set(++seq,fn);return seq},clearTimeout:id=>timers.delete(id)});
assert.equal(el['sub-topic'].value,el['pub-topic'].value);assert(el.publish.disabled);
el.connect.click();const first=current;assert(el.connect.disabled);current.emit('connect');assert(!el.publish.disabled);
el['sub-topic'].value='wrong/#/level';el.subscribe.click();assert.equal(call,undefined);
el['sub-topic'].value='lab/+/test';el.subscribe.click();call.cb(null,[{qos:128}]);assert(!el.subscribe.disabled);
el.subscribe.click();call.cb(null,[{qos:0}]);assert(el.subscribe.disabled);assert(el['sub-topic'].disabled);
el['pub-topic'].value='lab/+';call=undefined;el.publish.click();assert.equal(call,undefined);
el['pub-topic'].value='lab/test';el.payload.value='中'.repeat(6000);el.publish.click();assert.equal(call,undefined);
el.payload.value='<img src=x onerror=alert(1)>';el.qos.value='1';el.publish.click();assert.equal(call.o.retain,false);assert(el.publish.disabled);call.cb(null);assert(!el.publish.disabled);assert(el.feedback.textContent.includes('已确认'));
el.payload.value='中'.repeat(4000);el.publish.click();call.cb(null);assert(el.log.children[0].children[1].textContent.includes('截断'));assert(el.log.children[0].children[1].textContent.length<1600);
current.emit('message','lab/test',new TextEncoder().encode('<b>safe</b>'),{qos:1,retain:false});assert(el.log.children[0].children[1].textContent.includes('<b>safe</b>'));
for(let i=0;i<110;i++)current.emit('message','lab/test',new Uint8Array(5000),{qos:0});assert.equal(el.log.children.length,100);assert(el.log.children[0].children[1].textContent.includes('截断'));
el.unsubscribe.click();call.cb(null);assert(!el['sub-topic'].disabled);
el.publish.click();const late=call.cb;el.disconnect.click();assert(current.ended);assert(el.publish.disabled);late(null);assert(el.feedback.textContent.includes('主动断开'));
el.connect.click();current.emit('connect');first.emit('close');assert.equal(el.status.textContent,'已连接');
el.publish.click();[...timers.values()].at(-1)();assert.equal(el.status.textContent,'未连接');assert(current.ended);
el.connect.click();[...timers.values()].at(-1)();assert(el.feedback.textContent.includes('连接超时'));
el.connect.click();current.emit('error',new Error('network'));assert(el.feedback.textContent.includes('network'));
el.clear.click();assert.equal(el.log.children.length,0);
console.log('Passed: MQTT state/validation/rejection/ACK/timeout/stale callbacks/log limits and safe text rendering.');
