---
id: TASK-28
title: P1 · 共用商店、回合与战斗实例契约
status: In Progress
assignee:
  - '@P1'
created_date: '2026-11-23 04:31'
labels: []
milestone: m-2
dependencies:
  - TASK-4
  - TASK-5
documentation:
  - docs/design/REASONS-v1.md
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
让商店与战斗为玩家和本地训练提供同一个合法回合入口。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 非法命令保持状态与 RNG，合法回合按一次收轮、一次真实战斗结算及一次开轮完成。
- [ ] #2 同种实例 UID 独立，战斗临时属性保持于战斗快照。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
接入共享命令与结算凭据，按现有场景复验两种 Lua 版本。
<!-- SECTION:PLAN:END -->
