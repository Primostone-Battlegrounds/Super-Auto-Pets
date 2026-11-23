---
id: TASK-19
title: Platform / UI · 商店和五格阵容直接拖放
status: In Progress
assignee:
  - '@FurinyaDev'
created_date: '2026-11-23 03:01'
updated_date: '2026-11-23 03:02'
labels: []
milestone: m-1
dependencies:
  - TASK-16
references:
  - 'https://store.steampowered.com/app/1714040/Super_Auto_Pets/?l=schinese'
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
Steam 参照要求把商店和阵容的操作落实到游戏。当前千星界面只能分次点选。

## 任务
准备阶段支持从货架或阵容直接拖放到队员和队伍站位。目标版本为 M1 当前开发版。

## 边界
使用千星官方光标事件和项目现有布局及规则。

## 验收
模拟拖放覆盖买入、合并、喂食、调位和区域外取消，保留单击操作，官方设备随后验收。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 隔离 GIL 回读后以模拟光标事件验证拖放成功、无效目标取消和点击回退，以及种子 7 完整单局。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
核对千星官方光标事件与画布映射。复用当前商店命令实现拖放，跑隔离 GIL 和完整单局回归。
<!-- SECTION:PLAN:END -->
