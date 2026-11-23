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

## PR 集成

独立子 Agent 可完成项目评审。由评审者检查当前 PR 提交的变更，记录角色、完整 head SHA、执行的检查、结果以及发现的问题。主控将记录写入 PR，解决阻断问题，并核对同一 SHA 的 `Project checks` 后执行 GitHub PR 合并。提交或合并候选发生变化时，重新核对受影响的验证及评审。

项目接受上述子 Agent 评审证据。另一个 GitHub 账号的 `Approve` 仅在仓库服务端保护要求时才需要。OpenHarness cooperative 沿用本项目的评审与 CI 流程。

GitHub CLI API 不可用时，保留 Doctor 中的观察缺口，使用 GitHub 连接器核对 PR、当前 SHA 和 CI，通过同一 GitHub PR 完成集成。
