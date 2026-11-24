# 小动物自走棋

面向千星奇域的轻量 2D 多人自走棋。八人吃鸡支持至少一名真人与机器人补位。好友 1v1、单人 AI 练习与好友房间同属首发范围。真人与机器人使用同一套商店、队伍和战斗规则。[产品范围](docs/PRODUCT.md)

## 开发入口

- 从仓库根目录运行 `lua5.4 scripts/play.lua 7 --release --beginner` 进入六阶练习，输入 `help` 查看操作。省略选项可进入兼容目录和默认难度。
- 安装 Backlog.md 1.53.0 后运行 `LUA=lua5.4 sh scripts/check.sh` 进行回归。
- 用 `lua5.4 -E scripts/audit-room.lua 32 release host` 复验八席六阶权威宿主。覆盖 1 至 8 个真人席位，按输出报告核对排名、回放和消息数。[八席负载记录](docs/design/ROOM-LOAD.md)

## 千星候选

- [兼容单人练习](platform/M1.md) · [六阶单人练习](platform/M4.md)
- [双人 Lua 权威宿主](platform/M2-host.md) · [双人千星候选](platform/M2.md)
- [八席 Lua 权威宿主](platform/M3-host.md) · [八席千星对局候选](platform/M3-native-room.md) · [平台能力样本](platform/M3.md)
- [原生商店样本](platform/VERSUS-SHOP.md) · [原生战斗样本](platform/M3-collision.md)

工程集成使用 `develop`。隔离 GIL 从对应提交的 `Project checks` 产物下载，设备实测按包内步骤记录。[CI 构建和候选包](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/actions/workflows/project-checks.yml)

项目版本、研究覆盖和验收参见 [REASONS v1](docs/design/REASONS-v1.md)、[Turtle 覆盖表](docs/design/TURTLE-COVERAGE-v1.md) 和 [QA](docs/QA.md)。[项目权威表](https://docs.google.com/spreadsheets/d/15V7Qj105fAavPajRsUhblu4KC3Zw72T9Q3iad2D6-M4/edit)
