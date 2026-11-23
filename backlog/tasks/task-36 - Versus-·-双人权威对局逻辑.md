---
id: TASK-36
title: Versus · 双人权威对局逻辑
status: Done
assignee:
  - '@codex'
created_date: '2026-11-23 09:12'
updated_date: '2026-11-23 09:21'
labels: []
milestone: m-2
dependencies:
  - TASK-28
priority: high
type: feature
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
应在接入千星好友房前复用现有商店和自动战斗，建立两个独立席位的确定性回合与终局。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 两个席位能经历独立经营、准备锁定、自动开战、结算、进轮和终局。
- [x] #2 过期和重复请求无法二次扣血或消费金币。超时、平局、私有商店和战斗视图可复验。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
复用 shop 与 battle。独立管理两个席位、房间回合、服务端时间与命令序号，覆盖完整多轮对局。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
独立复审后的回归覆盖随机数流分离、货架错位检查和房间超时。房间总时限为本地可配置默认值。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
完成纯 Lua 双人权威对局。Lua 5.3 与 5.4 复验独立经营、准备、同一战斗结算、平局及零命终局，覆盖过期或重复命令、超时、认输、快照隔离及战斗上限后恢复。千星接入与实机证据由 TASK-32、TASK-33 跟踪。
<!-- SECTION:FINAL_SUMMARY:END -->
