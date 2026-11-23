---
id: TASK-5
title: Shop · 阵容、经济和成长
status: Done
assignee:
  - '@run-flow'
created_date: '2026-11-23 00:51'
updated_date: '2026-11-23 00:58'
labels: []
milestone: m-1
dependencies:
  - TASK-1
modified_files:
  - src/autopets/shop.lua
  - tests/shop.lua
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
准备阶段承载主要玩家决策。

## 任务
实现购买、卖出、刷新、冻结、合成、奖励、食物与商店层级。

## 边界
校验失败保留金币、阵容和 RNG。

## 验收
目标版本（临时）0.1.0-alpha.0。执行下方命令或实机步骤，并记录证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lua tests/shop.lua 验证经济、成长、冻结、无效操作和站位。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 使用规则目录、等级阈值和固定 RNG 实现可重放商店。
2. 实现购买、出售、刷新、冻结、站位、合成、奖励和喂食，验证失败时保留状态。
3. 运行 Lua 商店测试并记录确定性与无效操作证据。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lua 5.4 验证通过，`lua tests/shop.lua` 与 `sh scripts/check.sh` 退出码为 0。对照同种子商店验证失败操作不消耗 RNG。
队伍按从前至后排列。刷新和换轮保留冻结货位，升级奖励只在当轮保留。合成保留两单位较高的攻防，再加规则增长值。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
完成纯 Lua 商店和成长流程。自动化测试覆盖经济、冻结、合成、升级奖励、食物、站位、等级上限及失败操作的状态与随机序列。
<!-- SECTION:FINAL_SUMMARY:END -->
