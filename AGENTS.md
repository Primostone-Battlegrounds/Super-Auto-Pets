# 小动物自走棋

- 项目方向见 [产品](docs/PRODUCT.md)，模块接口见 [架构](docs/ARCHITECTURE.md)，验收分层见 [QA](docs/QA.md)。
- 使用 Backlog.md 1.53.0 管理任务、依赖、状态和里程碑。先运行 `backlog instructions overview`，按操作读取对应指引。用 CLI 修改 Backlog。
- 每个执行者使用独立 worktree、短分支和明确文件所有权。PR 指向 `develop`，记录 Work-Item、测试和待验项。当前 PR SHA 的必要 CI 与独立评审均通过后再集成。由未参与该变更实现的子 Agent 评审，并在 PR 记录评审者、完整 SHA、验证和结论。仓库原生保护以 GitHub 的有效配置为准。
- 千星验证使用隔离副本。正式存档、发布和 Owner 桌面需要单独授权。
