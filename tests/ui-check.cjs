const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() { this.attrs={}; this.events={}; this.style={}; this.classes=new Set(); this.classList={add:x=>this.classes.add(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)}; }
  setAttribute(k,v){this.attrs[k]=v} getAttribute(k){return this.attrs[k]} removeAttribute(k){delete this.attrs[k]}
  addEventListener(k,fn){this.events[k]=fn} contains(x){return this===x} append(x){this.child=x} focus(){this.focused=true}
}
const ids=Object.fromEntries(['tool-nav','updates','close-updates','motion-toggle'].map(x=>[x,new Element()]));
const header=new Element(),track=new Element(),summary=new Element(),root=new Element();
const links=['#focus','#todo','#random','#text'].map(hash=>Object.assign(new Element(),{hash}));
ids['tool-nav'].querySelectorAll=()=>links; ids.updates.querySelector=()=>summary;
const events={},media=new Element(),location={hash:'#todo'};
const document={documentElement:root,getElementById:id=>ids[id],createElement:()=>new Element(),querySelector:s=>s==='.header-right'?header:track,addEventListener:(k,fn)=>events[k]=fn};
const windowEvents={};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,require('node:fs').existsSync(require('node:path').join(__dirname,'../ui.js'))?'../ui.js':'../dist/ui.js'),'utf8'),{document,location,matchMedia:()=>media,addEventListener:(k,fn)=>windowEvents[k]=fn});
const menu=header.child;
assert.equal(links[1].attrs['aria-current'],'location');
menu.events.click(); assert.equal(menu.attrs['aria-expanded'],'true');
events.keydown({key:'Escape'}); assert.equal(menu.attrs['aria-expanded'],'false'); assert(menu.focused);
menu.events.click(); events.click({target:new Element()}); assert.equal(menu.attrs['aria-expanded'],'false');
menu.events.click(); media.events.change(); assert.equal(menu.attrs['aria-expanded'],'false');
location.hash='#top'; windowEvents.hashchange(); assert(links.every(x=>!x.attrs['aria-current']));
ids.updates.open=true; events.keydown({key:'Escape'}); assert.equal(ids.updates.open,false); assert(summary.focused);
ids.updates.open=true; ids['close-updates'].events.click(); assert.equal(ids.updates.open,false);
ids['motion-toggle'].events.click(); assert.equal(track.style.animationPlayState,'paused');
ids['motion-toggle'].events.click(); assert.equal(track.style.animationPlayState,'running');
delete ids['motion-toggle'];
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,require('node:fs').existsSync(require('node:path').join(__dirname,'../ui.js'))?'../ui.js':'../dist/ui.js'),'utf8'),{document,location,matchMedia:()=>media,addEventListener:(k,fn)=>windowEvents[k]=fn});
assert(root.classes.has('ui-ready'));
console.log('Passed: host without marquee;  menu/Escape/outside click/breakpoint, current nav, update panel close, marquee toggle.');
