# 千星战斗节点样本

`m3-collision-probe.gil` 在关卡图中保持四组独立对战的状态。关卡启动后，每个定时器回调处理一组的一次碰撞，下一组从独立状态继续。每次碰撞使用双方已承诺的攻击。双方扣除护盾和生命后才判断胜负，四组结算后终止定时器。

生成器解析项目 `battle.lua` 中 `damage` 的 Lua 语法树，将同一段扣盾、扣血运算和引擎碰撞上限写入节点图。现有生产战斗代码无需改动。四组各使用两个项目原创动物，护盾来自 Lua 战斗开场后的状态。该样本用于对照碰撞、状态推进和定时成本。完整 M3 仍需接入编队、技能时序、退场、召唤和回放。

## 构建与复验

准备工具需要联网。已安装工具的隔离构建无需官方客户端。可通过 `LUA54` 指定 Lua 5.4 可执行文件。

```sh
sh platform/setup-tools.sh /tmp/m3-collision-mcp
MILIASTRA_ALLOW_LIVE_WRITE=0 node tests/native/verify-m3-collision.mjs \
  /tmp/m3-collision-mcp /tmp/m3-native-validation lua5.3 /tmp/m3-collision-probe
cd /tmp/m3-collision-probe
sha256sum -c SHA256SUMS
```

Lua 5.3 和 5.4 运行共享战斗代码，分别导出同一组参考轨迹。离线模拟复用写入 GIL 前的图源码，逐击核对双方剩余生命、护盾、伤害和最终结果，验证重复时钟事件与停止行为。另以高血量对照碰撞上限。GIL 读回核对关卡图挂载和静态节点数。证据文件保留固定夹具、时间步、参考轨迹、产物哈希和实测状态。源码里的方法调用计数用于相邻构建比较，官方节点引擎成本另测。

## 官方客户端实测

1. 在授权的隔离存档中导入候选并启动单人试玩。启用 `_GSTS_AP_CollisionProbe` 的服务器日志。记录当前客户端版本、设备和 GIL 校验值。
2. 从 `AUTO_PETS_COLLISION_PROBE start` 开始记录。无需按键，观察日志按组轮转，已经结束的组不再输出。每条 `pair_strike` 后依次为组号、组内碰撞序号、左方生命/护盾/伤害、右方生命/护盾/伤害。对照 `evidence.json` 的 `parity.baseline.pairs` 中各组成对的 `steps`。
3. `pair_outcome` 后依次为组号和结果，1 为左胜，2 为右胜，3 为同归于尽，4 为达到碰撞上限。最后一个结果后只应出现一次 `done`。记录从 `start` 到 `done` 的实际时间和期间的服务器负载。将实测与离线模拟记录分别归档。
