---
id: TASK-40
title: Platform · 修复正式 GIL 服务端列表超限
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-25 14:58'
updated_date: '2026-11-25 15:06'
labels: []
dependencies: []
priority: high
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
千星奇域拒绝正式六阶 GIL，服务端节点图 1073741827 的阵亡元数据占 115 项，超过平台 100 项限制。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 正式 GIL 所有服务端图的列表默认值和列表参数通过 100 项门禁，运行时列表容量经过审计
- [ ] #2 双人及八人共用阵亡元数据，规则、Lua 与原生战斗回归以及正式产物读回通过
- [ ] #3 develop 和 release 集成修复，Game delivery 提供正式 GIL，官方试玩状态明确记录
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 读回 release CD 产物并审计列表参数与运行时容量。
2. 共享 SoA 阵亡元数据和读取方式，接入双人及八人。
3. 让现有构建验证执行 GIL 门禁和容量边界测试。
4. 跑规则与原生验证，独立评审后集成双分支并验证 CD 产物。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
原 release CD 45570940374 的 GIL 读回见到 1073741827 fainting、1073741829 petEffects 各 115 项。运行时容量审计覆盖 72 项八席状态表、66 项战斗板、22 项开场状态、每侧最多 21 项退场队列、最多 8 项的席位及配对列表，以及最多 31 项的阵容回放。商店表含临时插入的保守上限为 92，已在构建门禁中从现行规则计算，双人和八席模拟同时检查实际列表操作。官方客户端试玩待验证。
<!-- SECTION:NOTES:END -->
