---
id: TASK-1
title: Rules / Data · 原创规则基线
status: Done
assignee:
  - '@rules-core'
created_date: '2026-11-23 00:51'
updated_date: '2026-11-23 00:55'
labels: []
milestone: m-0
dependencies: []
modified_files:
  - docs/REFERENCE_MATRIX.md
  - src/autopets/data.lua
  - src/autopets/rng.lua
  - tests/data.lua
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
Arena 是品类参照，版本与规则来源需要逐项标记。

## 任务
记录可证实参照版本，冻结原创开发规则和初始动物食物表。

## 边界
保留原创角色与数值，未获授权资产保持待核验。

## 验收
目标版本（临时）0.0.1-alpha.0。执行下方命令或实机步骤，并记录证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 规则测试验证目录 ID、经济和成长配置，参照矩阵标注每条设计依据。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 核对公开 Arena 说明，标注可验证与待核验的证据。
2. 建立原创动物与食物目录，以及经济、解锁和成长常量。
3. 运行规则测试与项目检查，记录证据。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Steam 公开说明确认 Arena 的无计时异步节奏、十胜及 Standard 预设包敷述。具体构建与项目权威表正式版本待核验。纯 Lua 随机源随目录一并交付，让商店与对手任务可独立验证。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
冻结九只原创动物、六种食物、三种召唤单位及经济、解锁与成长配置。参照矩阵已标注依据；lua tests/data.lua、sh scripts/check.sh 和 Git 空白检查均通过。
<!-- SECTION:FINAL_SUMMARY:END -->
