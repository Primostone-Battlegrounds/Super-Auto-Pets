---
id: TASK-20
title: Bot / QA · 单人 AI 对战入口和可复现性
status: In Progress
assignee:
  - '@FurinyaDev'
created_date: '2026-11-23 03:01'
updated_date: '2026-11-23 03:02'
labels: []
milestone: m-1
dependencies:
  - TASK-6
  - TASK-7
references:
  - 'https://steamcommunity.com/app/1714040/announcements/'
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
当前单局由本地 AI 驱动。需让玩家知道对手类型，并核对同种子可复现和 AI 不随商店操作改变。

## 任务
补齐对手标识、Steam 模式事实和对战回归。目标版本为 M1 当前开发版。

## 边界
沿用当前单人本地对战与 Normal 目标强度。官方 Daily 的公开描述仅作为预设对手参考。

## 验收
回归覆盖 AI 生成不受商店消费影响、不同玩法与重开的一致性，界面明确标记电脑对手。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 不同商店操作得到同一轮的同种子 AI 阵容，开战和重开回归通过。
- [ ] #2 隔离 GIL 准备和交战画面明确标记电脑对手。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
核对官方 Arena 与 Daily 公告。准备和交战标记电脑对手，补足同种子、不同商店操作及实际提交战斗的回归。
<!-- SECTION:PLAN:END -->
