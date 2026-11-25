# 同平台复用评估 · v2.0.0

这是本地研究候选，不执行远端同步、安装、规则更改、激活、正式存档写入或发布。SAP 基线 `ab73443adee5a2b5b37268779356c2fe67220886`；Slay-the-Heavens 的只读精确快照为 `79abbb50ec5ed0b536db5c8961a0593352758b74`。复用对象是千星平台验收方法，不是另一游戏的规则、美术或整套架构。

## Slay-the-Heavens 可移植部分

来源均锁定同一 SHA：

- [候选身份与 UI 验收](https://github.com/FurinyaWorks/Slay-the-Heavens/blob/79abbb50ec5ed0b536db5c8961a0593352758b74/docs/ENGINEERING.md)：隔离复制源存档、唯一构建目录、实际输入摘要、最终 GIL 散列、构建标记关联日志；静态写入、读回、官方导入、当前 ready 与设备体验分别记录。
- [工具链](https://github.com/FurinyaWorks/Slay-the-Heavens/blob/79abbb50ec5ed0b536db5c8961a0593352758b74/docs/TOOLCHAIN.md)：先用已有工具与隔离副本，`MILIASTRA_ALLOW_LIVE_WRITE=0`；模拟器 mobile 画布只证明布局，不能代表触控或手机帧率。文档里的 Windows 路径及工具版本只是该项目环境事实，不当成 SAP 已具备能力。
- [负载证据合同](https://github.com/FurinyaWorks/Slay-the-Heavens/blob/79abbb50ec5ed0b536db5c8961a0593352758b74/docs/PLATFORM_LOAD.md) 与 [校验实现](https://github.com/FurinyaWorks/Slay-the-Heavens/blob/79abbb50ec5ed0b536db5c8961a0593352758b74/scripts/platform-load.mjs)：证据绑定 sourceCommit、buildId、candidateSha256、payloadDigest；缺失为 UNVERIFIED，不匹配或失败为 BLOCKED。旧官方截图、源码字节和 GIL 文件大小不能冒充新候选的官方存档/性能读数。

建议 SAP 在现有 BUILD.json/校验和、GIL 读回与 platform/GAME.md 上增补最小身份和结果字段，不移植其卡牌装配器、纹理模板、数值阈值或新 CI。每个 v2 设备缺陷记录同一候选、操作、预期/实得、PC/手机状态及原始截图/日志 hash。候选重新构建后只复用仍匹配的证据。导入/ready 通过依然不能勾整局、双设备或手机体验。

## OpenHarness 精确来源与差异

SAP `docs/QA.md` 固定 [FurinyaDev/OpenHarness@aebb0c2255a5df275491009285c1a23d03f90771](https://github.com/FurinyaDev/OpenHarness/tree/aebb0c2255a5df275491009285c1a23d03f90771)。其 README 已通过 GitHub 连接器按 SHA 读取，含 cooperative 默认模式。SAP `.harness/config.json` 为 cooperative / github-backlog-v1，目标 develop，验收 `sh scripts/check.sh`，原生检查 `Project checks`。现存项目 Backlog、CI 与实际 GitHub 配置继续是权威。

Slay 的 AGENT_GUIDANCE 引用 [98826145a59452401e19b93bfa2af264fedeecb8 的 engineering.md](https://github.com/FurinyaDev/OpenHarness/blob/98826145a59452401e19b93bfa2af264fedeecb8/docs/engineering.md)。GitHub 连接器比较两 SHA：后者 ahead 1 / behind 0，共 11 文件，内容为 README、工程说明/recipe、REASONS/ADR 模板、示例检查器和工程 recipe 测试；**没有生产 CLI 变更**。比较入口：[固定差异](https://github.com/FurinyaDev/OpenHarness/compare/aebb0c2255a5df275491009285c1a23d03f90771...98826145a59452401e19b93bfa2af264fedeecb8)。

紧凑同步候选：选择性借鉴 REASONS 的意图/验收、状态所有者/写入口、依赖方向、分层验证及独审交接字段；不升级 SAP 工具 pin，不重建任务系统、不新增常驻门禁、不改变部署模式。该指导明确由项目拥有架构、阈值、命令与发布政策。普通小修继续引用已有任务，不强制补大型模板。

本轮读取了已下载的 OpenHarness Agent skill，其链接仍写 CHNISam/OpenHarness；实际项目 pin 与连接器确认的可访问仓库为 FurinyaDev/OpenHarness。skill 是入口指引，不授予新权限。当前 shell 的 `command -v openharness` 与 `backlog instructions overview` 均找不到可执行文件；未安装、bootstrap 或伪造 live doctor。主控若已在隔离工具目录恢复 CLI，以其当次真实 entry/doctor 为准。本文件不是实时保证声明。

## 最小落地顺序

1. 主控在 TASK-41 引用 v2.0.0 Reference First 与原始设备 NO-GO 的出处/缺口。
2. 设计确定本作权威与 UI 合同，原版证据不足之处显式写项目选择。
3. 实现只复用必要的平台边界及候选身份；源码与 GIL 读回检查继续使用项目已有入口。
4. 独立评审绑定最终 SHA；官方客户端、PC/手机、双设备与八席各用对应实测证据收口。无授权时保留设备待验，不改正式存档或发布。
