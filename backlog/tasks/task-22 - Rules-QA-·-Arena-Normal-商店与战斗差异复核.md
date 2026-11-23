---
id: TASK-22
title: Rules / QA · Arena Normal 商店与战斗差异复核
status: To Do
assignee: []
created_date: '2026-11-23 03:03'
labels: []
milestone: m-1
dependencies:
  - TASK-19
  - TASK-20
  - TASK-21
references:
  - 'https://store.steampowered.com/app/1714040/Super_Auto_Pets/?l=schinese'
  - 'https://teamwood.itch.io/super-auto-pets'
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
现行参照包含 Steam Arena Normal 和标准兽群说明；已有项目单局可运行，规则版本和细节还未对照到原版同一构建。

## 任务
记录原版可复验的商店层级、升级奖励、交战顺序、结算和对手强度，再用现有单局回归逐项核对。目标 M1 0.1.0-alpha.0。

## 边界
原版构建号和入口写清楚。公开截图只用来核对可见信息。保持本地 AI 与原创资产。

## 验收
在参照矩阵为每项记录来源、版本、项目现值与可执行验证；能确认的差异按模块拆成修正任务。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 至少核对商店、升阶、交战、结算、Normal 对手强度五项的来源与复验命令。
<!-- AC:END -->
