---
id: TASK-22
title: Rules / QA · Arena Normal 商店与战斗差异复核
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-23 03:03'
updated_date: '2026-11-24 02:24'
labels: []
milestone: m-1
dependencies:
  - TASK-19
  - TASK-20
  - TASK-21
references:
  - >-
    https://steamcommunity.com/games/1714040/announcements/detail/501718945006355542
  - >-
    https://steamcommunity.com/games/1714040/announcements/detail/3698065064748065722
  - >-
    https://steamcommunity.com/games/1714040/announcements/detail/3674407853169874545
  - docs/design/TURTLE-COVERAGE-v1.md
  - docs/REFERENCE_MATRIX.md
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 核对带版本的开发者公告与 Steam 可见资料。
2. 对照当前单人候选规则，运行 Lua 回归并记录原版观测缺口。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
已核对官方 v44 的 Normal 阵容强度说明。2023 年 v0.27 的升级奖励和 Golden Pack 的第三轮回命仅作为历史线索。下一次以可见构建号记录 Normal 和标准兽群前几轮，核对第一次升阶、一次失败、第三轮生命和商店、首次交战触发顺序。

2026-11-23：以 sap-turtle-grounded-2026-03-16 作为只读历史研究索引。Steam 版本、同版食物和事件语义仍缺原版金样。工程共用接口、AI、交互和原生验收继续推进。

2026-11-24 已完成公开资料和项目离线核对。参照矩阵按版本记录商店、升级、碰撞、结算和 Normal 强度。0.27 的历史存档标明 Steam Build 11422935。Lua 5.4 与 5.3 全套回归通过，五项针对性回归及三阶 64 种子、六阶 128 种子平衡实验通过。当前仍缺同一 Steam 构建的 Normal/Turtle 运行证据，保留验收项待复验。现行产品暂缓历史 Arena 阵容，已确认的历史差异由参照矩阵保留。
<!-- SECTION:NOTES:END -->
