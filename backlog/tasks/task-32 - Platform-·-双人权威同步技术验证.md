---
id: TASK-32
title: Platform · 双人权威同步技术验证
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-23 08:44'
updated_date: '2026-11-23 09:19'
labels: []
milestone: m-2
dependencies: []
priority: high
type: spike
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
在独立千星关卡验证两名玩家的事件归属、回合推进和单次结算，为好友 1v1 接入完整商店和战斗建立依据。官方双人证据由本任务保留。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 隔离 GIL 读回 2/2 人、双向信号和服务端图。
- [ ] #2 两个官方客户端可各自提交准备，双方观察到相同回合和一次结算。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
复用固定版千星 MCP，构建绑定玩家来源的双人握手和回合验证，并生成隔离候选。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
独立 GIL 的人数读回为 2/2，信号、关卡服务端图和 Lua UI 绑定经过 MCP 读回。离线模拟通过两轮准备、重复及过期请求、双方同版本回包与单次结算。官方双设备还需核验客户端 Lua 信号事件的来源实体。

隔离候选增加玩家模板原生按钮。按键从固定控件号映射到当前测试轮次，关卡按原生事件来源核对玩家，Lua 路径仍并列验证。独立 GIL 已核对四个按钮、玩家图、双向信号和两轮模拟。官方多人试玩、手机点按及 Lua 来源仍待双设备证据。
<!-- SECTION:NOTES:END -->
