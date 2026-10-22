(function (root) {
  'use strict';
  const templates = {
    getConfig: {}, setCmdMode: {cmd_mode:'on'}, setRealtimeIntervalTime:{time:2},
    setNonRealtimeDelayTime:{time:20}, timeSync:{timestamp:'$utc'},
    networkStatus:{ICCID:'89860000000000000000',rssi:-75}, mqttStatus:{connected:1},
    bleConnected:{connected:1}, getAngle:{}, calibration:{cmd:'begin'},
    setWakeUpThreshold:{threshold:1,range:2}, confirmInstallation:{confirmed:1},
    setWakeSchedule:{policy:'weekly',enabled:1,weekday:1,hour:8,minute:0},
    set4GFastUpload:{enabled:1,hold_s:10}, setWakeUploadConfig:{enabled:1},
    setBatteryModel:{battery_model:'YC103868'}, getBleMac:{}, setSn:{sn:'SV02000000000000000000'}
  };
  let counter=0;
  const id=()=>Date.now().toString(36)+'-'+(++counter).toString(36);
  function resolve(value) {
    if(value==='$utc') return Math.floor(Date.now()/1000);
    if(Array.isArray(value)) return value.map(resolve);
    if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v)]));
    return value;
  }
  function command(action,params,sn,messageId=id()) {return {action,id:messageId,sn,params:resolve(params)};}
  function ack(post,status='ok') {
    if(!post || post.action!=='post' || typeof post.id!=='string' || typeof post.sn!=='string') throw Error('请选择有效 post 报文');
    const params={status};
    if(typeof post.params?.report_type==='string') params.report_type=post.params.report_type;
    return {action:'postResponse',id:post.id,sn:post.sn,params};
  }
  const matches=(reply,sent)=>reply?.action===sent.action+'Response' && reply.id===sent.id && reply.sn===sent.sn;
  function plan(text) {
    const steps=JSON.parse(text);
    if(!Array.isArray(steps)||!steps.length||steps.length>500) throw Error('序列需包含 1–500 个步骤');
    for(const s of steps) {
      if(!s || !['send','delay','checkpoint','waitPost'].includes(s.type)) throw Error('步骤 type 必须为 send / delay / checkpoint / waitPost');
      const allowed={send:['type','action','params','id','raw','waitReply','timeoutMs','onTimeout'],delay:['type','ms'],checkpoint:['type','message'],waitPost:['type','timeoutMs','onTimeout']}[s.type];
      if(Object.keys(s).some(k=>!allowed.includes(k)))throw Error('步骤含未知字段');
      if(s.message!==undefined&&typeof s.message!=='string')throw Error('message 必须是字符串');
      if(s.raw!==undefined&&typeof s.raw!=='string')throw Error('raw 必须是字符串');
      if(s.type==='send' && !(typeof s.raw==='string' || typeof s.action==='string' && s.action.length)) throw Error('send 需 action 或 raw');
      if(s.id!==undefined && typeof s.id!=='string') throw Error('id 必须是字符串');
      if(s.type==='send' && s.waitReply && s.raw!==undefined) throw Error('raw 步骤不支持 waitReply');
      if(s.waitReply!==undefined && typeof s.waitReply!=='boolean') throw Error('waitReply 必须为布尔值');
      if(s.onTimeout!==undefined && !['continue','stop'].includes(s.onTimeout)) throw Error('onTimeout 必须为 continue 或 stop');
      for(const k of ['ms','timeoutMs']) if(s[k]!==undefined && (!Number.isInteger(s[k])||s[k]<0||s[k]>3600000)) throw Error(k+' 必须是 0–3600000 的整数');
      if(s.type==='delay' && s.ms===undefined) throw Error('delay 需 ms');
    }
    return steps;
  }
  const api={templates,id,command,ack,matches,plan};
  if(typeof module!=='undefined') module.exports=api; else root.HostProtocol=api;
})(globalThis);
