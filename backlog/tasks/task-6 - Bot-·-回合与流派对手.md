---
id: TASK-6
title: Bot · 回合与流派对手
status: Done
assignee:
  - '@run-flow'
created_date: '2026-11-23 00:51'
updated_date: '2026-11-23 00:59'
labels: []
milestone: m-1
dependencies:
  - TASK-1
modified_files:
  - src/autopets/bot.lua
  - tests/bot.lua
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
单人局需要可复现的合法 AI 队伍。

## 任务
按回合、种子和流派生成阵容，形成可测试的强度曲线。

## 边界
每队最多五格，单位来自本项目的原创数据。

## 验收
目标版本（临时）0.1.0-alpha.0。执行下方命令或实机步骤，并记录证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lua tests/bot.lua 验证回放、阵容合法和强度样本。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 从已解锁动物按回合和种子抽取对手，形成三种风格。
2. 按回合提升阵容规模、增益和等级，并按流派排位。
3. 验证可重放、目录合规和跨样本强度曲线。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`lua tests/bot.lua` 和 `sh scripts/check.sh` 在 Lua 5.4 下退出码为 0。
对三类流派分别抽取 32 个种子，在第 1、3、5、8、12、20 轮检查队伍、复现和平均强度。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
完成按回合和种子生成的确定性对手。流派影响选宠、位置及加点，样本测试验证合法阵容与上升的平均强度。
<!-- SECTION:FINAL_SUMMARY:END -->
