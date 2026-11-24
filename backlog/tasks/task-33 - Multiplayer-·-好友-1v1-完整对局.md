---
id: TASK-33
title: Multiplayer · 好友 1v1 完整对局
status: In Progress
assignee:
  - '@codex-native'
created_date: '2026-11-23 08:53'
updated_date: '2026-11-24 01:49'
labels: []
milestone: m-2
dependencies:
  - TASK-32
  - TASK-36
  - TASK-37
documentation:
  - platform/M2-host.md
priority: high
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
接入正式好友 1v1。复用千星入房、已验身份桥、共享商店和战斗引擎。用官方资料核对准备计时、生命、平局和胜负。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 两台官方客户端从独立经营和准备一直打到终局，各轮结果一致，并可安全重试请求。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 对接已验证身份、序号与定向状态，离线运行完整双人规则。
2. 扩展千星原生输入、计时、经营、战斗与终局，分层记录离线证据。
3. 使用隔离候选做官方双客户端整局与断线验证。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
已实现复用双人权威规则的宿主连接与定向快照，离线覆盖请求重试、平局、超时、共享回放、终局及同身份恢复。千星需独立核对实际连接身份和原生执行，TASK-32 继续记录官方实测。

千星双人候选已离线实现独立经营、原生计时、权威战斗、共享回放与扣命终局。隔离 GIL 读回和 Lua 5.3/5.4 终局棋盘对照均通过。双设备官方整局、实际连接身份和恢复窗口保持待验。
<!-- SECTION:NOTES:END -->
