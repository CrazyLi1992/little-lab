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
  const help = {
    getConfig: {name:'读取配置',purpose:'查询当前配置，便于修改前记录、修改后对照。',fields:[]},
    setCmdMode: {name:'进入 / 退出指令模式',purpose:'控制 CMD 指令模式。进行需要 CMD 的操作前先发送 on，操作结束后发送 off。',fields:[['cmd_mode','指令模式','字符串','"on" 进入；"off" 退出。']]},
    setRealtimeIntervalTime: {name:'设置实时上报间隔',cmd:true,purpose:'设置实时数据上报之间的间隔，单位为秒。',fields:[['time','上报间隔','整数','常规测试填写 1–60 秒，例如 2。数字不要加引号。']]},
    setNonRealtimeDelayTime: {name:'设置静止确认时间',cmd:true,purpose:'设置非实时上报前的静止确认时长；不是 MQTT 连接超时时间。',fields:[['time','静止确认时长','整数','常规测试填写 1–60 秒，例如 20。数字不要加引号。']]},
    timeSync: {name:'同步时间',purpose:'发送 UTC Unix 秒时间戳，用于时间同步测试。',fields:[['timestamp','UTC 时间戳','整数 / 占位符','填写秒而不是毫秒，例如 1787712000；保留 "$utc" 可在生成报文时取当前时间。自动序列会在执行时取值。']]},
    networkStatus: {name:'模拟网络信息通知',purpose:'构造通信模块的网络信息通知，用于测试 ICCID 与信号值的收发。此操作不会查询真实网络。',fields:[['ICCID','SIM 卡标识','字符串','填写字母或数字组成的字符串，最多 31 字节；保留双引号。示例号码仅为占位，请按测试需要修改。'],['rssi','信号强度','整数','填写信号数值，例如 -75；负数也不加引号。']]},
    mqttStatus: {name:'模拟 MQTT 状态通知',purpose:'构造通信模块的连接状态通知；不控制本网页与 Broker 的连接。',fields:[['connected','连接状态','整数','1 表示已连接，0 表示已断开；不是 true / false。']]},
    bleConnected: {name:'模拟蓝牙连接通知',purpose:'构造 BLE 连接状态通知。本页面通过 MQTT 发送，用于观察该通道收到通知后的回复，不会建立蓝牙连接。',fields:[['connected','蓝牙连接状态','整数','1 表示已连接，0 表示已断开。']]},
    getAngle: {name:'读取角度',cmd:true,purpose:'请求角度数据，接收内容可在收发日志中查看。',fields:[]},
    calibration: {name:'开始 / 结束校准',cmd:true,purpose:'发送校准流程控制指令。',fields:[['cmd','校准动作','字符串','"begin" 开始校准；"end" 结束校准。']]},
    setWakeUpThreshold: {name:'设置运动唤醒阈值',cmd:true,purpose:'设置加速度唤醒阈值与量程。实际阈值 = threshold × range / 64 g；示例 1、2 对应 31.25 mg。',fields:[['threshold','阈值档位','整数','0–63，填写档位值，不直接填写 mg。'],['range','加速度量程','整数','填写 2、4、8 或 16，分别表示 ±2 g、±4 g、±8 g、±16 g。']]},
    confirmInstallation: {name:'确认安装',cmd:true,purpose:'发送安装确认指令。',fields:[['confirmed','确认标记','整数','填写 1 表示确认安装。']]},
    setWakeSchedule: {name:'设置定时唤醒计划',cmd:true,purpose:'选择重试、每周或每月计划。周/月计划的时刻使用 UTC+8；只填写对应策略的字段。',fields:[['policy','计划类型','字符串','"upload_retry" 重试；"weekly" 每周；"monthly" 每月。'],['enabled','计划开关','整数','1 开启；0 关闭。'],['retry_interval_time','重试间隔','整数','仅 upload_retry 使用：大于 0，单位秒，例如 1800。'],['weekday','星期','整数','仅 weekly 使用：1–7，1 为周一，7 为周日。'],['day','每月日期','整数','仅 monthly 使用：1–31，例如 15。'],['hour','小时','整数','weekly / monthly 使用：0–23，UTC+8。'],['minute','分钟','整数','weekly / monthly 使用：0–59。']],examples:{'每周计划':{policy:'weekly',enabled:1,weekday:1,hour:8,minute:0},'每月计划':{policy:'monthly',enabled:1,day:15,hour:8,minute:0},'重试计划':{policy:'upload_retry',enabled:1,retry_interval_time:1800}}},
    set4GFastUpload: {name:'设置 4G 快速上传',cmd:true,purpose:'配置快速上传开关和普通上报确认后的在线保持时长。保持时长不是上传周期。',fields:[['enabled','快速上传开关','整数','1 开启；0 关闭。'],['hold_s','在线保持时长','整数','10–3600 秒；开关关闭时也填写此字段，例如 60。']]},
    setWakeUploadConfig: {name:'设置唤醒上报开关',cmd:true,purpose:'配置唤醒上报功能的开关。',fields:[['enabled','唤醒上报开关','整数','1 开启；0 关闭。']]},
    setBatteryModel: {name:'设置电池型号',cmd:true,purpose:'指定电池型号，填写与测试目标匹配的型号字符串。',fields:[['battery_model','电池型号','字符串','填写 "YC103868"、"JNXX104060" 或 "YWLN18505"，保留大小写。']]},
    getBleMac: {name:'读取蓝牙 MAC 地址',purpose:'请求蓝牙 MAC 地址，回复原文保存在收发日志中。',fields:[]},
    setSn: {name:'设置设备序列号',cmd:true,purpose:'设置新的 SN。报文外层 sn 仍使用连接配置中的当前 SN，params.sn 填新值；本工具不会自动切换连接配置或主题。',fields:[['sn','新序列号','字符串','非空，最多 31 字节；替换示例值。中文字符通常占多个字节。']]}
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
  const api={templates,help,id,command,ack,matches,plan};
  if(typeof module!=='undefined') module.exports=api; else root.HostProtocol=api;
})(globalThis);
