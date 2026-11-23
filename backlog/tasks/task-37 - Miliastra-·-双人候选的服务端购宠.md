---
id: TASK-37
title: Miliastra · 双人候选的服务端购宠
status: Done
assignee:
  - '@codex'
created_date: '2026-11-23 09:29'
updated_date: '2026-11-23 09:37'
labels: []
milestone: m-2
dependencies:
  - TASK-36
priority: high
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
把双人隔离候选接入实际商店经营，验证原生身份输入能够改变玩家自己的金币、货位与队伍。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 两人收到各自货架与金币，购买与备战锁定由图处理，过期或重复购买无效。
- [x] #2 读回购买控制、图与私有商店回包，验证进轮补金币并保留队伍。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
使用现有 Lua 目录派生两轮店铺与价格，扩展隔离关卡服务端图和双人界面，按真实 GIL 读回与可复现回合验收。
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
已在双人隔离 GIL 接通各自三格货架、服务端购宠、扣金和五格队伍。Lua 5.3/5.4 派生货架结果一致。隔离验证读回 2/2 人、十个原生按钮和两图挂载，覆盖两条输入路径、独立商店、准备锁定、重复及过期拒绝、阵容上限和进轮补金币。双设备身份、定向回包与触控实机由 TASK-32 继续跟踪。
<!-- SECTION:FINAL_SUMMARY:END -->
