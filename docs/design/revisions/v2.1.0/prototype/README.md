# 六只原创设计稿与同源拟合

`six-animals.webp` 是项目生成的原创纸雕风格概念稿。顺序为乌龟、兔子、猫咪、企鹅、长颈鹿和鲸鱼。源稿用于评审物种轮廓、朝向和表情。通俗名称在样板中作为显示文案，游戏动物 ID 和技能映射随完整内容设计确定。

同一张图以 24、40 和 64 个图元上限拟合。拟合输出包括每种动物的透明源图、三角形为主的轮廓和色面、按源图位置补绘的眼睛、原生位姿、离线预览、实际图元数和前景 RGB 平均绝对误差。像素误差用于比较同源结果，物种辨识和表情由 66px 与 44px 画面评审。

从目录运行命令。`<Slay-the-Heavens>` 使用 `79abbb50ec5ed0b536db5c8961a0593352758b74`，Python 需要 Pillow、NumPy、OpenCV 4.12 和 Shapely 2.1。拟合收据记录实际工具文件哈希。

```sh
PYTHONDONTWRITEBYTECODE=1 python3 fit-samples.py \
  <Slay-the-Heavens> six-animals.webp <scratch-output>
```

预算档仅用于实验。现行统一候选已有 1,000 个控件，正式方案需要在实际货架和五对五界面重新验证控件复用、加载、画面和设备数据。 [样板门禁](../ACCEPTANCE.md)
