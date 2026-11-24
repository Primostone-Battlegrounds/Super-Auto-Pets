# 参照矩阵

查证于 2026-11-24。Team Wood Games 的 Steam 商店说明确认 Arena 是无计时的异步多人模式，玩家争取在耗尽心数前取得 10 胜。该说明将 Standard packs 描述为预设动物包。页面标注的 2021-09-24 为发行日期。各版本已确认的规则见下表，当前原版客户端构建号和同版 Turtle 运行记录尚未取得。[Steam 商店说明](https://store.steampowered.com/app/1714040/Super_Auto_Pets/?l=schinese#about)

## Steam 官方参照

| 来源 | 可确认的内容 |
| --- | --- |
| [Steam 中文页](https://store.steampowered.com/app/1714040/Super_Auto_Pets/?l=schinese#about) | Arena 无回合计时，异步对战，目标是在生命耗尽前取得 10 胜。 |
| [开发者 itch.io 页面](https://teamwood.itch.io/super-auto-pets) | 提供浏览器入口，确认 Arena 无回合计时并采用异步对战。页面条目列明鼠标输入。 |
| [官方商店截图](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1714040/ss_f61be4caff97d77b7df02bcdadee2687232e991f.1920x1080.jpg?t=1680944541) | 五格阵容与下方货架分开，界面显示资源和技能提示。 |
| [官方交战截图](https://cdn.cloudflare.steamstatic.com/steam/apps/1714040/ss_75e2d405204fa963fc6d5cb99c272c15f0f6dcc3.1920x1080.jpg?t=1660917023) | 两队相向，前排靠交战中央，单位附近显示攻命和等级。 |
| [Arena v44 官方公告](https://steamcommunity.com/games/1714040/announcements/detail/501718945006355542) | Normal 等难度影响对手阵容强度。 |
| [Daily 官方公告](https://steamcommunity.com/app/1714040/announcements/) | 所有玩家当天面对同样的 14 支队伍，队伍每日更换。公告未说明这些阵容的生成算法。 |

## Arena Normal 五项核对

原版复验入口为 Steam App 1714040 的 Arena，选择 Normal 和 Standard 的 Turtle Pack。下表按公告注明的版本记录。2023-06-08 的 0.27 开发者公告全文可在 SteamDB 的 Steam 公告存档复查，存档记录 Build 11422935。v44 的 2025-12-19 公告描述了难度改动，公开正文未提供 Steam Build ID。项目侧核对基于 `1e280ce63e89b6576858c3aaa0c8fe3d8635eeff`，命令在仓库根目录执行。[Steam 商店](https://store.steampowered.com/app/1714040/) [0.27 公告](https://steamcommunity.com/games/1714040/announcements/detail/3698065064748065722) [0.27 存档](https://steamdb.info/patchnotes/11422935/) [v44 公告](https://steamcommunity.com/games/1714040/announcements/detail/501718945006355542) [v44 官方新闻正文](https://steamcommunity.com/app/1714040/allnews)

| 项目 | 公开原版证据 | 项目现值与离线复验 |
| --- | --- | --- |
| 商店阶级与货架 | 0.27 调整食物容量在第三阶增加，刷新结果按阶排序，补货保留冻结项。公告未列每轮解锁表、全部货位数或抽样权重。[0.27 公告存档](https://steamdb.info/patchnotes/11422935/) | M1 兼容规则在第 1、3、5 轮开放第 1–3 阶。六阶目录再于第 7、9、11 轮开放第 4–6 阶。两套目录均固定 3 个动物位和 2 个食物位，未冻结格独立从已解锁池等权抽取，保留冻结项。`lua5.4 -E tests/shop.lua` 检查开轮、容量和冻结。`lua5.4 -E tests/release_content.lua` 对 64 个种子检查至第 14 轮。 |
| 升级与奖励 | 0.27 将合并后的经验改为较高一方加 1，二、三级给两项商店奖励，两只二级合并无奖励。公告未列奖励候选的阶级上限、价格和显示生命周期。[0.27 公告存档](https://steamdb.info/patchnotes/11422935/) | 合并经验累加再加 1，上限 5 XP。等级门槛为 0、2、5 XP。每跨一级产生一个 3 金的额外动物，阶级为当轮商店阶级加一并封顶。刷新保留奖励，开新轮清空。`lua5.4 -E tests/shop.lua` 检查首次升级、刷新与三级封顶。`lua5.4 -E tests/release_content.lua` 检查高阶提前出现、购买和六阶封顶。 |
| 碰撞与触发顺序 | 0.23 修复部分阵亡技能未遵循高攻击优先。0.27 允许特定攻击后、击倒和受伤技能在阵亡时触发。v44 修复防守方跳跃攻击的攻击前触发。公告未给同攻、双边同时阵亡和召唤的完整顺序。[0.23 官方新闻](https://store.steampowered.com/news/posts/?enddate=1666599301&feed=steam_community_announcements) [0.27 公告存档](https://steamdb.info/patchnotes/11422935/) [v44 官方新闻正文](https://steamcommunity.com/app/1714040/allnews) | 开场技能按原站位从前到后，同格两方按种子确定先后。每次前排相撞先声明双方攻击，再记双方伤害与溅射，处理存活单位的受伤技能，清理双方阵亡后依次执行阵亡效果和补位。`lua5.4 -E tests/battle.lua` 检查开场先后、同归、阵亡批次和召唤位置。`lua5.4 -E tests/release_content.lua` 检查六阶技能的伤害批次、受伤、阵亡与召唤。 |
| 结算 | 未标构建号的 Steam 商店说明为十胜或耗尽生命。2023-01-11 Golden Pack 公告记录该次生命系统从 5 命开始，每负扣 1 命，第 3 轮补 1 命。第三轮补命在当前 Normal 的状态待核。[Steam 商店说明](https://store.steampowered.com/app/1714040/#about) [Golden Pack 公告](https://steamcommunity.com/games/1714040/announcements/detail/3674407853169874545) | 5 命起步，每负扣 1 命，每胜增 1 胜，平局和第三轮开轮均维持数值，十胜或零命终局。`lua5.4 -E tests/run.lua` 用种子 1 复验平局、五负和第 12 轮十胜，并逐轮检查结算与开轮。 |
| Normal 对手强度 | v44 将对手阵容的总体强度交由所选 Arena 难度决定。改动前大致按玩家经验匹配。公告没有披露 Normal 的抽样、强度区间或分回合阵容分布。[v44 公告](https://steamcommunity.com/games/1714040/announcements/detail/501718945006355542) [v44 官方新闻正文](https://steamcommunity.com/app/1714040/allnews) | 单人默认标准，可选入门。回合、独立种子与策略决定本地训练对手。标准更重视升阶、阵容协同和站位，入门更重视弱位培养和谨慎换宠，两者共用经营和战斗规则。`lua5.4 -E tests/bot.lua` 检查合法行动及同种子轨迹。`lua5.4 -E scripts/audit-balance.lua difficulty 64` 对照三阶目录两种策略，`lua5.4 -E scripts/audit-balance.lua release 128` 对照六阶目录。 |

项目固定种子实验按胜 1 分、平 0.5 分统计。同流派标准对入门在三阶目录得到 82.5%–87.1% 的对战积分，在六阶目录得到 82.2%–88.3%。两场实验都使用相同商店种子及互换交战双方的复验，六阶实验在 128 个种子上共运行 36,864 场战斗。[离线平衡脚本](../scripts/audit-balance.lua)

### 同一构建的原版复验输入

未来重新评估历史 Arena 时，先记录 Steam Build ID、游戏内版本、日期、模式和包名。在该构建留存第一至第三轮的完整货架、冻结与刷新前后和初次升级的奖励，补录后续各阶首次开放回合及最高阶升级。记录一场负局、平局和终局的生命与胜场变化，并保留双方初始阵容、首次相撞、双边阵亡及召唤的逐事件回放。再按轮次保存多局 Normal 的对手阵容、攻命、等级、胜场和样本量。单张截图可核对当时可见字段，匹配分布需要多局样本。公开公告已能确认奖励数量、第三阶食物容量和结算存在历史差异。当前首发规则采用项目原创目录和本地策略，Arena 历史阵容仍属后续研究。[项目产品定义](PRODUCT.md) [Turtle 复验输入](design/TURTLE-COVERAGE-v1.md#跨条目与闭包输入)

## 当前候选与历史研究

[Turtle 研究覆盖表 v1](design/TURTLE-COVERAGE-v1.md) 记录带日期的 60 个常规宠物、18 个常规食物及可达生成物与状态。运行映射、Steam 行为金样与完整引用闭包仍待验证。下表记录 M1 兼容目录及本作玩法边界。[REASONS v1](design/REASONS-v1.md)

## M1 兼容规则

| 项目 | 开发基线 | 设计依据 |
| --- | --- | --- |
| 准备与交战 | 每轮先经营商店与排列阵容，再自动交战 | 项目产品定义采用 Arena 的轻量自动战斗体验。[项目产品定义](PRODUCT.md) [Steam 商店说明](https://store.steampowered.com/app/1714040/Super_Auto_Pets/?l=schinese#about) |
| 对手 | 回合、独立种子与本地策略决定同轮合法养成的对手 | 项目产品定义要求单人、可复现的流程。[项目产品定义](PRODUCT.md) |
| 终局 | 以 5 命开始，10 胜或零命结束；每次失败扣 1 命，平局维持胜数与命数 | 胜数和命数目标由项目产品定义确定；失败与平局的结算是本项目的开发规则。[项目产品定义](PRODUCT.md) |
| 阵型 | 五个从前到后排列的位置 | 五格阵容来自项目产品定义，前后顺序是本项目的战斗接口。[项目产品定义](PRODUCT.md) [项目架构](ARCHITECTURE.md) |
| 商店 | 每轮 10 金，3 个动物位、2 个食物位；刷新 1 金，购买动物或食物各 3 金；出售按每级 1 金返还 | 本项目的经济起点保留多次刷新或购买空间。[规则配置](../src/autopets/data.lua) |
| 解锁 | 第 1、3、5 轮分别解锁 1、2、3 阶，常规货架可抽取已解锁阶级 | 本项目三阶进度在前五轮逐步开放目录。[规则配置](../src/autopets/data.lua) |
| 成长 | 同名合成增加攻击和生命各 1 点，等级累计 XP 门槛为 0、2、5；升级提供一个额外原价动物，阶级为已解锁阶级加一且至多三阶 | 本项目让合成改善现有阵容并提前看见高阶选择。[规则配置](../src/autopets/data.lua) |
| 动物 | 三阶共九种原创动物，每阶均有防御、突击、召唤流派 | 覆盖三条对手生成路径，每个流派有独立战斗效果。[动物目录](../src/autopets/data.lua) |
| 食物 | 三阶共六种原创食物，永久调整目标的攻击或生命 | 攻防取向由食物数值表达，目录和名称由项目定义。[食物目录](../src/autopets/data.lua) |
| 召唤 | 三种由阵亡效果生成的原创单位，攻击随来源等级成长 | 公开货架目录由可买动物组成，召唤单位的数值独立定义。[召唤目录](../src/autopets/data.lua) |
| 资产 | 当前规则交付使用原创中文名称与数值。外部图像、语音和界面资源的授权状态待核验 | 项目产品定义要求原创或经授权资源。[项目产品定义](PRODUCT.md) |
| 里程碑版本 | G0 的历史开发标识为 0.0.1-alpha.0 | 交付版本与里程碑对应记录在项目表与 Backlog。[项目产品定义](PRODUCT.md) |

随机模块接受任意 Lua 5.4 有符号整数种子。零以及模数的倍数映射到状态 1。`next()` 返回 1 至 2147483646。`int(low, high)` 在含两端的整数范围内采样，范围内最多容纳 2147483646 个值，两端须落在 -2147483646 至 2147483646 之间。

## 玩法源码核对

| 候选 | 授权与移植评估 |
| --- | --- |
| Team Wood Games 原版 | 官方资料用于核对 Arena 和 Standard pack 定义。本轮未找到开发者公开授权的原版玩法源码。[开发者页面](https://teamwoodgames.com/super-auto-pets/) [Steam 商店说明](https://store.steampowered.com/app/1714040/Super_Auto_Pets/) |
| `sapai` 社区模拟器 | MIT 许可。固定版本为 2023 年的 Python 包，包含原版内容数据和社区模拟测试。引擎与目录依赖 Python 和原版数据模型，直接移植需要重写接口与内容。[源码与授权](https://github.com/manny405/sapai/tree/3850d25b1646aa9f8696306c6b8df2a2f7b6aecd) |
| `auto-auto-battler` 社区模拟器 | GPL-3.0，面向原版模拟与训练。当前无 Lua 移植，未引入代码或原版内容。[源码与授权](https://github.com/hellbound22/auto-auto-battler) |
| `auto-magical-animal` | 同类名称的 Go/Ebiten 守屋游戏。所查版本根目录无许可文件，机制与本项目的回合商店和五格战斗不同。[源码](https://github.com/Amovement/auto-magical-animal/tree/4eb4b3b35a6f6d11c171f2469bf66ba5289359f1) |
| `roguelite-core` | MIT 许可、内容可替换的 TypeScript 自动交战库。其关卡图、属性克制和对战规则不符合本项目的 Lua 五格交战模型。[源码与授权](https://github.com/tiagomaciels/roguelite-core/tree/65d68588c6f8576540fed7589fc6baa8ffa54e3f) |

M1 GIL 使用本仓库的兼容目录，首发单人练习候选使用原创六阶目录。构建工具链使用固定版本的社区千星 MCP。旧 PR #5 的样本数量与允许轻改的映射均已失效。其来源定位与实测方法仍可用于研究。[M1 候选](../platform/M1.md) [六阶单人练习候选](../platform/M4.md) [PR #5](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/pull/5) [美术工艺](ART_PIPELINE.md)
