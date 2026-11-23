---
id: TASK-21
title: Design / QA · Steam Arena 参照与旧稿留档
status: Done
assignee:
  - '@FurinyaDev'
created_date: '2026-11-23 03:01'
updated_date: '2026-11-23 03:03'
labels: []
milestone: m-1
dependencies:
  - TASK-18
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
用户指定 Steam 作为现行参考，历史设计稿需要停止作为交付依据。

## 任务
冻结历史稿出处，明确现行官方参照和可执行验收入口。目标版本为 M1 当前开发版。

## 边界
沿用 Git 和现有参照矩阵。

## 验收
现行文档能定位 Steam 来源，历史稿标为停用，后续以运行行为和测试验收。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 旧稿保留可追溯 Git 版本，现行文档和历史任务状态指向 Steam 参照。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
在旧地址放停用说明，保留原始 Git 版本。将官方证据和可执行验证纳入现有参照矩阵与 QA。
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
旧稿 v1 和配图固定保存在 e0055d5。原地址显示停用；产品、QA 和参照矩阵直接指向 Steam。已验证 Git 历史对象、现行文件和项目检查。
<!-- SECTION:FINAL_SUMMARY:END -->
