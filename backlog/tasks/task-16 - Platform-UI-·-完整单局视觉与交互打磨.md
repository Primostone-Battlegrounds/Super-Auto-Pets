---
id: TASK-16
title: Platform / UI · 完整单局视觉与交互打磨
status: In Progress
assignee:
  - '@codex-native'
created_date: '2026-11-23 01:32'
updated_date: '2026-11-23 01:44'
labels: []
milestone: m-1
dependencies:
  - TASK-7
  - TASK-14
  - TASK-15
documentation:
  - platform/M1.md
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 调整战场、商店卡片和终局布局，并将原创分层肖像池接入界面。
2. 用实际战斗事件与棋盘快照驱动自动、单步和跳过回放，保留单局操作。
3. 回读隔离 GIL，运行两种终局和重开，并导出两种画布可复验的模拟画面。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- 当前检查点已接入 18 幅分层原创图标、角色生命上限、攻击与受击及召唤事件、自动/单步/跳过回放，以及同种子和新种子重开。
- 隔离原生 GIL 回读和 Lua 5.3.6 模拟通过。种子 7 第 11 轮十胜、第 5 轮零命，第 7 轮平局，重开种子 7 和新开种子 8 均通过。测试覆盖 PC 与移动画布边界，输出 5 帧 `/workspace/work/native-validation/m1-run-bpgJRA/frames.json`。
- 用户评审提出构图朝向与整体视觉需迭代，验收保持未完成。
<!-- SECTION:NOTES:END -->
