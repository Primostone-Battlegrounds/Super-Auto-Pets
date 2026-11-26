# 六阶 60 只动物 · 统一隔离候选

解压后将 `super-auto-pets.gil` 导入获授权的隔离关卡。练习、好友 1v1 和八人吃鸡共用同一份 60 只目录。六阶各有 10 只可购买动物。食物与战斗召唤物另计。

`BUILD.json` 记录每个动物的稳定 ID、名称、阶级和起始攻血。旧 18 只兼容回归继续使用历史目录。新增动物复用现有的技能事件和三个等级，采用本项目的数值及技能搭配。

`ACCEPTANCE.json` 记录发布门禁。原生图与 Lua 对照覆盖双人、八席授权和回放。Simulator 多人使用明确标记的消息夹具。官方 PC、手机和真实联机仍需用同一 GIL 取证。

## 本地复验

```sh
lua5.4 scripts/play.lua 7 --expanded
MILIASTRA_ALLOW_LIVE_WRITE=0 node tests/native/verify-game.mjs \
  <MCP> <scratch> lua5.3 <new-package> --expanded
node --use-env-proxy tests/simulator/expanded-game.mjs \
  <MCP> <Simulator> <new-package>/super-auto-pets.gil <new-evidence>
```

在解压目录运行 `sha256sum -c SHA256SUMS` 核对候选文件。
