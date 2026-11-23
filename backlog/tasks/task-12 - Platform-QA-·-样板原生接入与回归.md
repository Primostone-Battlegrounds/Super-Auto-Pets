---
id: TASK-12
title: Platform / QA · 样板原生接入与回归
status: To Do
assignee: []
created_date: '2026-11-23 01:04'
updated_date: '2026-11-23 01:06'
labels: []
milestone: m-1
dependencies:
  - TASK-3
  - TASK-8
  - TASK-11
documentation:
  - docs/REFERENCE_MATRIX.md
  - docs/ART_PIPELINE.md
  - docs/QA.md
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
将四只样板接到隔离千星候选的商店、五格编队和自动战斗，通过同一次候选验证规则和表现。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 位置、等级、血量和反馈按实例隔离，回归商店、换位、战斗、同种并存、解绑重进和失败清理。同种子规则结果可复验。
- [ ] #2 导入后读回模板及布局绑定，记录各场景实际控件数与同屏峰值。PC 和手机分别实跑并记录最小尺寸、触控或点击、受击和释放证据。
- [ ] #3 样板在实际商店和对手目录可用，G0 九只原创动物保留为规则回归输入。按参照矩阵验证四只样板的触发、目标、持续期及各自边界。
<!-- AC:END -->
