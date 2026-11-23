# QA

`sh scripts/check.sh` 运行 Backlog 校验和仓库内的 Lua 测试。需要 Lua 5.4 与 Backlog.md 1.53.0。没有 Lua 测试时该入口仅验证工程基础。CI 预期在每个指向 `develop` 的 PR 上报告 `Project checks`。

| 验收层 | 证据 |
| --- | --- |
| 源码测试 | 精确分支 SHA、命令、退出状态和确定性回放。 |
| 模拟器 | 隔离会话或终端中实际执行的输入路径与结算结果。 |
| 原生 GIL | 工具版本、隔离样本、构建结果和读回的 Lua/布局绑定。 |
| 离线画面 | 用 GIL 回读后的控件树和模拟输入绘制实际状态，对照小尺寸动物轮廓、商店与阵容区分、战斗反馈和结算。 |
| PC 实机 | 官方客户端记录输入、显示、日志与结果。 |
| 移动实机 | 官方移动客户端独立记录触控、显示、日志与结果。 |

OpenHarness 固定到 `aebb0c2255a5df275491009285c1a23d03f90771`，使用 cooperative 模式。运行 `openharness --repo . entry` 和 `openharness --repo . doctor` 读取当下权限和缺口。分支保护和 Required Checks 以 GitHub 实际配置为准。

## PR 集成

独立子 Agent 可完成项目评审。由评审者检查当前 PR 提交的变更，记录角色、完整 head SHA、执行的检查、结果以及发现的问题。主控将记录写入 PR，解决阻断问题，并核对同一 SHA 的 `Project checks` 后执行 GitHub PR 合并。提交或合并候选发生变化时，重新核对受影响的验证及评审。

项目接受上述子 Agent 评审证据。另一个 GitHub 账号的 `Approve` 仅在仓库服务端保护要求时才需要。OpenHarness cooperative 沿用本项目的评审与 CI 流程。

GitHub CLI API 不可用时，保留 Doctor 中的观察缺口，使用 GitHub 连接器核对 PR、当前 SHA 和 CI，通过同一 GitHub PR 完成集成。

## 原生画面复验

[目录图鉴](media/m1-animal-art.webp) 从同一份 Lua 图元数据绘制。动物、召唤物与食物图标均由项目原创几何构成。千星使用原生实色色块和圆点，图鉴分别以 88 和 44 像素检查造型。

运行 [M1 验证](../platform/M1.md) 生成 `frames.json`。可用 Python 3、Pillow 和已安装的中文字体将游戏从 GIL 读回后的模拟帧输出为 PNG。

```sh
python3 scripts/render-native-previews.py /path/to/frames.json /tmp/auto-pets-mobile
python3 scripts/render-native-previews.py /path/to/frames.json /tmp/auto-pets-pc --desktop
```

画面参考用于检查战斗前能否一扫看清队伍、金币和攻防，以及受击后能否跟上棋盘变化。预览覆盖商店、编队、受伤与两种终局，官方设备的输入和渲染另行验收。[原版商店画面参照](https://www.pocketgamer.com/super-auto-pets/best-lineups/)
