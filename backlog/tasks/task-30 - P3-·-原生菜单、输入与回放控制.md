---
id: TASK-30
title: P3 · 原生菜单、输入与回放控制
status: Done
assignee:
  - '@P3'
created_date: '2026-11-23 04:31'
updated_date: '2026-11-24 02:09'
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
- [x] #1 鼠标与触控路径可重复走菜单继续、取消及确认放弃，并保留拖放和点选操作。
- [x] #2 回放控制与结算独立，当前候选的 PC 和手机回读画面经过独立复核。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
修改原生布局与控制脚本，交由候选输入和离线帧复验。
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
两种回读画布复验菜单继续、取消、放弃、拖放、点选和独立回放控制，停用及恢复清理通过。独立帧与输入复审见 PR #19、#22、#32。官方设备整局继续由 TASK-8 跟踪。
<!-- SECTION:FINAL_SUMMARY:END -->
