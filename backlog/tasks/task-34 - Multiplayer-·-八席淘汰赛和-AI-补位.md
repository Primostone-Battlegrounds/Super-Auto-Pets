---
id: TASK-34
title: Multiplayer · 八席淘汰赛和 AI 补位
status: In Progress
assignee:
  - '@p02'
created_date: '2026-11-23 08:53'
updated_date: '2026-11-27 03:55'
labels:
  - v0.6.0
milestone: m-3
dependencies:
  - TASK-28
references:
  - docs/PRODUCT.md
documentation:
  - platform/M3-host.md
priority: high
type: feature
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design-Version: v2.0.0

完成八人淘汰赛，复用已存在的权威商店与战斗契约及官方房间能力。覆盖真人入场、机器人补位、完整对局、退出和异常恢复。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 覆盖 1 至 8 名真人的入场、奇数存活、机器人对战、退出、淘汰和最终名次。
- [ ] #2 用官方环境记录匹配等待和实际开局。
- [ ] #3 隔离 v0.6.0 候选验证开局、补位、结算、退出和可离线复现的异常恢复。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 核对固定正式候选的原生房间、Lua 宿主和状态所有权。
2. 用现有定向快照和回放信号恢复同实体当前回合结算，并复测陌生实体与重复请求。
3. 在两版 Lua、隔离正式 GIL 与 Simulator 回归 1 至 8 真人席位、补位、终局、退出和恢复。
4. 记录官方客户端所需的最小验证。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
纯 Lua 领域层已覆盖 1 至 8 名真人及空余房位机器人补位。tests/room.lua 验证空阵经营、机器人实际交战、准备超时、奇数轮空、同轮淘汰、退出、序号拒绝、共享回放与全局名次。千星原生完整对局和官方房间匹配均待验。

离线八席宿主验证连接请求路由、商店定向回执、同身份恢复、主动退出及并发到期；真实千星连接事件和恢复语义仍待验。

六阶共享目录经已认证的 Lua 宿主完成 256 场，覆盖 1–8 真人席且全部由最后存活者取胜。两版 Lua 的完整报告 SHA-256 cf2d178dcb01f6b5aa4341a45cdbb1c14a985d5ec182571b49c6e173047763da。源码压力、CPU/内存与宿主定向帧见 docs/design/ROOM-LOAD.md，千星实际玩法及匹配待继续验收。

三阶兼容原生八席候选完成独立经营、机器人补位、准备、配对、战斗回放、淘汰与最终名次。隔离 GIL 读回 1–8 人，通过全部真人数量的源码图整赛及双画布客户端验证，含单人加七机器人、超时、退出、轮空与重复请求。官方平台匹配、设备、事件来源和实际性能仍待验，六阶原生接入继续跟踪。

六阶首发池已接通完整八席原生关卡；全部真人数量可打到唯一冠军，正式六阶技能与共享 Lua 的完整原生回执核对。淘汰后界面明确显示已淘汰。官方匹配、身份、重连和负载证据待写。

历史工作以双人同步探针验证共享契约。现行八席实现已经使用已完成的 TASK-28，独立的 1v1 产品验收不再是此任务前置。

原生图在同一已入席玩家请求同步时按权限补发当轮已自然结算的回放。只回放锁定阵容、原种子和原结果，交易和准备序号不变。节点图测试覆盖回执丢失、相同实体、替换实体、请求重试和下一轮边界。
<!-- SECTION:NOTES:END -->
