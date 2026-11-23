---
id: TASK-6
title: Bot · 回合与流派对手
status: To Do
assignee: []
created_date: '2026-11-23 00:51'
labels: []
milestone: m-1
dependencies:
  - TASK-1
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
- [ ] #1 lua tests/bot.lua 验证回放、阵容合法和强度样本。
<!-- AC:END -->
