---
id: TASK-27
title: Art / QA · 独立核对商店与战斗的视觉可读性
status: Done
assignee:
  - '@codex-native'
created_date: '2026-11-23 03:34'
updated_date: '2026-11-23 03:44'
labels: []
milestone: m-1
dependencies:
  - TASK-23
  - TASK-26
references:
  - 'https://store.steampowered.com/app/1714040/Super_Auto_Pets/?l=schinese'
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
成品复核后，Owner 要求对照 Steam 公开画面独立评审实际美术。

## 任务
核对动物轮廓、方向、操作焦点和战斗信息。修正技能说明离所选动物过远、交战动作和攻血反馈不够明显的问题。目标 M1 0.1.0-alpha.0。

## 边界
使用项目自己的动物、河岸与界面视觉设计。对照同一次 GIL 实际回读的手机和桌面画面。

## 验收
在准备与战斗各验收一处明确焦点，检查五格画面和伤害后的状态。由未实现这次修改的 Agent 给出独立结论。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 隔离 GIL 同一提交复现就近技能浮层、对向出击与清楚受击反馈，双画布均可读。
- [x] #2 独立评审按 Steam 官方参照与实际回读画面检查，记录差异与是否存在阻碍成品交付的视觉问题。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
对照官方公开截图与当前 GIL 画面，调整技能和战斗焦点，输出实际帧并发给独立评审。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
独立评审 integration_review 核对 4d6aefb14e265dda0f8f09a46582a23918885b7b。实际 GIL 帧通过 1600×900、1280×720 和缩小至 640×360 的检查，复跑 GIL、帧和日志一致。Steam 参照通过官方索引对照，CDN 原始图访问受限。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
验证了靠近选中动物的技能浮层、清楚的攻血和经验、相向出击和受击数字。独立美术与离线单局结论均通过，真机由 TASK-8 跟踪。
<!-- SECTION:FINAL_SUMMARY:END -->
