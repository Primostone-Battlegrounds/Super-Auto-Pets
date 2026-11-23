---
id: TASK-18
title: Design / QA · 单局设计稿与参考对照
status: Done
assignee:
  - '@FurinyaDev'
created_date: '2026-11-23 02:46'
updated_date: '2026-11-23 03:02'
labels: []
milestone: m-1
dependencies:
  - TASK-16
  - TASK-17
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
现有实跑画面与验收标准已成型，需要一份供使用者逐阶段审阅的设计稿。

## 任务
按公开商店、对战与 Arena 规则建立参照对照，制作三阶段画面设计稿，用真实 GIL 回放佐证。

## 边界
使用项目现有原创美术与机制，记录参照可确认的部分和实机待验项。

## 验收
图稿覆盖准备、自动战斗和结算，能复验一局的画面与状态变化。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 独立评审可用设计稿、固定参照、种子回放与画面逐阶段核对。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
固定公开参照。按准备、战斗与结算画出三阶段设计稿，用当前提交和种子 7 的 GIL 回放逐项核对。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
以用户给出的 Steam 简中页面和开发者公开的商店、交战两张图为固定参照。设计稿与 4149416 的种子 7 GIL 实跑画面逐阶段并排。

已被 TASK-21 停用作为开发和验收依据。原稿版本保留在合入提交 e0055d5f707f1a5527558743c58a818729e45f8e。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
三阶段设计稿已配套参考来源、画面对照与可重复验证命令。六套项目检查和 GIL 回读模拟通过，分别重现十胜、平局、零命及重开。官方实机验收仍单独跟踪。
<!-- SECTION:FINAL_SUMMARY:END -->
