---
id: TASK-17
title: Art / Roster · 亲和动物名册与宝宝召唤
status: Done
assignee:
  - '@FurinyaDev'
created_date: '2026-11-23 02:17'
updated_date: '2026-11-23 02:23'
labels: []
milestone: m-1
dependencies:
  - TASK-14
  - TASK-16
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
玩家希望动物看起来可爱，昆虫、幼虫和螯虾造型影响体验。

## 任务
将可玩名册中的相关单位换成亲和动物与宝宝，更新商店、召唤、图鉴及实跑画面。

## 边界
保留可爱的龟和雨燕，沿用九只动物和三个召唤位的原有阶级、流派、数值及触发。

## 验收
M1。检查目录和画面，验证确定性单局、召唤和隔离 GIL 回读。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 更新全部目录与图鉴，商店和战斗可识别新动物与宝宝，同种子完整单局与 GIL 通过。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
保留槽位与数值，迁移名册、技能和召唤称呼，接入原创亲和动物图元。重跑完整单局、隔离 GIL 和两种画布，更新图鉴和复验图。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
保留龟、雨燕、旱獭、麝与全部食物。五个动物位换成兔、狐、水獭、猫、绵羊，召唤位换成兔宝宝、水獭宝宝、卷毛小羊。旧数据库的槽位、数值、触发与流派逐项比较一致。

已查看 44/66 像素图鉴，以及隔离 GIL 回读的 PC、移动画面。实际兔宝宝入场已生成截图。Lua 5.3 和 5.4 各六套通过，G0/M1 回读及模拟的十胜、零命、平局和两种重开通过。官方客户端仍单独待验。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
更新了名册、原生原创图元、商店技能文案、三个宝宝召唤以及实际运行画面。保留既有单局规则。
<!-- SECTION:FINAL_SUMMARY:END -->
