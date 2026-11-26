---
id: TASK-43
title: Art QA · 首发六只原创动物样板
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-26 05:49'
updated_date: '2026-11-26 08:01'
labels: []
dependencies: []
references:
  - docs/ART_PIPELINE.md
  - docs/design/revisions/v2.1.0/SPECIFICATION.md
priority: high
type: feature
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design-Version: v2.0.0

跟踪 v2.1.0 草案中的首发视觉标准。动物与食物使用通俗名称，旧图鉴供 v2.0.0 研发回归。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 乌龟、兔子、猫咪、企鹅、长颈鹿和鲸鱼提交原创稿、来源和同源拟合对照。
- [ ] #2 同款隔离 GIL 通过原生读回，实际商店、对局和 66px/44px 图像由独立评审验收。
- [ ] #3 图元预算附加载、内存、控件峰值及真机证据。Owner 确认前不进入全图鉴批产。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
产出六只原创设计稿，复用原塔进行同源多档拟合，验证隔离 GIL 的商店和五对五窗口，提交独立评审及 Owner 确认。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
已归档六只原创纸雕风格设计稿、同源 24/40/64 图元拟合和两个真实尺寸对照。独立检查发现自动拟合的轮廓与表情保真度不足，保留为实验；样板定稿、正式商店与五对五接入、实机容量及 Owner 确认待验。

已将新拟合肖像和通俗名称接入隔离的实际单人练习。原生控件复用覆盖货架与敌方肖像，固定种子复验所有六只货架和五对五、召唤、结算、重开与拖放。Owner 与官方设备证据仍待验。
<!-- SECTION:NOTES:END -->
