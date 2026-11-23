---
id: TASK-3
title: Platform / UI · 隔离原生 Lua/GIL 技术样本
status: To Do
assignee: []
created_date: '2026-11-23 00:51'
labels: []
milestone: m-0
dependencies: []
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
千星工具与客户端需分别验证。

## 任务
复用 MCP 在隔离副本构建最小五格、UI、输入及日志样本。

## 边界
仅用隔离样本，PC/手机缺失则分别保留实机项。

## 验收
目标版本（临时）0.0.1-alpha.0。执行下方命令或实机步骤，并记录证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 构建与 GIL 读回确认 Lua 和界面绑定。
- [ ] #2 PC 和手机官方客户端确认输入、绘制和日志。
<!-- AC:END -->
