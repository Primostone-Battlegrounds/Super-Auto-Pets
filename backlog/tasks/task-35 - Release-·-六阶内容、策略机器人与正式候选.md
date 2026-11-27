---
id: TASK-35
title: Release · 六阶内容、策略机器人与正式候选
status: In Progress
assignee:
  - '@codex-native'
created_date: '2026-11-23 08:53'
updated_date: '2026-11-27 03:39'
labels:
  - v0.6.0
milestone: m-4
dependencies: []
references:
  - docs/PRODUCT.md
type: feature
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design-Version: v2.0.0

维护 v0.6.0 已批准的六阶动物和食物，按八人对局证据修正阻断可玩性的数值与美术。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 六阶目录和技能回归通过。固定种子对照表明策略机器人优于随机购物，并保留多种可行构筑。
- [ ] #2 1v1 与 8 人正式候选通过双端性能、匹配、同步和断线恢复验收。
- [ ] #3 已批准动物、食物和生成物通过六阶目录、商店、战斗和美术离线复验，候选正式构建与范围清单一致。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 实现并回归同一六阶首发目录、共享商店与技能时序。
2. 接入双人、八席和练习，在固定种子下验证策略、难度和终局。
3. 验证隔离 GIL，分别记录源码、读回和官方双端证据。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
现有三阶练习目录的 AI 基线已在种子 1–128 上对照合法随机购物。双方共用起始店铺种子，每轮交换席位，各策略 3072 场。三种策略得分率为 89.4%、87.6%、88.9%，第 12 轮共 137 种阵容组合。复验命令为 lua5.4 scripts/audit-balance.lua versus-random 128。六阶目录、强度梯度和多人运行仍待验。

入门与标准档共用商店合法动作。128 个配对种子、三种流派的换边对战中，标准对入门得分率 82.2%–85.9%。入门对合法随机购物得分率 64.2%–71.2%，第 12 轮共 80 组阵容。Lua 5.3/5.4 输出一致。难度当前由规则 API 选择，六阶与客户端入口待验。

六阶首发目录已在源码验证。原创 18 只动物、12 种食物、5 种生成物使用同一商店和战斗引擎。Lua 5.3/5.4 的 tests/release_content.lua 核查 64 个种子的货架、各阶奖励、全部新增动物三个等级与触发时序。兼容练习的领域回放 SHA-256 维持 f54e2e7b4dbecf2cef49d327c9fabd6ce0fb923159ba2a4fb60235ab8726ba97。六阶 1v1 源码候选按 6 个种子复跑回合、双视角回放和终局。正式候选、策略大样本和官方双端验收继续跟踪。参见 docs/design/RELEASE-POOL.md。

六阶源码及策略验收已通过 PR #25 和 #26 的独立评审与 Project checks。每个 Lua 运行 73,728 场，输出 SHA-256 783b7caf846a0fe58319713379a8582588feed36dbf058affed214e81c8d097a。标准对随机得分率 89.1%–91.5%，入门对随机为 65.9%–72.6%，标准档第 12 轮 768 个阵容中有 653 种。双人和八席 Lua 宿主可选择相同目录，终端六阶练习亦可复验。正式多人原生接入及官方验收继续跟踪。

原双端三模式候选验收保留为历史。本版内容与八席对局可并行开发，集成后一起复验。
<!-- SECTION:NOTES:END -->
