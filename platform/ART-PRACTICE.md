# 六只动物美术 · 单人练习样板

将 `six-animal-practice.gil` 导入获授权的隔离关卡。包内 `ART-PRACTICE.json` 记录 GIL、原生界面与回读 Lua、样板图元数据、两个画幅的输入验证和截图哈希。用 `sha256sum -c SHA256SUMS` 核对文件。

样板将六只原创肖像和通俗动物、食物名称应用到游戏的实际单人练习。既有 18 只研发目录提供对局规则。企鹅、长颈鹿、鲸鱼在样板中借用既有内部规则槽，正式技能、阶级及名册映射待定。其余动物和食物继续使用研发图标。

## 复验

1. 从「单人练习 · 美术样板」开始。第 3、5、7、8、11 轮的货架截图可合计查看六只新肖像。
2. 第 4 和第 11 轮真实五对五开始时合计可见六只。第 4 轮可逐条回放并确认兔宝宝召唤。
3. 固定种子轨迹完成第 15 轮十胜。重开后可从第一货位把肖像拖入阵容，确认购买和金币扣减。
4. 比较同一 GIL 的 PC 16:9 与移动 19.5:9 截图。检查 66px 货架和 44px 阵容的命中、文字、镜像、标签间距和攻击反馈。
5. 真机显示、触屏、加载、内存、帧时、声音、官方联机和量产确认待验。样板使用单人练习入口和独立界面预算。

```sh
MILIASTRA_ALLOW_LIVE_WRITE=0 node --use-env-proxy tests/native/verify-art-practice.mjs \
  <MCP-checkout> <Simulator-checkout> \
  docs/design/revisions/v2.1.0/prototype/rows-40.json <new-output>
```

MCP 与 Simulator 版本见 `platform/toolchain-lock.json`。测试读取 GIL 原生布局和 Lua，在固定 Simulator 内运行练习的真实输入和规则。记录的挂载和内存数值来自软件 Simulator 进程。
