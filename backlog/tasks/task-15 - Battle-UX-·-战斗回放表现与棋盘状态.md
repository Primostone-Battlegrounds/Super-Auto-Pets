---
id: TASK-15
title: Battle / UX · 战斗回放表现与棋盘状态
status: Done
assignee:
  - '@run-flow'
created_date: '2026-11-23 01:31'
updated_date: '2026-11-23 01:34'
labels: []
milestone: m-1
dependencies:
  - TASK-4
modified_files:
  - src/autopets/battle.lua
  - tests/battle.lua
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
当前千星界面仅能查看战斗日志。

## 任务
为真实战斗事件暴露可重放的原生棋盘状态，覆盖受伤、退场、召唤和结算。

## 边界
继续使用同一规则与结果，阶段、种子和数值保持既有 M1。

## 验收
M1。运行战斗和单局测试，验证回放棋盘的伤害、退场及召唤顺序。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Lua 测试复验回放棋盘与实际战斗结果一致。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 从战斗事件记录初始、状态变动与终局的棋盘快照。
2. 同批退场完成后一次记录稳定的双边阵型，保持已有事件坐标与顺序。
3. 用确定性战斗和单局测试核对伤害、防护、退场、召唤及终局。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`lua tests/battle.lua`、`lua tests/run.lua` 与 `sh scripts/check.sh` 在 Lua 5.4 下退出码为 0。对 603 场确定性战斗逐事件比较基线，确认既有事件字段、顺序和胜负相同。
状态变动添加前至后的双边棋盘。每批同时退场仅在最后一个退场事件记录稳定压缩后的阵型。256 次碰撞的满阵容测试保留 514 帧，每帧最多十个单位。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
完成战斗事件棋盘快照。Lua 测试覆盖伤害和护盾、同步退场、召唤位置、防护和增益、终局阵型与回放可复现性。
<!-- SECTION:FINAL_SUMMARY:END -->
