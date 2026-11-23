---
id: TASK-30
title: P3 · 原生菜单、输入与回放控制
status: In Progress
assignee:
  - '@P3'
created_date: '2026-11-23 04:31'
labels: []
milestone: m-2
dependencies:
  - TASK-19
  - TASK-26
documentation:
  - docs/design/REASONS-v1.md
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
从既有界面接续，实现当前单局的菜单继续、确认放弃和回放控制。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 鼠标与触控路径可重复走菜单继续、取消及确认放弃，并保留拖放和点选操作。
- [ ] #2 回放控制与结算独立，当前候选的 PC 和手机回读画面经过独立复核。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
修改原生布局与控制脚本，交由候选输入和离线帧复验。
<!-- SECTION:PLAN:END -->
