---
id: TASK-15
title: Battle / UX · 战斗回放表现与棋盘状态
status: To Do
assignee: []
created_date: '2026-11-23 01:31'
labels: []
milestone: m-1
dependencies:
  - TASK-4
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
- [ ] #1 Lua 测试复验回放棋盘与实际战斗结果一致。
<!-- AC:END -->
