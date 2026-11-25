# 官方 Steam 影片观察补证 · v2.0.0

项目基线 `179e65ca513ba63c17cf759a01a8e320cf4bb05a`；采集于 2026-11-25。本补证增加真实可复核的视频时间点，延续 [Reference First](reference-first.md) 的版本及设备边界，不重写历史访问失败记录。

## 原始身份与获取方法

[官方 Steam appdetails API](https://store.steampowered.com/api/appdetails?appids=1714040&l=english) 返回电影 `256846199`，标题 `Super Auto Pets - Trailer #1`，HLS/DASH 官方 CDN 地址。实际返回的电影记录和两份播放清单原文保存在 [steam-trailer/](steam-trailer/trace.json)，含逐文件 SHA-256、视频摘要及抽帧命令。视频本体仅作隔离研究中间文件，不进入运行包或本提交。

使用 FFmpeg 读取 API 提供的 HLS，选择视频流 `0:v:1` 并 packet-copy 到本地 MP4；ffprobe 显示 1280×720、起始 0、时长 56.083333 秒。下表均为按明确秒数单独抽取并逐张查看的帧，非按粗缩略图估算。该官方视频交付确实可访问，因而补足了此前 YouTube 未观看的部分；不据此声称两个渠道文件完全相同。

**同源影片不等于同版客户端。** 影片没有可核实的游戏版本、Steam Build ID 或选包页面。队名 `The Iconic Turtles` 不是 Turtle Pack 选择证据；视频出现 Ladybug，也不能据队名宣布它是当前 Turtle。官方编辑过的宣传片不是从开局到终局的连续录像。本轮没有再尝试已证实失败的 WebGL，也没有登录或操作原版客户端。

## 已观察的动作与反馈

| 案例 | 时间 | 独立帧及直接可见事实 |
| --- | --- | --- |
| STV-SHOP-DETAIL | 00:04.000 | [帧](steam-trailer/frame-4-0s.jpg)：鼠标指针在下方宠物附近，Ladybug 技能卡显示；仅凭视频不能区分悬停、点击或按钮按住的触发方式。 |
| STV-SHOP-DRAG | 00:05.000 | [帧](steam-trailer/frame-5-0s.jpg)：宠物已离开货架、原处留黑影，阵容位置有目标箭头，底部出现 Freeze。 |
| STV-SHOP-PURCHASE | 00:05.500 | [帧](steam-trailer/frame-5-5s.jpg)：宠物在阵容中、货架原位空出，金币从前帧的 10 变 7。支持此段展示一次购买后的反馈；不推广成各版本经济规格。 |
| STV-FOOD-DETAIL | 00:08.500 | [帧](steam-trailer/frame-8-5s.jpg)：Apple 的价格和效果详情可见。 |
| STV-FOOD-TARGET | 00:09.500 | [帧](steam-trailer/frame-9-5s.jpg)：食物到目标之间有点线和目标圈，详情仍显示；只证明目标提示，未据此推断内部命令。 |
| STV-MATCH-WAIT | 00:18.000 | [帧](steam-trailer/frame-18-0s.jpg)：显示寻找同回合对手的等待文字。此画面不能证明八席大厅、好友邀请或实时传输。 |
| STV-BATTLE-CONTROLS | 00:26.000 | [帧](steam-trailer/frame-26-0s.jpg)：双方阵容与 Rewind、Pause、Autoplay、Fast、Skip 可见；按钮可点击性未实跑。 |
| STV-BATTLE-ABILITY | 00:27.000 | [帧](steam-trailer/frame-27-0s.jpg)：Dolphin 高亮、开战技能详情和投射物先出现。 |
| STV-BATTLE-DAMAGE | 00:28.000 | [帧](steam-trailer/frame-28-0s.jpg)：随后显示伤害数字，Spider 的生命进入负值。 |
| STV-BATTLE-FAINT | 00:29.000 | [帧](steam-trailer/frame-29-0s.jpg)：显示 Spider 退场技能详情，原位出现 camel。它支持这段技能→受击→退场/生成的可见先后，不证明所有同速技能或召唤的底层规则。 |

## 对本作的可移植约束

可复用的是玩家看到的反馈关系：选中对象时能读取能力；移动源对象时显示可用目标；购买后阵容、货架和资源一起更新；战斗按事件把能力、受击和退场/生成的变化依次展示。继续使用项目原创内容与平台原生输入，不复制商业图形、字体或像素布局。图片只用于参考证据，不用于资产生成或发布包。

手机不应依赖视频里的鼠标悬停。点按查看详情、原生信号校验、拒绝提示、返回和重入由本作另行实现、按同候选验收。影片中购买成功不证明本作购宠成功；源图细节与模拟器截图也不能替代官方设备触控。

**仍缺的证据：** 当前版本与 Turtle 身份、原版主菜单/选包、1v1/八人入口、私人邀请、房主/入席/补位流程，以及同版完整比赛和设备输入。现有公告能说明模式存在及历史改动，不能补成没有观察过的点击轨迹。这些继续 UNVERIFIED；本补证没有重写成已实玩原版或当前实机 PASS。
