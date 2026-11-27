---
id: TASK-41
title: 真机 NO-GO 整改与五层交付门禁
status: In Progress
assignee:
  - '@FurinyaDev'
created_date: '2026-11-25 15:40'
updated_date: '2026-11-27 03:39'
labels:
  - device-qa
  - design-v2.0.0
  - v0.6.0
dependencies: []
references:
  - docs/design/manifest.json
  - docs/PRODUCT.md
priority: high
type: feature
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design-Version: v2.0.0

真机验收 NO-GO。本任务跟踪统一六阶 GIL 的产品整改、原版参照治理、实际运行验收与独立评审。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 唯一设计入口校验 Active、历史不可覆盖和候选引用
- [x] #2 每个发布候选绑定产品版本、原版参照版本、Git SHA、设计版本与 GIL SHA-256
- [ ] #3 三种模式均通过实际可用的黑盒和视觉验收层；官方 PC、手机、多人缺证显示为待验
- [ ] #4 精确候选通过必要 CI 与未参与实现的主力评审后集成 develop
- [ ] #5 v0.6.0 八人模式的主菜单、商店与阵容、战斗表现、结算有精确候选的离线证据，真机证据独立记录。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
并行固定原版及千星参照、制作完整 HTML 原型、修复多人和原生文本、执行 Simulator 与隔离正式构建；统一验证、独立评审候选和画面，再根据门禁集成。

v0.5.0 one-shot（366bb4189b685629e459ce8f86d19e9aa5317b9c）：T01/T02 独立核查，再分路径整改大厅、商店与战斗，同时完善 GIL CD。精确 SHA 独立复验后走 develop PR；官方设备待验单列。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
开发基线 ab73443adee5a2b5b37268779356c2fe67220886。固定版本 Simulator 复现 989 次零行文字与 Practice 第二轮 string.pack 失败。集成切片已跑通五尺寸各 15 轮练习，处理多人文字后重跑整包。原版 WebGL、官方 PC/手机/多人缺证保持待验。

固定 Steam 官方短片与十个时间点，保留当前客户端及包版本未知的证据边界。三种模式统一动物技能文案。联机商店增加只读能力查看，联机回放按核对过的战斗事件呈现。候选交付工作流复跑 Lua 与实际 Simulator，成品门禁继续分列官方环境与原版同版操作证据。

v0.5.0：CD 基线 366bb41 已回下载并校验。Simulator 复现能力未知时仍发送多人开局，原生文件格式未见损坏。官方多人房主可不在场，应用内发起资格以服务端快照为准。官方 PC、手机、真人联机和原作同版未验；拖动结束与取消在暂有运行证据中无法区分，按安全确认路径验收并单列待验项。

三模式验收条件及 v0.5.0 证据作为历史保留；本版范围以 docs/PRODUCT.md 及其引用的正式构建清单为准。
<!-- SECTION:NOTES:END -->
