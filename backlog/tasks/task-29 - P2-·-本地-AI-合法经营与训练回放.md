---
id: TASK-29
title: P2 · 本地 AI 合法经营与训练回放
status: Done
assignee:
  - '@P2'
created_date: '2026-11-23 04:31'
updated_date: '2026-11-24 02:09'
labels: []
milestone: m-2
dependencies:
  - TASK-28
documentation:
  - docs/design/REASONS-v1.md
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
用从空队开始的合法养成轨迹产生本地 PvE 对手。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 轨迹可重放全部商店行动、回合边界和训练战斗，并重建对手及 RNG。
- [x] #2 相同种子和轮次的对手独立于玩家商店操作，压力报告有可复现输入。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
按冻结的共用入口实现有界训练池，验证重放与多种玩家策略。
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
共享 Lua 合法经营训练轨迹可重建对手、商店、战斗与 RNG。两版 Lua 的固定种子轨迹和压力输入复验通过，评审与证据见 PR #11、#18、#26 及 docs/QA.md。
<!-- SECTION:FINAL_SUMMARY:END -->
