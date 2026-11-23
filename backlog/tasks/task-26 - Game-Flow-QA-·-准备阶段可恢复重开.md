---
id: TASK-26
title: Game Flow / QA · 准备阶段可恢复重开
status: In Progress
assignee:
  - '@FurinyaDev'
created_date: '2026-11-23 03:19'
updated_date: '2026-11-23 03:19'
labels: []
milestone: m-1
dependencies:
  - TASK-7
  - TASK-19
priority: high
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
空队将金币刷到低于 3，或卖掉最后一员后，可能没有购买或开始战斗的合法路径。

## 任务
在准备中提供可发现的重开和确认。目标 M1 0.1.0-alpha.0。

## 边界
终局与生命周期的其余流程保持可复验。

## 验收
验证八次刷新和最后一个队员被出售的准备状态能恢复，正常点击不会误丢进度。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 源码测试与隔离 GIL 均从空阵低金并被禁止开战的状态恢复为满额开局。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
允许准备阶段明确重开，同时保留战斗和结算的阶段边界。游戏界面明确确认，并验证陷入低金状态后的恢复。
<!-- SECTION:PLAN:END -->
