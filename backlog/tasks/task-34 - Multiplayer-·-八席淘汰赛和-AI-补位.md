---
id: TASK-34
title: Multiplayer · 八席淘汰赛和 AI 补位
status: In Progress
assignee:
  - '@rules-core'
created_date: '2026-11-23 08:53'
updated_date: '2026-11-24 01:30'
labels: []
milestone: m-3
dependencies:
  - TASK-33
documentation:
  - platform/M3-host.md
priority: high
type: feature
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
在已验 1v1 权威对局上增加最多八席。复用平台房间，按每轮两两配对结算，机器人使用合法经营指令。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 覆盖 1 至 8 名真人的入场、奇数存活、机器人对战、退出、淘汰和最终名次。
- [ ] #2 用官方环境记录匹配等待和实际开局。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 复用双人权威请求契约，建立八席状态、补位和回合结算。
2. 运行真人席数、超时、退出、轮空及固定种子回归，再构建隔离千星候选。
3. 在官方客户端记录身份、房间能力、等待和完整对局。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
纯 Lua 领域层已覆盖 1 至 8 名真人及空余房位机器人补位。tests/room.lua 验证空阵经营、机器人实际交战、准备超时、奇数轮空、同轮淘汰、退出、序号拒绝、共享回放与全局名次。千星原生完整对局和官方房间匹配均待验。

离线八席宿主验证连接请求路由、商店定向回执、同身份恢复、主动退出及并发到期；真实千星连接事件和恢复语义仍待验。

六阶共享目录经已认证的 Lua 宿主完成 256 场，覆盖 1–8 真人席且全部由最后存活者取胜。两版 Lua 的完整报告 SHA-256 cf2d178dcb01f6b5aa4341a45cdbb1c14a985d5ec182571b49c6e173047763da。源码压力、CPU/内存与宿主定向帧见 docs/design/ROOM-LOAD.md，千星实际玩法及匹配待继续验收。
<!-- SECTION:NOTES:END -->
