# 原生动物美术工艺

沿用 PR #5 的参考取证、图元控制和实例复验方法。现有候选的肖像采用本仓库的原创图元。Steam 参照用于检查小画幅轮廓、信息层级、选中反馈与相向战斗的易读性。[PR #5](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/pull/5) [Steam 参照](REFERENCE_MATRIX.md#steam-官方参照)

- 保留当前素材的主要剪影、主色、眼和显示朝向。用实际货架与战斗的最小尺寸、同一锚点和同一底色检查辨识度。
- 图鉴与实际运行使用共用图元定义。活体实例的站位、朝向、血量与动效按 UID 自己维护。逐个核对商店、编队与五对五战斗。
- 统计绘图层、容器、文本、交互控件和同屏实例。旧项目的能力记录用于复验方法，本项目预算从同候选的实际 GIL 读回和设备实测得出。[原塔生产规约](https://github.com/FurinyaWorks/Slay-the-Heavens/blob/73c21489efaab409d4c0c46bee517d410d3427fc/docs/art/NATIVE_MONSTER_PRODUCTION.md)
- 在静止、拖动、换位、同种实例、阵亡召唤、菜单回访和离开关卡时留存日志与帧。每个变更保持资产定义、JS 生成器与 Lua 图层池上限一致，记录 [QA](QA.md) 规定的具体证据。
