# 双人权威宿主契约

`autopets.duel_host` 用于宿主接入与离线验证。沿用 `autopets.duel` 的商店、战斗和回合契约。宿主接收已验证的玩家身份，向每条连接定向交付该玩家的快照。千星原生候选及当前原生接入范围见 [双人候选](M2.md)。

| 宿主调用 | 成功返回值 |
| --- | --- |
| `host.new(seed, first_player, second_player, options)` | 对局宿主。选项沿用 `duel.new`，`reconnect_ms` 默认 15000。 |
| `room:connect(verified_player, now)` | 新的连接句柄和下发列表。重新验证同一玩家后恢复原席位，并更新房间中其他连接。 |
| `room:request(connection, request, now)` | 接受标志、错误码及下发列表。请求沿用 `{round, sequence, action, command}`。 |
| `room:disconnect(connection, now)` | 成功标志和下发列表。使本连接失效并启动恢复时限。 |
| `room:tick(now)` | 成功标志和下发列表。 |
| `room:next_deadline()` | 下一次阶段或恢复截止的时间戳。终局返回 `nil`。 |

时间使用宿主单调毫秒时钟。宿主串行转交事件，并根据 `next_deadline()` 驱动 `tick()`。下发列表每项含 `{connection, state}`，宿主按句柄投递。`state` 是领域快照，附 `opponent_connected` 和单调递增的 `host_revision`。商店、对手公开状态、共享回放和下一可用请求序号一次下发。重复、过期、乱序或非法请求只需向发起人回送当前序号。若同时跨越截止时间，则向所有在场连接下发新状态。

连接句柄由宿主生成并存储。宿主必须从已验证的连接上下文读取它，从请求正文只读取操作。不认识的连接无法查看快照、提交操作或使其他连接退出。相同身份重新连接时先作废旧句柄。时限内恢复同一商店、序号和当前回放。恢复到期先处理同刻到期的对局阶段，必要时按缺席一方认输。两席同时耗尽恢复窗口时以平局关闭。主动认输使用 `forfeit`。

`lua5.3 -E tests/duel_host.lua` 和 `lua5.4 -E tests/duel_host.lua` 验证双人开局、独立购物、断开恢复、平局、相同回放、结算超时自动进轮、准备超时及扣命终局。原生平台需要给出可验证的连接身份、退出事件和恢复语义，具体观测由官方客户端完成。
