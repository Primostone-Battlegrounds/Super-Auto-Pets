---
id: TASK-25
title: Bot / QA · 单局难度与多种可行流派
status: In Progress
assignee:
  - '@run-flow'
created_date: '2026-11-23 03:19'
updated_date: '2026-11-23 03:19'
labels: []
milestone: m-1
dependencies:
  - TASK-20
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
独立多种子测试发现固定投喂同一前排可轻易击败几乎所有对手。

## 任务
调整本地 AI 成长与队伍威胁，引导多种有意义策略。目标 M1 0.1.0-alpha.0。

## 边界
保留可复现的 PvE，避免读取玩家经济或阵容来规避其选择。

## 验收
用确定性、多种种子的完整单局复算策略差异。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 有准备阶段决策的玩法仍可完成十胜，单一盲目策略失去近乎必胜的优势，并公布可复验的样本。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
复用多种子策略 sweep，调整合法阵容成长及威胁，复测多种有决策的完整通关策略。
<!-- SECTION:PLAN:END -->
