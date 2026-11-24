# 千星多人公共状态

好友 1v1 与八席淘汰赛共用原生状态面板。双人视图显示席位、回合、准备状态、对手、生命、暂离和胜负。八席视图显示真人、机器人、存活数、轮空、淘汰、退出和最终名次。每局的私有商店和战斗回放仍由各自的对局界面管理。

`platform/multiplayer_standings.lua` 将权威 Lua 宿主快照转换为展示字段，只读取人数、阶段、席位和公开对局结果。控件忽略旧版本，值相同的控件跳过写入。布局和色板复用单人界面的原生图元，八席侧栏 32 个控件，双人侧栏 14 个，无新交互命中区。

## 隔离复验

先按对应里程碑验证命令生成 M2 与 M3 样本包。在隔离副本挂载共用状态面板。双人使用商店上方的状态栏，八席使用右侧席位列表。读回校验原有关卡图字节和控件 ID。

```sh
MILIASTRA_ALLOW_LIVE_WRITE=0 node tests/native/verify-multiplayer-standings.mjs \
  /tmp/auto-pets-miliastra-mcp /tmp/auto-pets-native-validation lua5.3 duel \
  /tmp/m2-duel-probe /tmp/duel-standings-probe
MILIASTRA_ALLOW_LIVE_WRITE=0 node tests/native/verify-multiplayer-standings.mjs \
  /tmp/auto-pets-miliastra-mcp /tmp/auto-pets-native-validation lua5.3 room \
  /tmp/m3-eight-seat-probe /tmp/room-standings-probe
cd /tmp/duel-standings-probe
sha256sum -c SHA256SUMS
cd /tmp/room-standings-probe
sha256sum -c SHA256SUMS
```

双人状态栏接收 `AP_DuelSnapshot`，在完整候选显示经营、生命、战斗、暂离与终局。早期两轮样本使用同一个读取接口及当时的结束文字。六阶候选使用其独立包目录作为输入。八席调度样本接收 `AP_EightProbeView`，显示人数、机器人任务计数和真人暂离。界面启动后按 GIL 读回的信号签名发送只读请求，取得当前快照。八席宿主的生命、轮空与终局排名另有权威 Lua 回归。

## 官方客户端待验

导入授权的隔离副本，分别通过双人候选和八席调度样本的原生入口试玩。记录同一候选包的 SHA-256、客户端版本、画面和原有样本日志。核对 PC、手机均能看清状态栏、点到原有按钮，首次进入和重入后从对应快照恢复。双人完整候选打到终局并检查状态栏和已有界面的回合、生命和结果一致。八席调度样本观察单人七机器人全部完成四批任务。完整对局的排名和房间入口执行相应里程碑的验收清单。
