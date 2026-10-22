(() => {
  'use strict';
  const $ = id => document.getElementById('mqtt-' + id);
  const token = Array.from(crypto.getRandomValues(new Uint32Array(3)), n => n.toString(16).padStart(8, '0')).join('');
  const clientId = 'lab_' + token.slice(0, 18);
  $('client-id').textContent = clientId;
  $('sub-topic').value = $('pub-topic').value = 'little-lab/' + token + '/test';
  let client = null, connected = false, subscription = '', busy = false, deadline;
  function feedback(text) { $('feedback').textContent = text; }
  function log(kind, text) {
    const entry = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false }) + ' · ' + kind;
    const content = document.createElement('pre');
    content.textContent = text;
    entry.append(label, content);
    $('log').prepend(entry);
    while ($('log').children.length > 100) $('log').lastElementChild.remove();
  }
  function render() {
    $('connect').disabled = !!client;
    $('disconnect').disabled = !client;
    $('subscribe').disabled = !connected || busy || !!subscription;
    $('unsubscribe').disabled = !connected || busy || !subscription;
    $('publish').disabled = !connected || busy;
    $('sub-topic').disabled = busy || !!subscription;
    $('status').textContent = connected ? '已连接' : client ? '连接中…' : '未连接';
    $('status').dataset.connected = String(connected);
    $('subscription').textContent = subscription ? '已订阅：' + subscription : '尚未订阅';
  }
  function stop(message) {
    const previous = client;
    client = null; connected = false; subscription = ''; busy = false;
    clearTimeout(deadline);
    if (previous) previous.end(true);
    render(); feedback(message); log('状态', message);
  }
  function validTopic(topic, filter) {
    if (!topic || new TextEncoder().encode(topic).length > 1024 || /[\u0000\uD800-\uDFFF]/u.test(topic)) return false;
    if (!filter) return !/[+#]/.test(topic);
    const levels = topic.split('/');
    return levels.every((level, i) => (!level.includes('+') || level === '+') && (!level.includes('#') || (level === '#' && i === levels.length - 1)));
  }
  function operation(run, success) {
    if (!connected || busy) return;
    const current = client;
    busy = true; render();
    deadline = setTimeout(() => { if (client === current) stop('操作超时，已断开。请重新连接后再试。'); }, 15000);
    const done = (error, result) => {
      if (client !== current) return;
      clearTimeout(deadline); busy = false;
      if (error) { feedback('操作失败：' + error.message); log('错误', error.message); }
      else success(result);
      render();
    };
    try { run(current, done); } catch (error) { done(error); }
  }
  $('connect').addEventListener('click', () => {
    if (client) return;
    if (!window.mqtt) { feedback('MQTT 客户端文件未加载，请刷新页面重试。'); return; }
    try {
      const current = window.mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId, protocolVersion: 4, clean: true, reconnectPeriod: 0,
        connectTimeout: 10000, keepalive: 30, queueQoSZero: false, resubscribe: false
      });
      client = current;
      render(); feedback('正在连接 EMQX 公共 Broker…');
      deadline = setTimeout(() => { if (client === current) stop('连接超时。请检查网络是否允许访问 8084 端口，再重试。'); }, 12000);
      current.on('connect', () => {
        if (client !== current) return;
        clearTimeout(deadline); connected = true; render();
        feedback('连接成功。订阅一个主题即可接收消息。'); log('连接', 'broker.emqx.io · MQTT 3.1.1 / WSS');
      });
      current.on('error', error => { if (client === current) stop('连接错误：' + error.message); });
      current.on('close', () => { if (client === current) stop('连接已断开。点击“连接 Broker”可重试。'); });
      current.on('message', (topic, payload, packet) => {
        if (client !== current) return;
        const text = new TextDecoder().decode(payload.subarray(0, 4096));
        log('接收 RX', topic + ' · QoS ' + packet.qos + (packet.retain ? ' · 保留消息' : '') + ' · ' + payload.length + ' bytes\n' + text + (payload.length > 4096 ? '\n[内容已截断]' : ''));
        feedback('收到消息：' + topic);
      });
    } catch (error) { stop('无法创建连接：' + error.message); }
  });
  $('disconnect').addEventListener('click', () => stop('已主动断开，当前订阅已清除。'));
  $('subscribe').addEventListener('click', () => {
    const topic = $('sub-topic').value;
    if (!validTopic(topic, true)) { feedback('订阅主题不能为空，最多 1024 字节；+ 必须独占一层，# 必须独占最后一层。'); return; }
    const qos = Number($('qos').value);
    if (![0, 1].includes(qos)) return;
    operation((c, done) => c.subscribe(topic, { qos }, done), granted => {
      if (!granted?.length || granted.some(item => item.qos >= 128)) { feedback('Broker 拒绝了该主题的订阅。'); log('错误', '订阅被拒绝：' + topic); return; }
      subscription = topic; feedback('订阅成功：' + topic); log('订阅', topic + ' · QoS ' + granted[0].qos);
    });
  });
  $('unsubscribe').addEventListener('click', () => {
    const topic = subscription;
    if (!topic) return;
    operation((c, done) => c.unsubscribe(topic, done), () => { subscription = ''; feedback('已取消订阅：' + topic); log('取消订阅', topic); });
  });
  $('publish').addEventListener('click', () => {
    const topic = $('pub-topic').value, payload = $('payload').value, qos = Number($('qos').value);
    if (!validTopic(topic, false)) { feedback('发布主题不能为空，最多 1024 字节，且不能包含 + 或 #。'); return; }
    const bytes = new TextEncoder().encode(payload);
    if (bytes.length > 16384) { feedback('消息超过 16 KB，请缩短后再发送。'); return; }
    if (![0, 1].includes(qos)) return;
    operation((c, done) => c.publish(topic, payload, { qos, retain: false }, done), () => {
      const result = qos === 1 ? 'Broker 已确认（QoS 1）' : '已发送（QoS 0，不含送达确认）';
      feedback(result); log('发布 TX', topic + ' · ' + result + '\n' + new TextDecoder().decode(bytes.subarray(0, 4096)) + (bytes.length > 4096 ? '\n[内容已截断]' : ''));
    });
  });
  $('clear').addEventListener('click', () => { $('log').replaceChildren(); feedback('日志已清空。'); });
  window.addEventListener('pagehide', () => { if (client) stop('页面已离开，连接已关闭。'); });
  render();
})();
