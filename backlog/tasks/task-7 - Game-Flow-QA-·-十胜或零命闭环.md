---
id: TASK-7
title: Game Flow / QA · 十胜或零命闭环
status: Done
assignee:
  - '@run-flow'
created_date: '2026-11-23 00:51'
updated_date: '2026-11-23 01:03'
labels: []
milestone: m-1
dependencies:
  - TASK-4
  - TASK-5
  - TASK-6
modified_files:
  - src/autopets/run.lua
  - scripts/play.lua
  - tests/run.lua
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
准备和战斗需要串成完整单局。

## 任务
实现开局、准备、战斗、结算、下一轮与重开。

## 边界
初始 5 命，达到 10 胜或 0 命结束，结果不能重复结算。

## 验收
目标版本（临时）0.1.0-alpha.0。执行下方命令或实机步骤，并记录证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lua tests/run.lua 打通胜利、失败、重开与同种子回放。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 串接商店、对手、战斗回放和单次结算，隔离各阶段的随机序列。
2. 实现十胜、零命与终局重开，提供纯 Lua 终端可玩入口。
3. 用完整单局验证胜败、重开和确定性回放，再执行终端交互路径。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`lua tests/run.lua` 与 `sh scripts/check.sh` 在 Lua 5.4 下退出码为 0。测试用真实商店、对手及战斗事件对比两次同种子单局，拒绝重复结算与跨阶段指令。
`lua scripts/play.lua 7` 终端指令验证通过。胜局第 11 轮达到 10 胜、余 5 命，第 7 轮平局。只买首个动物的对照局第 5 轮降至 0 命。两条路径均验证终局拒绝重复结算；分别按原种子和新种子重开。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
完成准备、战斗回放、结算、下一轮和终局重开的纯 Lua 单局。终端可完整操作，自动化和实际终端指令验证十胜、零命、平局、重开与确定性回放。
<!-- SECTION:FINAL_SUMMARY:END -->
