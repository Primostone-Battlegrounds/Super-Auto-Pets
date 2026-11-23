# QA

`sh scripts/check.sh` 运行 Backlog 校验和仓库内的 Lua 测试。需要 Lua 5.4 与 Backlog.md 1.53.0。没有 Lua 测试时该入口仅验证工程基础。CI 预期在每个指向 `develop` 的 PR 上报告 `Project checks`。

| 验收层 | 证据 |
| --- | --- |
| 源码测试 | 精确分支 SHA、命令、退出状态和确定性回放。 |
| 模拟器 | 隔离会话或终端中实际执行的输入路径与结算结果。 |
| 原生 GIL | 工具版本、隔离样本、构建结果和读回的 Lua/布局绑定。 |
| PC 实机 | 官方客户端记录输入、显示、日志与结果。 |
| 移动实机 | 官方移动客户端独立记录触控、显示、日志与结果。 |

OpenHarness 固定到 `aebb0c2255a5df275491009285c1a23d03f90771`，使用 cooperative 模式。运行 `openharness --repo . entry` 和 `openharness --repo . doctor` 读取当下权限和缺口。分支保护和 Required Checks 以 GitHub 实际配置为准。

本环境中 GitHub CLI 的 API 请求返回 403。Git 原生传输和 GitHub 连接器需各自验证，CLI 权限缺口保留在 Doctor 中。
