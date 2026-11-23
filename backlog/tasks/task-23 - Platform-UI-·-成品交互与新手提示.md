---
id: TASK-23
title: Platform / UI · 成品交互与新手提示
status: In Progress
assignee:
  - '@codex-native'
created_date: '2026-11-23 03:18'
updated_date: '2026-11-23 03:18'
labels: []
milestone: m-1
dependencies:
  - TASK-19
  - TASK-20
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
独立评审发现关键商店操作与成长收益缺少预告，初次玩家需要猜测。

## 任务
在实际准备和战斗流程补齐升级、买卖、拖放与回放反馈。目标 M1 0.1.0-alpha.0。

## 边界
沿用现有小动物、单人 AI、已验证的点击和拖放入口。

## 验收
独立评审和 GIL 模拟能验证明确的行动后果、成长信息和顺畅的单局结算。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 准备阶段可在行动前确认费用、经验与等级进度、合并与移动。
- [ ] #2 初次玩家能从游戏提示进入完整单局。结算在手工检查回放时保持可达。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
依据独立产品评审的真实操作问题修正关键界面与回放，再用隔离 GIL 验证初次操作路径。
<!-- SECTION:PLAN:END -->
