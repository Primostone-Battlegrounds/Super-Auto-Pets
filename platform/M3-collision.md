# 千星战斗节点样本

`m3-collision-probe.gil` 在关卡图中保持四组独立对战的状态，每方最多五个单位。关卡启动后，每个定时器回调处理一组的一次碰撞，下一组从独立状态继续。双方先结算已承诺的攻击，移除全部倒下的单位，再按先手顺序处理前排成长和召唤。四组结算后终止定时器。

生成器解析项目 `battle.lua` 的 Lua 语法树，将扣盾、扣血、前排成长、召唤数量与攻击力以及碰撞上限写入节点图。召唤物和技能参数由共用目录导出。阵容、护盾和先手来自 Lua 战斗开场后的状态。后续完整 M3 集成仍需由原生图执行开场技能和随机目标选择，并接入经营、配对、战斗回放及结算。

## 构建与复验

准备工具需要联网。已安装工具的隔离构建无需官方客户端。可通过 `LUA54` 指定 Lua 5.4 可执行文件。

```sh
sh platform/setup-tools.sh /tmp/m3-collision-mcp
MILIASTRA_ALLOW_LIVE_WRITE=0 node tests/native/verify-m3-collision.mjs \
  /tmp/m3-collision-mcp /tmp/m3-native-validation lua5.3 /tmp/m3-collision-probe
cd /tmp/m3-collision-probe
sha256sum -c SHA256SUMS
```

Lua 5.3 和 5.4 运行共享战斗代码，分别导出同一组参考轨迹。离线模拟复用写入 GIL 前的图源码，逐击核对攻击、伤害、护盾、倒下、成长、召唤顺序和压缩后阵容，验证重复时钟事件与停止行为。另以高血量对照碰撞上限。GIL 读回核对关卡图挂载和静态节点数。证据文件保留固定夹具、时间步、参考轨迹、产物哈希和实测状态。原生整数采用文档规定的 32 位范围。源码里的方法调用计数用于相邻构建比较，官方节点引擎成本另测。[整数数据类型说明](https://github.com/FurinyaWorks/genshin-miliastra-mcp/blob/59c576e41632a6bf6781bbca83a676d0da0374ec/knowledge/official/guide/mhk23ora1wom.md)

## 官方客户端实测

1. 在授权的隔离存档中导入候选并启动单人试玩。启用 `_GSTS_AP_CollisionProbe` 的服务器日志。记录当前客户端版本、设备和 GIL 校验值。
2. 从 `AUTO_PETS_COLLISION_PROBE start` 开始记录。无需按键，日志按组轮转。每条 `strike` 后依次为组号和碰撞序号，接着记录 `damage`（阵营、伤害、剩余生命、护盾）、`faint`（阵营、动物编号）、`buff`（阵营、成长量）和 `summon`（阵营、召唤物编号、攻击、生命）。对照 `evidence.json` 的 `parity.baseline.pairs` 中各组的 `steps.events`。阵营 0 为左方，1 为右方。动物编号见 `parity.baseline.catalog`，离线各步阵容见 `steps.board`。
3. `outcome` 后依次为组号和结果，1 为左胜，2 为右胜，3 为同归于尽，4 为达到碰撞上限。最后一个结果后只应出现一次 `done`。记录从 `start` 到 `done` 的实际时间和期间的服务器负载。将实测与离线模拟记录分别归档。
