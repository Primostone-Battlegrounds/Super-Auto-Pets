# QA

`sh scripts/check.sh` 运行 Backlog 校验和仓库内的 Lua 测试。需要 Lua 5.4 与 Backlog.md 1.53.0。CI 预期在每个指向 `develop` 的 PR 上报告 `Project checks`。

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

## 正式 CD 验收

`Game delivery` 在 `develop` 更新后对该次提交构建、回读并核对 `SHA256SUMS`。每次成功运行发布一个 ZIP，解压后导入 `super-auto-pets.gil`。ZIP 同时含 `BUILD.json`、验收说明以及夹具许可。历史候选继续通过 PR 检查提供隔离验证。[固定下载入口](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/actions/workflows/game-delivery.yml?query=branch%3Adevelop)

首次托管交付提取自合入提交 `a23f1bef22a5595528ce7333c852892e77547cc9`。已从 GitHub 取回 ZIP，核对 GitHub 归档散列、五项根目录文件、包内四项校验和与 `BUILD.json` 的 Git SHA。[首次成功运行](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/actions/runs/45324002378)

同次运行的原生手动重跑也已成功。重跑按原始提交构建，并用新制品替换同名旧制品。已取回重跑 ZIP，确认该次运行仍只有一个制品，且提交和校验和均正确。当前默认分支为 `main`，网页新建 `workflow_dispatch` 运行需要在默认分支注册工作流。有 Actions 写权限的维护者可从已有运行手动重跑。[重跑记录](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/actions/runs/45324002378/attempts/2) · [GitHub 触发说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)

## 多人和六阶复验

双人、八席 Lua 套件从空阵容执行经营和权威结算，验证异步请求、定向商店、相同对局回放及终局。八席按 1 至 8 个真人席位运行固定种子，记录逻辑机器人数、轮空、中途退出、同轮淘汰和排名。用 `lua5.4 -E scripts/audit-room.lua 32 release host` 核对实际宿主生成的定向帧和资源指标。[八席负载记录](design/ROOM-LOAD.md) · [双人复验](../platform/M2-host.md) · [八席复验](../platform/M3-host.md)

千星原生证据在各包内记录图的挂载、节点数量、信号来源与接收者、读取的控件和模拟轨迹。实机分别记录客户端版本、设备、GIL SHA-256、账号权限、日志和实测耗时。[双人验收](../platform/M2.md) · [八席对局验收](../platform/M3-native-room.md) · [八席平台能力](../platform/M3.md) · [六阶 PC 与手机验收](../platform/M4.md)

## 项目负责人验收顺序

使用同一个 `super-auto-pets.gil` 完成单人 AI 练习、好友 1v1 和八人吃鸡。执行顺序和留档项目见 [统一 GIL 官方客户端验收](../platform/GAME.md#官方客户端验收)。上方的内部候选继续用于定位独立的规则、界面和设备问题。

`tests/native/verify-game.mjs` 在同一 GIL 中检查五张挂载图、模式和私有信号绑定、界面和 Lua 原文回读，并复用六阶双人、八席和练习回归。它在隔离目录输出基于回读控件和脚本输入的 `frames.json`，可沿用本文的两种画布渲染命令。真机结果单独记录。

## 单局成品复核

成品候选由未参与实现的 Agent 在同一提交独立实跑。覆盖首轮操作能否发现、胜负和平局、低金币恢复、成长反馈、玩家策略差异与设备候选包。同一候选另做美术复核。两项均通过且只剩官方导入、输入和画面核验时，在 PR 记录结论、完整 SHA 与证据。设备验收仍按 [PC 和手机步骤](../platform/M1.md#官方客户端待验) 记录。

用 `lua5.4 scripts/audit-balance.lua` 在种子 1 至 64 检查五种玩家策略、训练回放和编队多样性。候选胜线可用 `lua5.4 scripts/audit-balance.lua carry 1 | lua5.4 scripts/play.lua 1` 复现。用 `lua5.4 scripts/audit-balance.lua trace 1 4 swarm` 导出固定的四轮养成轨迹。轨迹从两支空队重算商店、训练战斗和各轮状态。用 Lua 5.3 执行相同命令可核对跨版本输出。

用 `lua5.4 scripts/audit-balance.lua versus-random 128` 复验三种 AI 策略。双方以相同商店种子从空队经营至第 12 轮，交换战斗双方位置各跑一次。随机购物会优先补充阵容，按合法选项购买、合成、喂食和刷新。输出平局计半分的得分率、第 12 轮阵容组合数和最常见组合的占比。

## 原生画面复验

[目录图鉴](media/m1-animal-art.webp) 从同一份 Lua 图元数据绘制。动物、召唤物与食物图标均由项目原创几何构成。千星使用原生实色色块和圆点，图鉴分别以 66 和 44 像素检查造型。

运行 [M1 验证](../platform/M1.md) 生成 `frames.json`。可用 Python 3、Pillow 和已安装的中文字体将游戏从 GIL 读回后的模拟帧输出为 PNG。

```sh
python3 scripts/render-native-previews.py /path/to/frames.json /tmp/auto-pets-mobile
python3 scripts/render-native-previews.py /path/to/frames.json /tmp/auto-pets-pc --desktop
```

### 画面对照与独立评审

以 [Steam 官方参照](REFERENCE_MATRIX.md#steam-官方参照) 和当前提交的运行结果核对商店、阵容、交战与结算。后续变更在对应任务或 PR 记录具体官方来源、核实的行为、项目取舍和复验命令。历史稿保留 Git 提交，并在原入口标明停用。

独立美术复核对照 Steam 截图能支持的视觉要点，确认动物是画面焦点、轮廓可辨且朝向一致、技能提示靠近选中对象、双方前排相向，以及攻血和受击反馈容易扫读。直接检查 PC、手机和缩小后的手机帧。用 GIL 回放实际检查出击与受击时序，并记录参考证据和任何访问缺口。

| 场景 | 通过条件 |
| --- | --- |
| 动物图鉴 | 商店和己方都使用右向姿态。同种资产在头像尺寸仍有清楚的头、眼和重心。按当前运行目录逐一核对 9 种动物、3 种召唤物与 6 种食物的小尺寸轮廓。Turtle 的研究节点和原版金样见 [覆盖表](design/TURTLE-COVERAGE-v1.md)。 |
| 本地电脑对手 | 同种子、同一轮的阵容不随玩家刷新或购买变化。准备和战斗能识别电脑对手。 |
| 商店 | 先看到己方五格和动物，再看到下方货架。动物头像约 64 像素或更大，攻、命、等级、价格和冻结状态易读，选中动物可看到技能。金币、胜场、生命、轮次固定在顶部。拖放购买、喂食、合并或调位，拖到阵容外取消。点击操作也能完成。 |
| 战斗 | 双方分区，前排靠近交战中心，左右动物朝向对手。受击、格挡、退场和召唤由战斗状态驱动，实际扣血同时体现在数字和血条上。自动、暂停、逐条和跳过控件保持可用。 |
| 结算 | 胜利与落败各有清楚的结算，大字可读。核对菜单继续、取消与确认放弃。终局保留同种种子和新种子入口。 |
| 画布 | 在 1600×900 和 1280×720 的回读模拟帧分别检查文字、图标和命中区域，无跨区遮挡或出界。 |

独立评审者用同一候选的图鉴、商店、有效伤害、胜利和落败画面逐项给出结论，并附对应帧、提交 SHA 与完整单局日志。官方设备的输入和实际渲染另行验收。

以下样例图为历史 PR #7 的 `4149416`。当前提交用候选中的 `frames.json` 及对应生成画面验收。[移动画布商店、召唤、战斗和结算](media/m1-visual-proof.webp) · [PC 画布五对五](media/m1-desktop-battle.webp)
