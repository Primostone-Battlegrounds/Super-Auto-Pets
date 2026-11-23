---
id: TASK-3
title: Platform / UI · 隔离原生 Lua/GIL 技术样本
status: In Progress
assignee:
  - '@codex-native'
created_date: '2026-11-23 00:51'
updated_date: '2026-11-23 00:59'
labels: []
milestone: m-0
dependencies: []
documentation:
  - platform/README.md
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
千星工具与客户端需分别验证。

## 任务
复用 MCP 在隔离副本构建最小五格、UI、输入及日志样本。

## 边界
仅用隔离样本，PC/手机缺失则分别保留实机项。

## 验收
目标版本（临时）0.0.1-alpha.0。执行下方命令或实机步骤，并记录证据。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 构建与 GIL 读回确认 Lua 和界面绑定。
- [ ] #2 PC 和手机官方客户端确认输入、绘制和日志。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 用固定版本的 MCP 和隔离夹具生成五格 Lua 客户端界面。
2. 回读 GIL 检查脚本、布局绑定和控件坐标，执行 Lua 模拟点击并记录日志。
3. 分别记录 PC 与手机官方客户端的待验项。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- 固定 MCP `59c576e41632a6bf6781bbca83a676d0da0374ec`，复制工具自带编辑器夹具 `editor-2026-10-13-handui.gil`，以 `MILIASTRA_ALLOW_LIVE_WRITE=0` 运行 MCP stdio。夹具与输入副本的 SHA-256 均保持 `262f2c7832ff27d4bb49ab47e3c93e46d5c0121e263c4b89ba1e4231e53097c0`。
- `node tests/native/verify-g0.mjs <MCP目录> <临时目录> <Lua 5.3>` 退出 0。GIL SHA-256 `8236cc139b18f05279f65fc88be780ed81060e8bdaf5aa161c4d4235f7382e25`，53,366 字节。读回默认布局 `1073741825`、容器 `1073741863`、挂载节点 `1073741864`、原样 Lua `1073741826`、五格与点击区域及标记几何。`scene_check_client` 0 项。
- 用 Lua 5.3.6 执行读回源码，模拟点击 `3, 1, 5, 2, 4, 4`，标记依次移动，各输入日志顺序一致，销毁后清理监听。复验目录 `/workspace/work/native-validation/g0-five-slot-5pjPVQ`。
- PC 官方客户端待验，当前 Linux 环境缺少 Windows 沙箱与可用官方客户端。
- 手机官方客户端待验，当前环境缺少可访问同一隔离关卡的移动客户端。
<!-- SECTION:NOTES:END -->
