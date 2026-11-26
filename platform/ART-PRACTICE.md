# 三种模式统一动物美术样板

将包内的 `super-auto-pets.gil` 导入获授权的隔离关卡。主菜单提供单人练习、好友 1v1 和八人吃鸡。使用 `sha256sum -c SHA256SUMS` 核对候选和证据。

乌龟、兔子和猫咪使用分别绑定到自身动物 ID 的拟合肖像。雨燕、麝和独角鲸沿用各自的研发技能及肖像。样板采用现有 18 只动物的研发规则，动物与食物使用通俗名称。完整首发仍要求每阶 10 只。

三种玩法共用原生肖像槽。样板的高精度部分从控件模板按需创建。商店、站位和回放保留各模式的正常入口。核对商店与战斗中的名称、技能、攻血、队伍双方朝向及退回大厅后的表现。

## 构建和复验

```sh
MILIASTRA_ALLOW_LIVE_WRITE=0 node tests/native/verify-game.mjs \
  <MCP-checkout> <scratch> lua5.3 <new-package> --art-preview
SIMULATOR_REQUIRE_TEXT=1 node --use-env-proxy scripts/simulator-verify.mjs \
  <MCP-checkout> <Simulator-checkout> <new-package>/super-auto-pets.gil <new-evidence>
```

原生图回读与双版本 Lua 核对多人权威流程。实际 Simulator 从同一 GIL 执行三个模式的客户端。多人客户端使用明确标识的消息夹具。官方 PC、手机、账号房间与设备性能另行记录。此隔离美术样板和完整首发候选均沿用 TASK-41 的五层证据要求。
