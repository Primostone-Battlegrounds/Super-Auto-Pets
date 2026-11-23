---
id: TASK-35
title: Release · 六阶内容、策略机器人与正式候选
status: To Do
assignee: []
created_date: '2026-11-23 08:53'
updated_date: '2026-11-23 09:02'
labels: []
milestone: m-4
dependencies:
  - TASK-34
type: feature
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
补齐同一首发包的动物、食物和技能时序，完善预算、协同、升级与站位策略，并对多人正式候选做回归。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 六阶目录和技能回归通过。固定种子对照表明策略机器人优于随机购物，并保留多种可行构筑。
- [ ] #2 1v1 与 8 人正式候选通过双端性能、匹配、同步和断线恢复验收。
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
现有三阶练习目录的 AI 基线已在种子 1–128 上对照合法随机购物。双方共用起始店铺种子，每轮交换席位，各策略 3072 场。三种策略得分率为 89.4%、87.6%、88.9%，第 12 轮共 137 种阵容组合。复验命令为 lua5.4 scripts/audit-balance.lua versus-random 128。六阶目录、强度梯度和多人运行仍待验。
<!-- SECTION:NOTES:END -->
