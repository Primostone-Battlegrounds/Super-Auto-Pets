---
id: TASK-38
title: Release · 单一六阶关卡与统一开局
status: Done
assignee:
  - '@codex-native'
created_date: '2026-11-24 03:38'
updated_date: '2026-11-24 03:59'
labels: []
milestone: m-4
dependencies: []
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
仓库的六阶练习、双人、八席目前分开导入。首发需要同一关卡的统一入口，沿用既有玩法和官方好友房间。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 同一个隔离 GIL 读回统一入口、六阶练习、好友 1v1 和八人吃鸡所需的绑定。
- [x] #2 复现三种玩法开局、关键交互、终局和返回，并保持商店及战斗的共享规则。
- [x] #3 记录产品、架构、平台独立评审及官方双端待验。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
核对已有流程和平台约束。复用权威对局、共用规则与交互，在同一隔离关卡接入入口和玩法。复验读回、画面和对局，记录独立评审。
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PR #47 的完整 GIL、两版 Lua 规则回归及 PC 和手机尺寸的回读界面通过原作参照、产品、架构和平台独立复验。评审提交 37b6237702f120066d273b54eb43750838493e65。官方设备、好友房间、重挑战和实际多人负载另见 platform/GAME.md。
<!-- SECTION:FINAL_SUMMARY:END -->
