---
id: TASK-4
title: Core Engine · 确定性五格战斗
status: To Do
assignee: []
created_date: '2026-11-23 00:51'
labels: []
milestone: m-1
dependencies:
  - TASK-1
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
单局需要可重复的自动战斗。

## 任务
实现纯 Lua RNG、事件队列、攻击、伤害、死亡、召唤。

## 边界
纯 Lua 与千星 API 分离。

## 验收
目标版本（临时）0.1.0-alpha.0。执行下方命令或实机步骤，并记录证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lua tests/battle.lua 覆盖同种子一致、触发顺序及死亡召唤。
<!-- AC:END -->
