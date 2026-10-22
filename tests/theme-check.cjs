const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,fs.existsSync(path.join(__dirname,'../host.html'))?'..':'../dist');
for(const page of ['index.html','host.html']) {
  const html=fs.readFileSync(path.join(base,page),'utf8');
  assert.match(html,/<script[^>]*src="theme\.js[^\"]*"/,page+' must load shared theme behavior');
}
const source=fs.readFileSync(path.join(base,'theme.js'),'utf8');
function boot(value='"dark"',blocked=false){
  const handlers={},root={dataset:{}},meta={},button={setAttribute(k,v){this[k]=v},addEventListener(k,fn){handlers[k]=fn}};
  vm.runInNewContext(source,{document:{documentElement:root,querySelector:()=>meta,getElementById:()=>button,addEventListener(k,fn){handlers[k]=fn}},localStorage:{getItem(){if(blocked)throw Error('blocked');return value},setItem(k,v){if(blocked)throw Error('blocked');value=v}},addEventListener(k,fn){handlers[k]=fn}});
  handlers.DOMContentLoaded?.();return {root,meta,button,handlers,value:()=>value};
}
const page=boot();assert.equal(page.root.dataset.theme,'dark');assert.equal(page.meta.content,'#09090b');
page.handlers.storage({key:'little-lab:theme',newValue:'"light"'});assert.equal(page.root.dataset.theme,'light');
page.handlers.click();assert.equal(page.root.dataset.theme,'dark');assert.equal(page.value(),'"dark"');
page.handlers.storage({key:'unrelated',newValue:'"light"'});assert.equal(page.root.dataset.theme,'dark');
page.handlers.storage({key:null,newValue:null});assert.equal(page.root.dataset.theme,'light');
assert.equal(boot('garbage').root.dataset.theme,'light');
const blocked=boot(null,true);blocked.handlers.click();assert.equal(blocked.root.dataset.theme,'dark');
console.log('Passed: both page integrations, saved theme, cross-tab changes, toggle persistence, clear/invalid/blocked storage.');
