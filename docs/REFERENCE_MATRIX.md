# 参照矩阵

查证于 2026-11-23。Team Wood Games 的 Steam 商店说明确认 Arena 是无计时的异步多人模式，玩家争取在耗尽心数前取得 10 胜。该说明将 Standard packs 描述为预设动物包。页面标注的 2021-09-24 为发行日期。Arena 与 Standard pack 的客户端构建号、具体规则版本与完整目录待核验。[Steam 商店说明](https://store.steampowered.com/app/1714040/Super_Auto_Pets/?l=schinese#about)

## Steam 官方参照

| 来源 | 可确认的内容 |
| --- | --- |
| [Steam 中文页](https://store.steampowered.com/app/1714040/Super_Auto_Pets/?l=schinese#about) | Arena 无回合计时，异步对战，目标是在生命耗尽前取得 10 胜。 |
| [开发者 itch.io 页面](https://teamwood.itch.io/super-auto-pets) | 提供浏览器入口，确认 Arena 无回合计时并采用异步对战。页面条目列明鼠标输入。 |
| [官方商店截图](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1714040/ss_f61be4caff97d77b7df02bcdadee2687232e991f.1920x1080.jpg?t=1680944541) | 五格阵容与下方货架分开，界面显示资源和技能提示。 |
| [官方交战截图](https://cdn.cloudflare.steamstatic.com/steam/apps/1714040/ss_75e2d405204fa963fc6d5cb99c272c15f0f6dcc3.1920x1080.jpg?t=1660917023) | 两队相向，前排靠交战中央，单位附近显示攻命和等级。 |
| [Steam 官方公告](https://steamcommunity.com/app/1714040/announcements/) | v44 公告说明 Arena 的 Normal 等难度影响对手阵容强度。Daily 公告确认所有玩家当天面对同样的 14 支队伍，队伍每日更换。公告未说明这些阵容的生成算法。 |

## 项目规则

| 项目 | 开发基线 | 设计依据 |
| --- | --- | --- |
| 准备与交战 | 每轮先经营商店与排列阵容，再自动交战 | 项目产品定义采用 Arena 的轻量自动战斗体验。[项目产品定义](PRODUCT.md) [Steam 商店说明](https://store.steampowered.com/app/1714040/Super_Auto_Pets/?l=schinese#about) |
| 对手 | 回合、种子和流派决定本地 PvE 阵容 | 项目产品定义要求单人、可复现的流程。[项目产品定义](PRODUCT.md) |
| 终局 | 以 5 命开始，10 胜或零命结束；每次失败扣 1 命，平局维持胜数与命数 | 胜数和命数目标由项目产品定义确定；失败与平局的结算是本项目的开发规则。[项目产品定义](PRODUCT.md) |
| 阵型 | 五个从前到后排列的位置 | 五格阵容来自项目产品定义，前后顺序是本项目的战斗接口。[项目产品定义](PRODUCT.md) [项目架构](ARCHITECTURE.md) |
| 商店 | 每轮 10 金，3 个动物位、2 个食物位；刷新 1 金，购买动物或食物各 3 金；出售按每级 1 金返还 | 本项目的经济起点保留多次刷新或购买空间。[规则配置](../src/autopets/data.lua) |
| 解锁 | 第 1、3、5 轮分别解锁 1、2、3 阶，常规货架可抽取已解锁阶级 | 本项目三阶进度在前五轮逐步开放目录。[规则配置](../src/autopets/data.lua) |
| 成长 | 同名合成增加攻击和生命各 1 点，等级累计 XP 门槛为 0、2、5；升级提供一个额外原价动物，阶级为已解锁阶级加一且至多三阶 | 本项目让合成改善现有阵容并提前看见高阶选择。[规则配置](../src/autopets/data.lua) |
| 动物 | 三阶共九种原创动物，每阶均有防御、突击、召唤流派 | 覆盖三条对手生成路径，每个流派有独立战斗效果。[动物目录](../src/autopets/data.lua) |
| 食物 | 三阶共六种原创食物，永久调整目标的攻击或生命 | 攻防取向由食物数值表达，目录和名称由项目定义。[食物目录](../src/autopets/data.lua) |
| 召唤 | 三种由阵亡效果生成的原创单位，攻击随来源等级成长 | 公开货架目录由可买动物组成，召唤单位的数值独立定义。[召唤目录](../src/autopets/data.lua) |
| 资产 | 当前规则交付使用原创中文名称与数值。外部图像、语音和界面资源的授权状态待核验 | 项目产品定义要求原创或经授权资源。[项目产品定义](PRODUCT.md) |
| 里程碑版本 | G0 临时开发标识为 0.0.1-alpha.0；项目权威表的正式版本待读取 | 以项目权威表为准，访问仍受阻。[项目产品定义](PRODUCT.md) |

随机模块接受任意 Lua 5.4 有符号整数种子。零以及模数的倍数映射到状态 1。`next()` 返回 1 至 2147483646。`int(low, high)` 在含两端的整数范围内采样，范围内最多容纳 2147483646 个值，两端须落在 -2147483646 至 2147483646 之间。

## 玩法源码核对

| 候选 | 授权与移植评估 |
| --- | --- |
| Team Wood Games 原版 | 官方资料用于核对 Arena 和 Standard pack 定义。本轮未找到开发者公开授权的原版玩法源码。[开发者页面](https://teamwoodgames.com/super-auto-pets/) [Steam 商店说明](https://store.steampowered.com/app/1714040/Super_Auto_Pets/) |
| `sapai` 社区模拟器 | MIT 许可。固定版本为 2023 年的 Python 包，包含原版内容数据和社区模拟测试。引擎与目录依赖 Python 和原版数据模型，直接移植需要重写接口与内容。[源码与授权](https://github.com/manny405/sapai/tree/3850d25b1646aa9f8696306c6b8df2a2f7b6aecd) |
| `auto-auto-battler` 社区模拟器 | GPL-3.0，面向原版模拟与训练。当前无 Lua 移植，未引入代码或原版内容。[源码与授权](https://github.com/hellbound22/auto-auto-battler) |
| `auto-magical-animal` | 同类名称的 Go/Ebiten 守屋游戏。所查版本根目录无许可文件，机制与本项目的回合商店和五格战斗不同。[源码](https://github.com/Amovement/auto-magical-animal/tree/4eb4b3b35a6f6d11c171f2469bf66ba5289359f1) |
| `roguelite-core` | MIT 许可、内容可替换的 TypeScript 自动交战库。其关卡图、属性克制和对战规则不符合本项目的 Lua 五格交战模型。[源码与授权](https://github.com/tiagomaciels/roguelite-core/tree/65d68588c6f8576540fed7589fc6baa8ffa54e3f) |

本项目的 Lua 玩法代码沿用本仓库的原创规则与数据。工具链单独复用已固定版本的社区千星 MCP。
