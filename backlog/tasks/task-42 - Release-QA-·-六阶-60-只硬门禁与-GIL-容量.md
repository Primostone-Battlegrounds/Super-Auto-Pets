---
id: TASK-42
title: Release QA · 六阶 60 只硬门禁与 GIL 容量
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-26 05:39'
updated_date: '2026-11-26 05:39'
labels: []
dependencies: []
references:
  - docs/design/RELEASE-POOL.md
  - docs/QA.md
priority: high
type: feature
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design-Version: v2.0.0

首发规模提高为六阶各 10 只可购买动物。当前统一 GIL 是 18 只研发候选。本任务为扩充后的首发封测提供候选计数和原生容量回归。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 统一 GIL 回读的可购买动物按阶记录到 BUILD.json，联机目录与练习一致，独立召唤物和食物不计数。
- [ ] #2 正式成品门禁拒绝缺失计数、18 只、36 只及阶级分布错误的候选，维持 TASK-41 五层证据条件。
- [ ] #3 开场技能元数据支持 60 只可购买动物及独立召唤物的原生容量，保持两种多人模式的技能顺序。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
从 GIL 回读练习池并核对多人商店阶级，新增正式成品数量门禁。拆分开场元数据列并核对原生图、双版本 Lua、实际 Simulator 和独立评审。
<!-- SECTION:PLAN:END -->
