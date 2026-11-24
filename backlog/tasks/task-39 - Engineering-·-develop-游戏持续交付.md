---
id: TASK-39
title: Engineering · develop 游戏持续交付
status: In Progress
assignee:
  - '@codex-native'
created_date: '2026-11-24 03:46'
labels: []
milestone: m-4
dependencies:
  - TASK-38
type: feature
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
每次 develop 更新需要可追溯地交付一个完整 GIL，负责人可从固定入口下载。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 主仓库 develop 按精确 SHA 构建和回读，并用原生 concurrency 保留最新运行。
- [ ] #2 只上传一个指定名称的 ZIP，内含唯一正式 GIL、SHA-256 与版本验收说明。
- [ ] #3 README 有固定入口，Job Summary 可直接下载，手动触发按实际配置复验。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
复用固定 MCP 和整包验证脚本。用 GitHub Actions 原生制品打包并记录入口；合并后核对真实 run、精确 SHA 和下载。
<!-- SECTION:PLAN:END -->
