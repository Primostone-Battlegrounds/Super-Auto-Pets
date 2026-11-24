# 千星多人商店节点图样本

`platform/versus_shop.ts` 提供跟真实连接分离的席位商店操作。千星服务端节点图从 Lua 名册生成各阶池、价格、等级阈值和成长参数。刷新、冻结、购买、合成、喂食、出售、调位和升级奖励用同一商店指令。适配层先验证席位、轮次、阶段和请求序号，再提交商店操作。打包态中的商店随机状态与下一队员编号留在服务端。

平台节点图的整数范围为有符号 32 位。随机数使用 Schrage 整数变换，使 Park–Miller 更新的中间值也在这个范围内。Lua 领域回归逐条比较接受结果、槽位、金币、冻结、永久属性、队员编号、奖励与 RNG 状态。[官方节点数据类型说明](https://github.com/FurinyaWorks/genshin-miliastra-mcp/blob/59c576e41632a6bf6781bbca83a676d0da0374ec/knowledge/official/guide/mhk23ora1wom.md)

## 离线复验

```sh
sh platform/setup-tools.sh /tmp/auto-pets-miliastra-mcp
MILIASTRA_ALLOW_LIVE_WRITE=0 node tests/native/verify-versus-shop.mjs \
  /tmp/auto-pets-miliastra-mcp /tmp/auto-pets-native-validation lua5.3 \
  /tmp/versus-shop-proof
cd /tmp/versus-shop-proof
sha256sum -c SHA256SUMS
```

CI 产物 `versus-shop-proof-<SHA>` 记录编译读回、节点数、两种 Lua 导出散列和源图离线模拟。`maxExplicitCalls` 为每种操作在离线轨迹中调用节点接口的实测峰值。算术降级节点和循环开销需用官方客户端另测。当前 GIL 为单人隔离技术样本。它自动执行预先导出的合法和拒绝操作，分批核对服务端状态。好友 1v1 与八席关卡的实机经营使用场景单独验收。

在验证命令末尾加 `release` 并指定另一个输出目录，构建 `versus-shop-release-proof.gil`。六阶样本从合法经营所得的三人阵容和第 11 轮货架开始，首个动作对中间席喂星果盘，再试重复喂同一货位。回归也核对喂两端只影响实有的相邻队员。CI 产物 `versus-shop-release-proof-<SHA>` 含相同的证据字段和六阶标签。

## 官方客户端观测

1. 导入隔离样本 `versus-shop-proof.gil` 或 `versus-shop-release-proof.gil`。订阅 `_GSTS_AP_VersusShopProof`，开始一次单人试玩。
2. 等待约一分钟，不进行任何输入。日志应依次记录 `AUTO_PETS_SHOP confirmed_step` 及 1 至 8 的序号，最后记录 `AUTO_PETS_SHOP verified`。
3. 记录客户端版本、GIL SHA-256 和图日志。任何 `acceptance_mismatch`、`state_mismatch`、节点预算终止或超过 90 秒仍缺最后标记均保留为失败证据。离线读回及源图模拟结果见随包 `evidence.json`。
