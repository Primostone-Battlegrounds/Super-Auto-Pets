# 小动物自走棋

千星奇域轻量 2D 单人 PvE 自走棋。经营商店、布置五格动物阵容，与同轮通过共用商店养成的本地 AI 自动战斗。拿到 10 胜或耗尽 5 命时结算，终局可重开。

## 开发入口

- 在仓库根目录运行 `lua5.4 scripts/play.lua 7`，输入 `help` 查看操作。
- 安装 Backlog.md 1.53.0 后运行 `LUA=lua5.4 sh scripts/check.sh` 进行回归。
- [千星 G0 样本与复验](platform/README.md) · [千星 M1 单局与复验](platform/M1.md)

当前候选使用 M1 兼容目录。工程集成使用 `develop`。版本、研究覆盖与设备验收参见 [REASONS v1](docs/design/REASONS-v1.md)、[Turtle 覆盖表](docs/design/TURTLE-COVERAGE-v1.md) 和 [QA](docs/QA.md)。[项目权威表](https://docs.google.com/spreadsheets/d/15V7Qj105fAavPajRsUhblu4KC3Zw72T9Q3iad2D6-M4/edit)
