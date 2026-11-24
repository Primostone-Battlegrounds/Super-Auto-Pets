local controls = {}
local names = {"Status", "MarketGold", "Team", "LeaveLabel", "MergeLabel", "RewardLabel", "ReplayLabel", "ReplayStatus",
    "Refresh", "Ready", "Advance", "Leave", "Reroll", "Sell", "Merge", "Reward", "RewardNext", "Replay"}
for _, pair in ipairs({{"OfferLabel", 3}, {"Buy", 3}, {"FreezePet", 3}, {"FreezePetLabel", 3},
    {"FoodLabel", 2}, {"Food", 2}, {"FreezeFood", 2}, {"FreezeFoodLabel", 2}, {"Team", 5}, {"TeamLabel", 5}}) do
    for slot = 1, pair[2] do names[#names + 1] = pair[1] .. slot end
end
for _, pair in ipairs({{"Reroll", "RerollLabel"}, {"Sell", "SellLabel"}, {"Merge", "MergeLabel"},
    {"Reward", "RewardLabel"}, {"RewardNext", "RewardNextLabel"}, {"Ready", "ReadyLabel"}, {"Advance", "AdvanceLabel"},
    {"Leave", "LeaveLabel"}, {"Replay", "ReplayLabel"}}) do
    names[#names + 1] = pair[1] .. "Face"
    names[#names + 1] = pair[2]
end
for _, name in ipairs(names) do
    controls[name] = {
        alive = true,
        SetActive = function(self, value) self.active = value end,
        SetVisible = function(self, value) self.visible = value end,
        AddCursorEventListener = function(self, event, callback)
            assert(event == 1 and self.callback == nil)
            self.callback = callback
        end,
        RemoveCursorEventListener = function(self, event, callback)
            assert(event == 1 and self.callback == callback)
            self.callback = nil
        end,
    }
end

Enum = {CursorEventType = {CursorClick = 1}}
local sent, handlers = {}, {}
game = {
    ServerSignal = function(name)
        assert(name == "AP_DuelRequest")
        local arguments = {}
        return {
            AddInt = function(_, value) arguments[#arguments + 1] = value end,
            SendSignal = function()
                assert(#arguments == 7)
                sent[#sent + 1] = arguments
            end,
        }
    end,
}
script = {
    object = {GetChild = function(_, name) return assert(controls[name], name) end},
    RegisterServerSignalHandler = function(_, name, callback)
        assert((name == "AP_DuelSnapshot" or name == "AP_DuelMarket" or name == "AP_DuelReplay") and handlers[name] == nil)
        handlers[name] = callback
    end,
    UnregisterServerSignalHandler = function(_, name)
        assert(handlers[name])
        handlers[name] = nil
    end,
}
local function status(version, sequence, options)
    options = options or {}
    local parameters = {options.players or 2, options.seat or 1, options.round or 1, options.phase or 0,
        options.ready or false, options.continued or false, options.settlements or 0,
        version, sequence, options.winner or 0, options.reason or 0, options.remaining or 60, options.ack or 0,
        options.lives or 5, options.opponent_lives or 5, options.outcome or 0}
    handlers.AP_DuelSnapshot("AP_DuelSnapshot", parameters)
end
local function market(version, gold, offers, team, options)
    options = options or {}
    local round = options.round or 1
    local raw = gold and {round, options.tier or 1, gold, 0, 0, #team, table.unpack(offers)} or {0}
    if gold then
        for _, food in ipairs(options.foods or {1, 2}) do raw[#raw + 1] = food end
        for slot = 1, 5 do
            local unit = team[slot] or {0, 0, 0, 0, 0, 0}
            for _, field in ipairs(unit) do raw[#raw + 1] = field end
        end
        for _, reward in ipairs(options.rewards or {}) do raw[#raw + 1] = reward end
    end
    handlers.AP_DuelMarket("AP_DuelMarket", {round, version, raw})
end
local function assert_text(name, text)
    assert(controls[name].text:find(text, 1, true), name .. " should show " .. text)
end
local function press(name, action, from, to, flag, round, sequence)
    local before = #sent
    controls[name].callback()
    if action then
        assert(#sent == before + 1, name .. " should send action " .. action)
        local packet = sent[#sent]
        assert(packet[1] == action and packet[2] == (round or 1) and packet[3] == (sequence or 1), name)
        assert(packet[5] == (from or 0) and packet[6] == (to or 0) and packet[7] == (flag or 0), name)
        return packet[4]
    end
    assert(#sent == before, name .. " should have ignored click")
end
local function close()
    OnDestroy()
    assert(next(handlers) == nil)
    for name, control in pairs(controls) do assert(control.callback == nil, name) end
end

local turtle = {1, 11, 1, 4, 1, 0}
local swift = {2, 22, 2, 2, 1, 0}
local second_turtle = {1, 23, 1, 4, 1, 0}
dofile(assert(arg[1]))
OnStart()
assert(sent[1][1] == 0 and sent[1][2] == 0 and sent[1][3] == 0)
assert_text("MarketGold", "同步商店中")
status(1, 0, {players = 1, seat = 0})
market(1)
assert_text("Status", "等待第 2 位玩家")
press("Buy1")
press("Ready")

-- Cross-flight packets never unlock an unmatched shop. A peer's newer, paired
-- view cannot finish a still pending command at the same request sequence.
status(2, 1)
market(1, 10, {1, 2, 3}, {})
press("Buy1")
market(2, 10, {1, 2, 3}, {})
assert_text("MarketGold", "金币 10")
assert_text("OfferLabel1", "芦纹龟\n攻1 / 命4")
assert_text("FoodLabel1", "朝露莓")
press("Food1")
local first_token = press("Buy1", 11, 1)
press("Buy2")
status(4, 1)
market(4, 10, {1, 2, 3}, {})
press("Buy2")
assert(press("Refresh", 11, 1) == first_token)
status(3, 1, {ack = first_token})
local second_token = press("Buy2", 11, 2)
assert(second_token > first_token)
status(3, 1, {ack = first_token})
press("Buy3")
market(5, 7, {1, 0, 3}, {swift})
assert_text("OfferLabel2", "售罄")
assert_text("OfferLabel3", "等待同步")
press("Buy3")
status(5, 2, {ack = second_token})
market(4, 10, {1, 2, 3}, {})
assert_text("TeamLabel1", "烟尾雨燕")
assert_text("MarketGold", "金币 7")
press("Buy2")

press("Team1")
assert_text("TeamLabel1", "已选")
local feed_token = press("Food1", 16, 1, 1, 0, 1, 2)
status(6, 3, {ack = feed_token})
market(6, 4, {1, 0, 3}, {swift}, {foods = {0, -2}})
assert_text("FreezeFoodLabel2", "解冻食物")
press("Food1")
local freeze_food = press("FreezeFood2", 17, 2, 1, 0, 1, 3)
status(7, 4, {ack = freeze_food})
market(7, 4, {1, 0, 3}, {swift}, {foods = {0, 2}})
local freeze_pet = press("FreezePet1", 17, 1, 0, 0, 1, 4)
status(8, 5, {ack = freeze_pet})
market(8, 4, {-1, 0, 3}, {swift})
assert_text("FreezePetLabel1", "解冻动物")
local sell = press("Sell", 13, 0, 1, 0, 1, 5)
status(9, 6, {ack = sell})
market(9, 5, {-1, 0, 3}, {})
assert_text("Team", "阵容 0 / 5")
press("Ready")
local reroll = press("Reroll", 10, 0, 0, 0, 1, 6)
status(10, 7, {ack = reroll})
market(10, 4, {-1, 0, 3}, {})

-- A new authoritative view may move selected rows; the selection follows UID.
status(11, 8)
market(11, 6, {1, 0, 3}, {turtle, swift, second_turtle})
press("Team1")
local rearrange = press("Team2", 14, 1, 2, 0, 1, 8)
status(12, 9, {ack = rearrange})
market(12, 6, {1, 0, 3}, {swift, turtle, second_turtle})
press("Team2")
press("Merge")
assert_text("MergeLabel", "取消合并")
press("Team1") -- Different IDs cannot merge.
local merge = press("Team3", 15, 2, 3, 0, 1, 9)
status(13, 10, {ack = merge})
market(13, 6, {1, 0, 3}, {swift, {1, 23, 2, 5, 1, 1}})
press("Team2")
local combine = press("Buy1", 12, 1, 2, 0, 1, 10)
status(14, 11, {ack = combine})
market(14, 3, {0, 0, 3}, {swift, {1, 23, 3, 6, 2, 2}}, {rewards = {4, 5}})
assert_text("TeamLabel2", "Lv2")
press("RewardNext")
assert_text("RewardLabel", "奖励 2/2")
local reward = press("Reward", 11, 2, 2, 1, 1, 11)
status(15, 12, {ack = reward})
market(15, 0, {0, 0, 3}, {swift, {5, 24, 4, 2, 1, 0}, {1, 23, 3, 6, 2, 2}}, {rewards = {4}})
assert_text("TeamLabel3", "已选")
press("Reroll", 10, 0, 0, 0, 1, 12)
status(16, 12, {ack = sent[#sent][4]}) -- An insufficient-gold rejection does not consume the sequence.
market(16, 0, {0, 0, 3}, {swift, {5, 24, 4, 2, 1, 0}, {1, 23, 3, 6, 2, 2}})
press("Ready", 1, 0, 0, 0, 1, 12)
status(17, 13, {ready = true, phase = 1, settlements = 1, outcome = 1})
market(17, 0, {0, 0, 3}, {swift})
assert_text("Status", "本轮获胜")
handlers.AP_DuelReplay("AP_DuelReplay", {1, 17, 1, {1, 11, 1, 4, 1}, {}})
assert_text("ReplayStatus", "1/2")
assert_text("ReplayLabel", "暂停")
press("Replay")
OnUpdate(0.5)
assert_text("ReplayStatus", "1/2")
press("Replay")
OnUpdate(0.18)
assert_text("ReplayStatus", "2/2")
assert_text("ReplayLabel", "重播")
handlers.AP_DuelReplay("AP_DuelReplay", {1, 17, 1, {1, 11, 1, 4, 1}, {}})
assert_text("ReplayLabel", "重播")
press("Replay")
assert_text("ReplayStatus", "1/2")
press("Buy3")
press("Advance", 2, 0, 0, 0, 1, 13)
market(18, 10, {3, 1, 3}, {swift}, {round = 2})
press("Buy3")
status(18, 1, {round = 2, settlements = 1})
press("Buy3", 11, 3, 0, 0, 2, 1)
status(19, 2, {round = 2, players = 1, remaining = 15})
assert_text("Status", "等待原席位返回")
press("Leave")
assert_text("LeaveLabel", "确认认输")
press("Leave", 6, 0, 0, 0, 2, 2)
press("Leave")
status(20, 3, {round = 2, players = 1, phase = 2, winner = 2, reason = 2})
assert_text("Status", "本席告负")
press("Leave")
close()
OnStart()
assert(sent[#sent][1] == 0 and sent[#sent][2] == 0 and sent[#sent][3] == 0)
assert_text("MarketGold", "同步商店中")
assert_text("MergeLabel", "合并模式")
assert_text("ReplayStatus", "等待战斗回放")
if arg[2] == "release" then
    status(1, 1, {round = 11})
    market(1, 10, {16, 17, 18}, {}, {round = 11, tier = 6, foods = {12, 11}})
    assert_text("OfferLabel1", "霜环麝牛")
    assert_text("OfferLabel3", "汐角鲸")
    assert_text("FoodLabel1", "星果盘")
    status(2, 3, {round = 11, phase = 1, settlements = 11, outcome = 1})
    handlers.AP_DuelReplay("AP_DuelReplay", {11, 17, 1, {16, 11, 7, 12, 1}, {}})
    assert_text("ReplayStatus", "霜环麝牛12")
    assert_text("ReplayStatus", "第 11 轮")
end
close()
print("M2 readback input passed: shop commands, packet ordering, private retries, canonical replay, and teardown")
