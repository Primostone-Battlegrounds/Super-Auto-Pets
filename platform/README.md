# G0 千星五格样本

样本在默认界面显示五个方格。一次点击把黄色标记移到该格下方，并记录 `AUTO_PETS_G0 slot=N`。标记在首次点击前隐藏，界面完成监听注册时记录 `AUTO_PETS_G0 ready`。

## 离线复验

准备 Node.js 22.12 或更新版本和 Lua 5.3。安装脚本在项目外拉取并构建固定版本的 Miliastra MCP，保留 npm 锁定的校验值。[Miliastra MCP](https://github.com/FurinyaWorks/genshin-miliastra-mcp/tree/59c576e41632a6bf6781bbca83a676d0da0374ec)

从项目根目录运行以下命令。将工具路径和临时目录替换为实际位置。

```sh
sh platform/setup-tools.sh /tmp/auto-pets-miliastra-mcp
MILIASTRA_ALLOW_LIVE_WRITE=0 node tests/native/verify-g0.mjs \
  /tmp/auto-pets-miliastra-mcp /tmp/auto-pets-native-validation lua5.3
```

复验程序复制工具仓库中的编辑器夹具，启动 MCP stdio 会话，构建 `g0-five-slot.gil` 并回读默认布局、脚本源码、控件绑定、尺寸和坐标。它校验两份输入文件的 SHA-256，用标准 Lua 5.3 执行从 GIL 中读回的源码，并用模拟光标事件验证注册、标记移动、日志和清理。生成的 GIL、日志和 `evidence.json` 保存在新的临时目录中。

## 官方客户端待验

- **PC**　使用已授权的隔离导入流程在官方沙箱中打开同一 GIL，订阅「客户端脚本」日志。用鼠标依次点击 `3, 1, 5, 2, 4, 4`，记录默认画面和标记移动截图，核对一条 `ready` 及各次点击依序对应的 `slot=N`。
- **手机**　在可以访问隔离关卡的官方移动客户端用触屏重复相同步骤。记录设备与客户端版本，核对可见区域内的五格、每次触碰的标记位置和独立的客户端日志。
