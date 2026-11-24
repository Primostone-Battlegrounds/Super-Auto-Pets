---
id: TASK-39
title: Engineering · develop 游戏持续交付
status: Done
assignee:
  - '@codex-native'
created_date: '2026-11-24 03:46'
updated_date: '2026-11-24 04:10'
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
- [x] #1 主仓库 develop 按精确 SHA 构建和回读，并用原生 concurrency 保留最新运行。
- [x] #2 只上传一个指定名称的 ZIP，内含唯一正式 GIL、SHA-256 与版本验收说明。
- [x] #3 README 有固定入口，Job Summary 可直接下载，手动触发按实际配置复验。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
复用固定 MCP 和整包验证脚本。用 GitHub Actions 原生制品打包并记录入口；合并后核对真实 run、精确 SHA 和下载。
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PR #48 合入后，GitHub Actions 45324002378 在 develop 提交 a23f1bef22a5595528ce7333c852892e77547cc9 自动构建。手动原生重跑第 2 次成功，唯一同名 ZIP 已下载并复验精确 SHA、归档散列、五项文件和四项包内校验和。README 与 QA 指向固定入口。网页新建 workflow_dispatch 受默认分支注册条件约束，手动重跑已验证。
<!-- SECTION:FINAL_SUMMARY:END -->
