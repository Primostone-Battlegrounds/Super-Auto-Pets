# 产品路线图

《小动物自走棋》是千星奇域的轻量 2D 多人自走棋。玩家各自经营商店、培养五格阵容，每轮配对进行自动战斗。

| 阶段 | 产品版本 | 方向 |
| --- | --- | --- |
| Now | v0.6.0 核心体验版 | 主菜单、商店与阵容、战斗表现和结算。围绕八人淘汰赛修正完整对局及已有内容的可玩性。 |
| Next | v0.7.0 内容扩充版 | 60 只动物，美术和构筑丰富度，玩家内测与数值平衡。 |
| Next | v1.0.0 正式首发 | 内测反馈整改、多模式产品范围确认、正式上线。 |
| Later | 产品机会池 | 成长与留存、重复游玩价值、动物扩展包、竞技与社交。 |

当前只细化 v0.6.0。随着证据和反馈积累，再滚动细化后续版本。

## v0.6.0 Backlog

| 工作项 | 验收范围 |
| --- | --- |
| TASK-41 · 界面与交互 | 核对主菜单、商店与阵容、战斗反馈和结算。沿用已批准的项目设计、项目原创美术及千星原生控件。 |
| TASK-34 · 八人吃鸡 | 复验进入房间、开局、机器人补位、整局、退出、异常恢复及最终名次。 |
| TASK-35 · 内容可玩性 | 在批准内容范围内核对商店、技能、数值、构筑和美术。 |

[正式构建清单](../platform/product-release.json)是 v0.6.0 启用模式及内容 ID 的唯一范围来源。好友 1v1 和单人 AI 继续使用内部构建和测试入口。后续版本可独立研发并合入 develop，扩充目录与模式须保留独立入口，使现行候选只绑定到批准范围。产品版本和范围改动通过指向 develop 的 Backlog 工作项和 PR 管理。

## 产品、设计和工程版本

- **产品**由本路线图与正式构建清单绑定。实现是代码具备能力，合并是变更进入目标分支，启用由正式构建范围决定，发布须经项目负责人按独立授权执行。CI 工件属于隔离候选。
- **设计**由[设计清单](design/manifest.json)记录生效范围、独立批准的实现版本及历史。v0.6.0 继承 Active v2.0.0 在当前产品范围内的共用参照。清单内原有产品版本标明设计获批时的基线。新的设计通过既有 Draft、Proposed、Active 流程及独立评审生效，已批准的设计资产保留原 SHA。设计来源和未证实的原作版本沿用其既有证据记录。
- **工程**由仓库维护者管理，沿用 Backlog CLI、OpenHarness cooperative、目标分支 PR、当前 SHA 的 Project checks、独立评审、固定工具链及隔离构建。沿用 Slay-the-Heavens 的候选身份、工具固定及分层证据做法。 [QA](QA.md) · [工具链](../platform/toolchain-lock.json) · [同平台复用评估](design/references/v2.0.0/portable-platform-reuse.md)

## 历史

早期单人提案见 [PR #5](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/pull/5)。M1–M4 和三模式 v0.5.0 交付目标保留在各自里程碑与历史提交，本路线图接续其产品范围。最后一个旧范围候选由 develop 精确提交生成。 [M1–M4 与旧范围](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/blob/d250191f94797356c4bc60c0b492cf91f007b464/docs/PRODUCT.md) · [v0.5.0 基线候选](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/actions/runs/45825304763)
