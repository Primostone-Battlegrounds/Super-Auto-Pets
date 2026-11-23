---
id: TASK-24
title: Engineering / QA · 千星设备验收候选包
status: Done
assignee:
  - '@FurinyaDev'
created_date: '2026-11-23 03:18'
updated_date: '2026-11-23 03:29'
labels: []
milestone: m-1
dependencies:
  - TASK-2
  - TASK-19
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 情况
隔离构建已生成并读回 GIL，当前交付需要从 GitHub 拿到可核对版本的真机候选。

## 任务
在现有验证入口生成可下载、可追溯的设备验收包。目标 M1 0.1.0-alpha.0。

## 边界
使用隔离夹具与现有 CI。真机导入及游玩已有单独的验收任务。

## 验收
包内 GIL 与回读校验相同且有 SHA-256、源提交和 PC/手机验收说明。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 当且仅当 GIL 构建、读回与测试成功后，可从 CI 下载对应版本候选包并验证完整性。
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
复用现有读回验证导出后置候选包。记录可核对的 Git SHA 和 GIL 校验值，纳入同一 CI 并验证可复现。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
GitHub Actions 45106026588 实际通过并上传 14787229215。下载连接器返回 ZIP；上传前核验 GIL SHA-256。本地重建包校验通过，关卡人数读回为 1。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
设备候选包随通过检查的 Git 提交生成，含 GIL、源码 SHA、SHA-256、模拟日志和设备检查入口。
<!-- SECTION:FINAL_SUMMARY:END -->
