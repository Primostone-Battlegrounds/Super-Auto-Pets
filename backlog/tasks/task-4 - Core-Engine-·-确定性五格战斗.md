---
id: TASK-4
title: Core Engine · 确定性五格战斗
status: Done
assignee:
  - '@rules-core'
created_date: '2026-11-23 00:51'
updated_date: '2026-11-23 00:59'
labels: []
milestone: m-1
dependencies:
  - TASK-1
modified_files:
  - src/autopets/battle.lua
  - tests/battle.lua
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
- [x] #1 lua tests/battle.lua 覆盖同种子一致、触发顺序及死亡召唤。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 验证并复制五格阵容，使用独立种子决定同序事件的先后。
2. 排队处理开场效果、前排对撞、伤害、阵亡与召唤，返回结构化回放事件。
3. 覆盖固定种子、伤亡顺序、容量和入参不变，运行项目检查。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
前排对撞先提交双方攻击，再批量结算伤亡后执行阵亡技能。开场同位与伤亡顺序由种子决定，非战斗成长状态由入参保留。256 次对撞后仍有双方存活时判平，回放结尾注明原因。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
实现五格阵容战斗与可重复事件回放，验证同种子、开场与阵亡触发排序、同时死亡、满格召唤、阵容不变及三种结果。lua tests/battle.lua、sh scripts/check.sh 和 Git 空白检查均通过。
<!-- SECTION:FINAL_SUMMARY:END -->
