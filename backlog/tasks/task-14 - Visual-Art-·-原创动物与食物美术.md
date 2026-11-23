---
id: TASK-14
title: Visual / Art · 原创动物与食物美术
status: Done
assignee:
  - '@rules-core'
created_date: '2026-11-23 01:31'
updated_date: '2026-11-23 01:48'
labels: []
milestone: m-1
dependencies: []
modified_files:
  - src/autopets/art.lua
  - tests/art.lua
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
现有完整单局需要可识别的动物与道具。

## 任务
为全部可购买动物、召唤物和食物制作统一原创美术。

## 边界
使用千星原生图形可实现的资源，保持规则与目录 ID。

## 验收
M1。资产检查覆盖目录中每个 ID，画面检查覆盖全部图标。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 全目录图标可被原生卡片绘制，资源来源与边界可核对。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 使用原生矩形与椭圆为九只动物、三只召唤物和六种食物设计原创图标。
2. 将 44×44 图层按目录 ID 存入 Lua 美术表，并核对十六层上限。
3. 对照目录运行覆盖、图层、坐标与轮廓测试，并检查全部图标的接触表。

4. 根据评审重绘十二只动物与召唤物的右向侧面或四分之三轮廓，以 44 和 66 像素检查方向与识别度。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
图形由本项目原创坐标、色彩和轮廓组成，使用千星内置矩形 100001 和椭圆 106025。九种动物、三种召唤物和六种食物均使用从后向前的 44×44 图层，最多十六层。逐项检查 44 像素与双倍尺寸接触表，分别用 Lua 5.3 和 5.4 验证目录 ID、图层值、色彩、边界和几何区别。

根据 Owner 的画面反馈，将九只动物与三只召唤物统一为右向侧面或四分之三构图。以 44 和 66 像素逐项复核脸部、眼睛、轮廓与底部落点，收窄岩釉麝的口鼻并强化漂木螯虾眼睛。六种食物图层保持一致。Lua 5.3、Lua 5.4 与项目检查通过。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
交付十八个原创原生图标。十二只动物与召唤物采用统一右向侧面，保留物种轮廓。44 和 66 像素接触表以及 Lua 美术与项目检查均通过。
<!-- SECTION:FINAL_SUMMARY:END -->
