---
id: TASK-8
title: Platform / UI · 千星单局界面
status: In Progress
assignee:
  - '@codex-native'
created_date: '2026-11-23 00:51'
updated_date: '2026-11-24 00:57'
labels: []
milestone: m-1
dependencies:
  - TASK-3
  - TASK-7
documentation:
  - platform/M1.md
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
玩家需要通过千星界面完成整局。

## 任务
接入五格阵容、商店、战斗 HUD 和结算，适配 PC 和移动输入。

## 边界
轻量原生 2D，使用经过授权的表现资源。

## 验收
目标版本（临时）0.1.0-alpha.0。执行下方命令或实机步骤，并记录证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PC 和手机官方客户端分别实跑完整回合及至少一种终局。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 用原生 UI 将五格、商店和战斗事件接入 TASK-7 单局接口。
2. 将纯 Lua 模块内嵌到隔离 GIL，由 MCP 回读并执行 Lua 5.3 模拟整局。
3. 记录 PC 和手机官方客户端分开的待验步骤。

4. 分别以 PC 和手机画布运行回读输入，校验控件边界、模态层的命中隔离与脚本停用和恢复。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- 以无自定义界面、Lua 和图的固定 shapes 夹具生成单局 GIL，固定 MCP `59c576e41632a6bf6781bbca83a676d0da0374ec`，`MILIASTRA_ALLOW_LIVE_WRITE=0`。工具目录与输入副本均通过原始哈希校验。
- `node tests/native/verify-m1.mjs <MCP目录> <临时目录> <Lua 5.3>` 退出 0。GIL SHA-256 `434fa17557ece39d1615758101a89e46406f873cd8617c573ab543aca12725a0`，157,331 字节。读回唯一自定义界面、129 个控件、种子 7、39,246 字节内嵌 Lua、空诊断，并校验移动画布与父容器边界。
- Lua 5.3.6 通过实际 GIL 回读源码与控件路径模拟点击。第 11 轮达 10 胜 5 命，第 5 轮达 0 胜 0 命，两路均重开，第 7 轮平局走通。复验目录 `/workspace/work/native-validation/m1-run-Ze7QlD`。
- PC 官方鼠标、布局、日志和终局待验。手机官方触屏、布局、日志和终局独立待验。

成品复核候选从 PR #10 的 GitHub Actions Artifacts 下载。检查人数、操作、确认重开、两种终局与回放，并记录同一候选的 PC 与手机证据。

PR #11 已进入 develop，沿用该 PR 的隔离单人候选完成官方 PC 和手机实测。已通过同 SHA 的源码、独立 GIL 读回与离线双端画面复核；官方客户端待验。候选 GIL SHA-256 为 3b54bd1f3cb1da7331fb063f3650d1248e30850136f3053b9873297a13cb3c81。[候选下载](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/actions/runs/45113299227/artifacts/14790068203)

回读候选现分别执行 1600×900 鼠标与 1280×720 触点完整输入。两种画布输出相同日志及 13 个画面状态，校核 48×48 布局单位的最小命中、拖放内外边缘、模态隔离和停用再启用。停用结束悬挂拖放、逐帧更新和音效，启用保留回放位置。官方 PC 和移动端仍独立待验。
<!-- SECTION:NOTES:END -->
