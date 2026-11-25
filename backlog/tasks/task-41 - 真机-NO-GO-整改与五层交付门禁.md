---
id: TASK-41
title: 真机 NO-GO 整改与五层交付门禁
status: In Progress
assignee: []
created_date: '2026-11-25 15:40'
labels:
  - device-qa
  - design-v2.0.0
dependencies: []
references:
  - docs/design/manifest.json
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
- [ ] #1 唯一设计入口校验 Active、历史不可覆盖和候选引用
- [ ] #2 每个发布候选绑定产品版本、原版参照版本、Git SHA、设计版本与 GIL SHA-256
- [ ] #3 三种模式均通过实际可用的黑盒和视觉验收层；官方 PC、手机、多人缺证显示为待验
- [ ] #4 精确候选通过必要 CI 与未参与实现的主力评审后集成 develop
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
并行固定原版及千星参照、制作完整 HTML 原型、修复多人和原生文本、执行 Simulator 与隔离正式构建；统一验证、独立评审候选和画面，再根据门禁集成。
<!-- SECTION:PLAN:END -->
