# 上位机测试台

入口：`host.html`，或首页 MQTT 卡片中的“打开上位机测试台”。

1. 填写 SN、订阅上报主题、发布指令完整主题。默认上报为 `/rst/sv01/post_test2`，默认下行为 `/rst/sv01/set_test2/<SN>`；可直接改完整主题。点击连接并订阅后配置锁定，断开可修改。
2. 选择指令、编辑参数 JSON、生成报文并发送。原始编辑器允许异常 JSON 和字段类型，以便测试异常输入。“原样重发”使用最后一次手动发送的完整报文。
3. 收到 post 后可选中查看、生成 ACK 到编辑器或直接回复。自动 ACK 默认关闭，仅处理当前 SN 的非 retained post。延时单位毫秒。
4. 选择或导入序列 JSON，检查步骤后点击运行。可在当前步骤结束后暂停、继续或立即停止。停止不能撤回已发布的消息，也不会自动发送退出 CMD 指令。
5. 日志保留最近 500 条，可筛选并导出。配置保存在本浏览器；消息和编辑中的序列仅保留在页面内存，需主动导出。

## 序列

```json
[
  {"type":"send","action":"getConfig","params":{},"waitReply":true,"timeoutMs":10000,"onTimeout":"stop"},
  {"type":"delay","ms":1000},
  {"type":"checkpoint","message":"完成手工操作后点击继续"},
  {"type":"waitPost","timeoutMs":60000,"onTimeout":"continue"}
]
```

`send` 的 `id` 省略时自动生成；`$last` 复用上一指令 ID。参数中的 `$utc` 替换为执行时的 UTC 秒。`raw` 字符串直接发送原始内容，不与 `waitReply` 合用。回复按 action、id、SN 关联，不判定 status。内置序列超时后继续，使用者可改为 stop。只有在订阅就绪后才允许运行。

AI 使用同样的可见页面操作：连接、编辑步骤 JSON、运行、处理检查点、导出日志。不需要页面脚本调用。后台浏览器计时可能延后，不能用于精密定时；关闭或刷新页面会停止序列。

通信使用 `wss://broker.emqx.io:8084/mqtt`，与 `broker.emqx.io:1883` 共享消息。公共服务不保证消息保密或交付。网页的 Broker 连接状态不代表设备在线。操作记录只表明工具执行及消息到达，不生成测试通过/失败判断。

检查：`node tests/host-check.cjs`；测试使用假 MQTT 客户端，不连接设备。
