(() => {
  'use strict';
  const $=id=>document.getElementById(id), P=HostProtocol;
  let client=null, ready=false, config=null, logs=[], posts=[], lastSent='', active=null;
  const ackTimers=new Set(), listeners=new Set();
  const feedback=text=>$('feedback').textContent=text;
  function record(direction,topic,raw){
    logs.unshift({time:new Date().toISOString(),direction,topic,raw});
    logs=logs.slice(0,500); renderLogs();
  }
  function renderLogs(){
    const term=$('filter').value.toLowerCase(); $('log').replaceChildren();
    for(const row of logs.filter(r=>JSON.stringify(r).toLowerCase().includes(term))){
      const li=document.createElement('li'), title=document.createElement('strong'), pre=document.createElement('pre');
      title.textContent=row.time+' · '+row.direction+' · '+row.topic; pre.textContent=row.raw;
      li.append(title,pre); $('log').append(li);
    }
  }
  function event(text){record('事件','',text);feedback(text);}
  function cancelAcks(){for(const t of ackTimers)clearTimeout(t);ackTimers.clear();}
  function controls(){
    $('connect').disabled=!!client; $('disconnect').disabled=!client;
    for(const id of ['sn','up','down','topic','adopt']) $(id).disabled=!!client;
    for(const id of ['send','resend','ack-send']) $(id).disabled=!ready;
    $('run').disabled=!ready||!!active;
    $('pause').disabled=!active||active.paused; $('resume').disabled=!active?.paused; $('stop').disabled=!active;
    $('plan').disabled=!!active; $('load').disabled=!!active; $('import').disabled=!!active;
    $('connection').textContent=ready?'Broker 已连接 / 已订阅':client?'连接中…':'未连接';
    $('connection').dataset.connected=String(ready);
  }
  function stop(){if(active){active.controller.abort();active.resume?.();}}
  function disconnect(reason='已断开'){
    stop();cancelAcks();const old=client;client=null;ready=false;old?.end(true);controls();event(reason);
  }
  function validTopic(value){return value.length>0 && new TextEncoder().encode(value).length<=1024 && !/[+#\u0000]/.test(value);}
  $('topic').onclick=()=>$('down').value='/rst/sv01/set_test2/'+$('sn').value.trim();
  try{const saved=JSON.parse(localStorage.getItem('little-lab-host')||'null');if(saved)for(const k of ['sn','up','down'])if(typeof saved[k]==='string')$(k).value=saved[k];}catch{}
  $('connect').onclick=()=>{
    config=Object.fromEntries(['sn','up','down'].map(k=>[k,$(k).value.trim()]));
    if(!config.sn||!validTopic(config.up)||!validTopic(config.down)){feedback('填写 SN 和不含通配符的完整主题');return;}
    try{
      const c=mqtt.connect('wss://broker.emqx.io:8084/mqtt',{clientId:'host_'+crypto.randomUUID().replaceAll('-','').slice(0,18),clean:true,reconnectPeriod:0,connectTimeout:15000,keepalive:30});
      client=c;controls();
      const deadline=setTimeout(()=>{if(client===c&&!ready)disconnect('连接或订阅超时');},20000);
      c.on('connect',()=>c.subscribe(config.up,{qos:1},(err,granted)=>{
        if(client!==c)return;clearTimeout(deadline);
        if(err||!granted?.length||granted.some(g=>g.qos===128)){disconnect('订阅未完成：'+(err?.message||'Broker 拒绝'));return;}
        ready=true;controls();try{localStorage.setItem('little-lab-host',JSON.stringify(config));}catch{}
        event('已订阅 '+config.up+'；不会自动发送设备指令');
      }));
      c.on('message',(topic,bytes,packet)=>{if(client===c)receive(topic,bytes.toString(),packet);});
      c.on('error',err=>{if(client===c)disconnect('连接错误：'+err.message);});
      c.on('close',()=>{clearTimeout(deadline);if(client===c)disconnect('Broker 连接已关闭');});
    }catch(err){disconnect(err.message);}
  };
  $('disconnect').onclick=()=>disconnect();
  function publish(raw,signal){
    if(signal?.aborted)return Promise.reject(Error('已停止'));
    if(!ready||!client) return Promise.reject(Error('请先连接并完成订阅'));
    if(typeof raw!=='string'||!raw.length)return Promise.reject(Error('报文不能为空'));
    if(new TextEncoder().encode(raw).length>65536)return Promise.reject(Error('单条报文上限 64 KiB'));
    const c=client, topic=config.down;
    record('发送请求',topic,raw);
    return new Promise((resolve,reject)=>{
      let done=false;
      const finish=err=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',aborted);err?reject(err):resolve();};
      const aborted=()=>finish(Error('已停止；已发报文无法撤回'));
      const timer=setTimeout(()=>finish(Error('Broker 发布确认超时（报文可能已送达）')),10000);
      signal?.addEventListener('abort',aborted,{once:true});
      try{c.publish(topic,raw,{qos:1,retain:false},err=>{if(done)return;if(!err)record('Broker 确认',topic,'QoS 1 发布确认；不代表设备回复');finish(err);});}catch(err){finish(err);}
    });
  }
  function receive(topic,raw,packet){
    record(packet.retain?'接收 retained':'接收',topic,raw);
    let msg;try{msg=JSON.parse(raw);}catch{return;}
    if(msg?.sn===config.sn)$('last').textContent='当前 SN 最近收到消息：'+new Date().toLocaleString()+' · '+String(msg.action||'');
    if(!packet.retain)for(const listener of [...listeners])listener(msg);
    if(msg?.action!=='post'||typeof msg.id!=='string'||typeof msg.sn!=='string')return;
    const selected=posts[Number($('posts').value)];
    posts.unshift(msg);posts=posts.slice(0,50);renderPosts(selected);
    if($('auto-ack').checked&&!packet.retain&&msg.sn===config.sn){
      const delay=Number($('ack-delay').value);
      if(!Number.isInteger(delay)||delay<0||delay>600000){event('自动 ACK 延时需为 0–600000 毫秒');return;}
      const rawAck=JSON.stringify(P.ack(msg,$('ack-status').value));
      const session=client;
      const timer=setTimeout(()=>{ackTimers.delete(timer);if(client===session&&ready&&$('auto-ack').checked)publish(rawAck).catch(e=>event(e.message));},delay);ackTimers.add(timer);
    }
  }
  function renderPosts(selected){
    $('posts').replaceChildren();posts.forEach((p,i)=>$('posts').add(new Option(p.sn+' / '+p.id+' / '+(p.params?.report_type||''),String(i))));
    const found=posts.indexOf(selected);$('posts').value=String(found<0?0:found);showPost();
  }
  function showPost(){$('post-view').textContent=JSON.stringify(posts[Number($('posts').value)]||{},null,2);}
  function selectedPost(){const p=posts[Number($('posts').value)];if(!p)throw Error('尚无可选 post');return p;}
  $('posts').onchange=showPost;
  for(const id of ['auto-ack','ack-delay','ack-status'])$(id).onchange=cancelAcks;
  $('adopt').onclick=()=>guard(()=>{$('sn').value=selectedPost().sn;$('topic').click();generate();});
  $('ack-edit').onclick=()=>guard(()=>{$('payload').value=JSON.stringify(P.ack(selectedPost(),$('ack-status').value));bytes();});
  $('ack-send').onclick=()=>guard(()=>{const post=selectedPost();if(post.sn!==config.sn)throw Error('所选上报 SN 与连接配置不同；可断开后采用该 SN，或在编辑器构造报文');return publish(JSON.stringify(P.ack(post,$('ack-status').value)));});
  async function guard(fn){try{await fn();}catch(err){event(err.message);}}
  for(const name of Object.keys(P.templates))$('action').add(new Option(P.help[name].name+' · '+name,name));
  function template(){
    const action=$('action').value, help=P.help[action];
    $('command-purpose').textContent=help.purpose;
    $('command-mode').textContent=help.cmd?'操作顺序：先选择“进入 / 退出指令模式”发送 on，再发送本指令；结束后发送 off。':'可直接构造本指令；是否收到回复请查看日志。';
    $('parameter-help').replaceChildren();
    if(!help.fields.length){const term=document.createElement('dt'),text=document.createElement('dd');term.textContent='无需参数';text.textContent='保留空对象 {}，不要填写空字符串或删除 params。';$('parameter-help').append(term,text);}
    for(const [key,name,type,description] of help.fields){
      const row=document.createElement('div'), label=document.createElement('dt'), text=document.createElement('dd');
      label.textContent=name+' · '+key+'（'+type+'）';text.textContent=description;row.append(label,text);$('parameter-help').append(row);
    }
    $('parameter-examples').replaceChildren();
    for(const [name,params] of Object.entries(help.examples||{'默认示例':P.templates[action]})){
      const button=document.createElement('button');button.type='button';button.textContent='填入'+name;
      button.onclick=()=>guard(()=>{$('params').value=JSON.stringify(params,null,2);generate();feedback('已填入'+name+'并生成新报文，尚未发送');});
      $('parameter-examples').append(button);
    }
    $('params').value=JSON.stringify(P.templates[action],null,2);generate();
  }
  function generate(){$('payload').value=JSON.stringify(P.command($('action').value,JSON.parse($('params').value),$('sn').value.trim()));bytes();}
  function bytes(){const n=new TextEncoder().encode($('payload').value).length;$('bytes').textContent=n+' 字节'+(n>383?' · 超过常规 383 字节报文范围；仍允许发送以测试边界':'');}
  $('action').onchange=()=>guard(template);$('generate').onclick=()=>guard(generate);
  $('payload').oninput=bytes;$('compact').onclick=()=>guard(()=>{$('payload').value=JSON.stringify(JSON.parse($('payload').value));bytes();});
  $('send').onclick=()=>guard(()=>{lastSent=$('payload').value;return publish(lastSent);});
  $('resend').onclick=()=>guard(()=>publish(lastSent));
  const send=(action,params={})=>({type:'send',action,params,waitReply:true,timeoutMs:10000,onTimeout:'continue'});
  const presets={
    read:[send('getConfig')],
    config:[send('setCmdMode',{cmd_mode:'on'}),send('setRealtimeIntervalTime',{time:2}),send('setNonRealtimeDelayTime',{time:20}),send('getConfig'),send('setCmdMode',{cmd_mode:'off'})],
    duplicate:[send('setCmdMode',{cmd_mode:'on'}),send('setRealtimeIntervalTime',{time:2}),{...send('setRealtimeIntervalTime',{time:2}),id:'$last'},send('setCmdMode',{cmd_mode:'off'})],
    boundary:[send('setCmdMode',{cmd_mode:'on'}),...[0,61,'5',1.5].map(time=>send('setRealtimeIntervalTime',{time})),send('unknownAction'),{type:'send',raw:'{"action":"getConfig","params":{}}'},send('setCmdMode',{cmd_mode:'off'})],
    clock:[send('timeSync',{timestamp:'$utc'}),send('timeSync',{timestamp:946684799}),send('timeSync',{timestamp:4102444800})],
    persist:[send('setCmdMode',{cmd_mode:'on'}),send('setRealtimeIntervalTime',{time:3}),send('getConfig'),send('setCmdMode',{cmd_mode:'off'}),{type:'checkpoint',message:'请自行重启设备并等待可通信后，点击继续读取配置。'},send('getConfig')],
    window:[{type:'waitPost',timeoutMs:60000},{type:'checkpoint',message:'需要时手动 ACK，或先启用自动 ACK，然后继续。'},{type:'delay',ms:11000},send('getConfig')]
  };
  $('load').onclick=()=>$('plan').value=JSON.stringify(presets[$('preset').value],null,2);
  function waitFor(predicate,ms,signal){
    let cleanup;
    const promise=new Promise((resolve,reject)=>{
      const finish=(value,err)=>{cleanup();err?reject(err):resolve(value);};
      const listener=msg=>{if(predicate(msg))finish('收到回复');};
      const aborted=()=>finish(null,Error('已停止'));
      const timer=setTimeout(()=>finish('等待超时'),ms);
      cleanup=()=>{clearTimeout(timer);listeners.delete(listener);signal.removeEventListener('abort',aborted);};
      listeners.add(listener);signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted();
    });
    promise.catch(()=>{});return {promise,cancel:()=>cleanup()};
  }
  function delay(ms,signal){return new Promise((resolve,reject)=>{
    const abort=()=>{clearTimeout(t);reject(Error('已停止'));};
    const t=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  });}
  async function checkpoint(run,message){
    if(run.controller.signal.aborted)throw Error('已停止');
    run.paused=true;$('progress').textContent=message;controls();
    await new Promise(resolve=>run.resume=resolve);run.resume=null;run.paused=false;controls();
    if(run.controller.signal.aborted)throw Error('已停止');
  }
  $('run').onclick=()=>guard(async()=>{
    const steps=P.plan($('plan').value), run={controller:new AbortController(),paused:false,pauseRequested:false};active=run;controls();
    const signal=run.controller.signal;let lastId;
    try{
      for(let i=0;i<steps.length;i++){
        if(signal.aborted)throw Error('已停止');
        if(run.pauseRequested){run.pauseRequested=false;await checkpoint(run,'序列已暂停，点击继续');}
        const s=steps[i];$('progress').textContent=`步骤 ${i+1} / ${steps.length} · ${s.type}`;
        if(s.type==='checkpoint')await checkpoint(run,s.message||'人工检查点：点击继续');
        else if(s.type==='delay')await delay(s.ms,signal);
        else {
          let pending=null;
          try{
            if(s.type==='waitPost')pending=waitFor(m=>m?.action==='post'&&m.sn===config.sn,s.timeoutMs??60000,signal);
            else {
              if(s.id==='$last'&&!lastId)throw Error('$last 之前没有指令 ID');
              const msg=P.command(s.action,s.params??{},config.sn,s.id==='$last'?lastId:s.id);
              if(s.raw===undefined)lastId=msg.id;
              if(s.waitReply)pending=waitFor(m=>P.matches(m,msg),s.timeoutMs??10000,signal);
              await publish(s.raw??JSON.stringify(msg),signal);
            }
            if(pending){const result=await pending.promise;event(`步骤 ${i+1}：${result}`);if(result==='等待超时'&&s.onTimeout!=='continue')throw Error('等待超时，序列已停止');}
          }finally{pending?.cancel();}
        }
      }
      if(signal.aborted)throw Error('已停止');event('序列执行结束');$('progress').textContent='序列执行结束（未评定测试结果）';
    }catch(err){$('progress').textContent=err.message;throw err;}finally{active=null;controls();}
  });
  $('pause').onclick=()=>{if(active){active.pauseRequested=true;$('progress').textContent='将在当前步骤结束后暂停';}};
  $('resume').onclick=()=>active?.resume?.();$('stop').onclick=()=>{stop();cancelAcks();event('已请求停止；已发出的报文无法撤回');};
  function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('export-plan').onclick=()=>guard(()=>download('host-sequence.json',P.plan($('plan').value)));
  $('export-log').onclick=()=>download('host-log.json',[...logs].reverse());
  $('import').onclick=()=>$('file').click();$('file').onchange=()=>guard(async()=>{const f=$('file').files[0];if(!f)return;if(f.size>1048576)throw Error('序列文件需小于 1 MiB');const text=await f.text();P.plan(text);$('plan').value=text;$('file').value='';});
  $('clear').onclick=()=>{logs=[];renderLogs();};$('filter').oninput=renderLogs;
  addEventListener('pagehide',()=>{stop();cancelAcks();client?.end(true);});
  template();$('load').click();controls();
})();
