---
id: TASK-7
title: Game Flow / QA · 十胜或零命闭环
status: To Do
assignee: []
created_date: '2026-11-23 00:51'
labels: []
milestone: m-1
dependencies:
  - TASK-4
  - TASK-5
  - TASK-6
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
- [ ] #1 lua tests/run.lua 打通胜利、失败、重开与同种子回放。
<!-- AC:END -->
