---
id: TASK-2
title: Engineering · 工程初始化与复验入口
status: In Progress
assignee:
  - '@FurinyaDev'
created_date: '2026-11-23 00:51'
updated_date: '2026-11-23 00:57'
labels: []
milestone: m-0
dependencies: []
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
工程需要独立集成分支和可执行验收。

## 任务
安装 Backlog CLI，配置 OpenHarness cooperative、项目入口与 PR 检查。

## 边界
记录实际权限与门禁缺口，保留待核对的权威版本映射。

## 验收
目标版本（临时）0.0.1-alpha.0。执行下方命令或实机步骤，并记录证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 运行 backlog doctor、openharness entry 和 doctor 并记录状态。
- [ ] #2 CI 在 PR 当前 SHA 运行项目验收，独立评审后进入 develop。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
初始化和校验 Backlog。配置 cooperative 模式与复验命令。推送 PR，检查当前 SHA 的 CI 与独立评审。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backlog doctor 与工程脚本通过。OpenHarness entry 成功，live doctor 因 GitHub CLI API 403 留下权限与门禁缺口。当前 SHA 的远程 CI 和评审仍待验证。

PR #1 的 4632194 已通过 GitHub Project checks。自动审批要求另一个 GitHub 身份提交独立评审，develop 保持原状。
<!-- SECTION:NOTES:END -->
