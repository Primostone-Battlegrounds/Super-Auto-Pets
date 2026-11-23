---
id: TASK-16
title: Platform / UI · 完整单局视觉与交互打磨
status: To Do
assignee: []
created_date: '2026-11-23 01:32'
labels: []
milestone: m-1
dependencies:
  - TASK-7
  - TASK-14
  - TASK-15
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
终端与原生闭环已有，原生棋盘需要可玩的成品画面。

## 任务
统一原生界面、接入原创动物、食物、真实战斗回放和两种终局反馈。

## 边界
保持 GIL 隔离写入和五格单局系统，官方实机由 TASK-3 和 TASK-8 单独记录。

## 验收
M1。回读 GIL 并模拟点击跑通 10 胜、0 命及重开，核对实际界面预览。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 原生 GIL 回读、PC 与移动画布检查、完整玩法模拟和画面复核均通过。
<!-- AC:END -->
