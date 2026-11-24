---
id: TASK-31
title: P4 · 隔离 GIL 候选与分层验收
status: Done
assignee:
  - '@P4'
created_date: '2026-11-23 04:31'
updated_date: '2026-11-24 02:09'
labels: []
milestone: m-2
dependencies:
  - TASK-28
  - TASK-29
  - TASK-30
  - TASK-24
documentation:
  - docs/design/REASONS-v1.md
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
在现有原生链打包共享规则、合法 AI 和改进交互，留存同提交独立证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Lua 5.4、Lua 5.3 与实际 GIL 回读的领域输入一致，候选可校验并复现。
- [x] #2 同一提交附独审和画面证据，分别标注 PC 与手机的官方实机状态。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
兼容齐套模块、复验源与原生输入并按原有 CI 生成候选。
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
实际 GIL 回读的脚本、输入与 Lua 5.3/5.4 源码结果一致。兼容和六阶包经独立复审并带 SHA-256、输入、画面与实机待验标注。证据见 PR #19、#32，官方设备证据由 TASK-8 跟踪。
<!-- SECTION:FINAL_SUMMARY:END -->
