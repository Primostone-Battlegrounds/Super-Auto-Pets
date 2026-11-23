---
id: TASK-16
title: Platform / UI · 完整单局视觉与交互打磨
status: Done
assignee:
  - '@codex-native'
created_date: '2026-11-23 01:32'
updated_date: '2026-11-23 01:53'
labels: []
milestone: m-1
dependencies:
  - TASK-7
  - TASK-14
  - TASK-15
documentation:
  - platform/M1.md
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
终端与原生闭环已有，原生棋盘需要可玩的成品画面。

## 任务
统一原生界面、接入原创动物、食物、真实战斗回放和两种终局反馈。

## 边界
保持 GIL 隔离写入和五格单局系统，官方实机由 TASK-3 和 TASK-8 单独记录。

## 验收
M1。回读 GIL 并模拟点击跑通 10 胜、0 命及重开，核对实际界面预览。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 原生 GIL 回读、PC 与移动画布检查、完整玩法模拟和画面复核均通过。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 调整战场、商店卡片和终局布局，并将原创分层肖像池接入界面。
2. 用实际战斗事件与棋盘快照驱动自动、单步和跳过回放，保留单局操作。
3. 回读隔离 GIL，运行两种终局和重开，并导出两种画布可复验的模拟画面。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- 按用户反馈调整为浅色河岸场景。准备阶段将五格阵容放在独立市集上方，右侧为前排。交战时双方沿两岸面对中心，镜像只作用于对方肖像，攻命标签保持正常。顶部集中金币、回合、胜场与生命，选中时可查实际技能与食物效果。
- 以固定 MCP 和隔离夹具完成 GIL 回读。候选 SHA-256 `65fa887438988fe71e38e3c0fecf5f90cf508b20a0459f8edcf0bf7c7b23004e`，474,313 字节，519 个控件，零诊断。`verify-m1.mjs` 校验 1600×900 与 1280×720、全五对五站位、镜像、遮挡与受伤数值。
- Lua 5.3.6 模拟通过自动与单步回放、跳过、护盾格挡与召唤、第 11 轮十胜、第 5 轮零命、第 7 轮平局、原种子 7 重开及新种子 8。`sh scripts/check.sh` 也通过。
- 六阶段离线渲染数据位于 `/workspace/work/native-validation/m1-run-xlJyjb/frames.json`。独立图像审阅结果待主代理记录，PC 与移动官方客户端仍分别由 TASK-3 / TASK-8 跟进。

以 QA.md 的两张公开商店与对战参照逐项核对。主控从 GIL 回读和真实模拟点击检查 1280×720 与 1600×900，12 只动物朝向、己方五格、技能说明、五对五、伤害扣血与终局均清晰。GIL SHA-256 65fa887438988fe71e38e3c0fecf5f90cf508b20a0459f8edcf0bf7c7b23004e，实跑第 11 轮 10 胜、第 5 轮 0 命、平局、同种子与新种子重开。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
完成当前可玩名册的原生美术、标准化朝向、准备界面与战斗回放；通过 G0/M1 GIL 回读、六套 Lua 测试和两种画布画面复核。官方 PC 和手机实机验收仍由 TASK-3、TASK-8 跟踪。
<!-- SECTION:FINAL_SUMMARY:END -->
