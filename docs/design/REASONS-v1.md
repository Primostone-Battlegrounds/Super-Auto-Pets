# 小动物自走棋 REASONS v1

基线为实时 `develop` 的 `124163b098a677e6a24911166a47711d03c82de6`。任务状态由 Backlog 管理。本文冻结本次可实施的公共契约。

## R · 要求

保留纯 Lua 和千星原生 Lua/GIL 运行链。单人 PvE 采用五格、每轮 10 金、十胜或五负结束。AI 必须经共享规则提交合法行动并可重算完整训练历史。商店、菜单继续、确认放弃、战斗回放和结算均纳入输入回归。附件的 Turtle 研究候选保留完整覆盖分母及缺证状态，本次运行使用已有的 M1 兼容目录。Steam 官方材料为同类可读性和反馈参照，现有项目设计与原创素材继续使用。

## E · 实体

- `data` 持有目录和 `rules_hash`。候选记录目录哈希、引擎源码提交和 GIL 哈希。
- `shop` 持有金币、货架、冻结、奖励、持久队伍、上场结果、商店 RNG 和回合阶段。
- 商店内 `unit.id` 指模板，`unit.uid` 是当前商店会话内递增且唯一的正整数。站位前至后；合成保留目标 UID。已有 `xp` 字段表示累计经验。
- `battle` 持有临时状态、独立 RNG、同一场内可区分实例的 UID 和事件。旧场景输入可省略 UID。阵列序号用于当前站位。
- `bot` 持有训练池和各自商店，只向规则入口发送命令。表现层持有选中、拖动、菜单和回放光标。

## A · 公共入口

```lua
shop.new(seed) --> store -- 已开启第 1 轮，空队
store:apply(command) --> true | nil, error_code
store:snapshot() --> state -- 现有字段 + rng_state, phase, last_outcome
store:finish_turn() --> front_first_team | nil, error_code
battle.resolve(player, enemy, seed) --> result -- 现有字段 + seed, rng_state
store:record_battle(result, side) --> true | nil, error_code
store:advance_round() --> true | nil, error_code
bot.new_pool(seed, requested_style) --> pool
bot.advance_to_round(pool, round, budget) --> ready_boolean
bot.snapshot(pool) --> opponent -- round, tier, style, team
bot.trace(pool) --> trace
bot.replay(trace) --> opponent | nil, error_code
bot.generate(round, seed, requested_style) --> opponent
```

`command.action` 及字段：

| 命令 | 字段 |
| --- | --- |
| buy | offer，target 可省略以追加，reward 可省略 |
| combine | offer，target，reward 可省略 |
| sell | target |
| move、merge | from，to |
| feed | offer，target |
| freeze | kind（pet 或 food），offer，frozen 可省略以切换 |
| reroll | 无 |

购买、合成、售出、重排、喂食、冻结与刷新在准备阶段可用。沿用小写错误码。非法操作保持整个状态与 RNG。收轮生成独立战前快照，结算接受实际 `battle.resolve` 结果和 `player` 或 `enemy` 一侧。训练两侧共用结算，战斗临时值不得回写。准备、收轮、结算、下一轮各只执行一次。玩家入口保留 `run:shop_action(name, ...)` 及既有快照字段。

训练池至少两场独立商店会话。所有会话先完成同轮准备，随后冻结战前快照并实际交战。预算对推进步骤设上限，下一次调用可继续。轨迹含规则哈希、策略版本、初始种子、合法商店命令、收轮、战斗双方输入和种子、结果与状态/RNG 核对值。重放从零队伍重算商店与战斗并拒绝篡改。由赛前快照选择同轮玩家对手，选取独立于玩家指令。

## S · 文件所有权

| 角色 | 负责文件 |
| --- | --- |
| P0 | 工程文档、覆盖表、Backlog、接口协调、集成 |
| P1 | `src/autopets/{data,shop,battle,run}.lua` 和对应领域测试 |
| P2 | `src/autopets/bot.lua`、AI 回放与压力入口、`tests/bot.lua` |
| P3 | `src/autopets/art.lua`、`platform/{m1-ui.mjs,m1_ui.lua}`、表现测试 |
| P4 | `platform/m1-bundle.mjs`、`tests/native/`、原生验证、候选包与验收文档 |

依赖方向为平台 → run → bot/shop/battle，bot → shop/battle，shop 和 battle 只依赖通用领域模块。策略与 UI 只读目录、快照和事件。

## O · 集成验收

源码用 Lua 5.4 与 5.3 分别执行。隔离构建 GIL，读回脚本与布局，再用 Lua 5.3 模拟输入。对照纯 Lua 与读回回放摘要，分别检查 PC 和手机画布。独立评审实际 diff、执行验证并查看该提交生成的画面。修复后复审受影响的路径。

## N · 证据

研究目录固定标识为 `sap-turtle-grounded-2026-03-16`。它对应附件带日期的社区历史宠物资料，Steam 构建号、同版食物效果和复杂交互金样仍缺。覆盖状态分别列实现、来源与验收，已知成员和待核闭包均保留。源码、离线原生、PC 官方客户端和手机官方客户端各记录结果。

## S · 约束

UI 只播放确定战斗事件。暂停、快进、跳过和重播不得改变战果；结算只提交一次。无设备记录时，设备验收保持待验。工具操作限隔离候选，正式存档、发布和 Owner 桌面需要单独授权。
