local controls = {}
for _, name in ipairs({"Status", "Refresh", "Ready", "Advance", "Leave", "LeaveLabel", "MarketGold", "Team",
    "OfferLabel1", "OfferLabel2", "OfferLabel3", "Buy1", "Buy2", "Buy3"}) do
    controls[name] = {
        alive = true,
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
local sent = {}
local handlers = {}
game = {
    ServerSignal = function(name)
        assert(name == "AP_DuelRequest")
        local arguments = {}
        return {
            AddInt = function(_, value)
                arguments[#arguments + 1] = value
            end,
            SendSignal = function()
                assert(#arguments == 4)
                sent[#sent + 1] = arguments
            end,
        }
    end,
}
script = {
    object = {GetChild = function(_, name) return assert(controls[name]) end},
    RegisterServerSignalHandler = function(_, name, callback)
        assert((name == "AP_DuelSnapshot" or name == "AP_DuelMarket") and handlers[name] == nil)
        handlers[name] = callback
    end,
    UnregisterServerSignalHandler = function(_, name)
        assert(handlers[name])
        handlers[name] = nil
    end,
}
local function receive_status(players, round, phase, ready, continued, settlements, version,
    sequence, winner, reason, remaining, seat, ack)
    local assigned_seat = seat or (players == 2 and 1 or 0)
    handlers.AP_DuelSnapshot("AP_DuelSnapshot", {players, assigned_seat, round, phase, ready, continued, settlements,
        version, sequence or assigned_seat, winner or 0, reason or 0, remaining or 60, ack or 0})
end

local function receive_market(round, version, gold, offers, team)
    handlers.AP_DuelMarket("AP_DuelMarket", {round, version, gold, offers, team})
end

local function assert_text(name, text)
    assert(controls[name].text:find(text, 1, true), name .. " should show " .. text)
end

local function click_expect(name, action, round, sequence)
    local before = #sent
    controls[name].callback()
    if action then
        local expected = action == 0 and 0 or sequence or 1
        assert(#sent == before + 1 and sent[#sent][1] == action and sent[#sent][2] == round and sent[#sent][3] == expected)
    else
        assert(#sent == before, name .. " should have ignored click")
    end
end

dofile(assert(arg[1]))
OnStart()
assert(sent[1][1] == 0 and sent[1][2] == 0)
assert_text("MarketGold", "同步商店中")
click_expect("Buy1")

local empty_team = {0, 0, 0, 0, 0}
receive_status(1, 1, 0, false, false, 0, 1)
receive_market(1, 1, 0, {0, 0, 0}, empty_team)
assert_text("Status", "等待第 2 位玩家")
assert_text("Team", "阵容 0 / 5")
click_expect("Buy1")
click_expect("Ready")

-- Status arrives first. Older market data cannot make the shop interactive.
receive_status(2, 1, 0, false, false, 0, 2)
receive_market(1, 1, 10, {1, 2, 3}, empty_team)
click_expect("Buy1")
receive_market(1, 2, 10, {1, 2, 3}, empty_team)
assert_text("MarketGold", "金币 10")
assert_text("OfferLabel1", "芦纹龟  攻1 / 生4")
assert_text("OfferLabel2", "烟尾雨燕")
assert_text("OfferLabel3", "棉尾兔")
assert_text("OfferLabel1", "购买 3 金")
assert_text("Team", "先购买动物")
click_expect("Buy1", 3, 1)
click_expect("Buy1")
click_expect("Buy2")
click_expect("Buy3")
assert_text("MarketGold", "金币 10")
assert_text("Team", "阵容 0 / 5")

-- Market arrives first. Repeated packets must not undo the server purchase.
receive_market(1, 3, 7, {0, 2, 3}, {1, 0, 0, 0, 0})
assert_text("Team", "阵容 1 / 5\n芦纹龟")
assert_text("OfferLabel1", "售罄")
assert_text("OfferLabel2", "等待同步")
click_expect("Buy2")
receive_status(2, 1, 0, false, false, 0, 3, 2)
receive_market(1, 3, 10, {1, 2, 3}, empty_team)
receive_market(1, 2, 10, {1, 2, 3}, empty_team)
assert_text("MarketGold", "金币 7")
click_expect("Buy1")
click_expect("Buy2", 4, 1, 2)

receive_market(1, 4, 7, {0, 2, 3}, {1, 0, 0, 0, 0})
receive_status(2, 1, 0, true, false, 0, 4, 3)
assert_text("OfferLabel2", "本轮已锁定")
click_expect("Buy2")
receive_status(2, 1, 1, true, false, 1, 5, 3)
receive_market(1, 5, 7, {0, 2, 3}, {1, 0, 0, 0, 0})
local settlement = controls.Status.text
assert_text("Status", "本轮已结算")
receive_status(2, 1, 0, true, false, 0, 3)
assert(controls.Status.text == settlement)
click_expect("Buy3")
click_expect("Advance", 2, 1, 3)

receive_market(2, 6, 10, {3, 2, 1}, {1, 2, 0, 0, 0})
assert_text("MarketGold", "同步商店中")
click_expect("Buy3")
receive_status(2, 2, 0, false, false, 1, 6)
receive_market(1, 7, 0, {0, 0, 0}, empty_team)
receive_status(2, 1, 0, false, false, 0, 7)
assert_text("MarketGold", "金币 10")
assert_text("Team", "阵容 2 / 5\n芦纹龟  ·  烟尾雨燕")
click_expect("Buy3", 5, 2)
local retry_token = sent[#sent][4]
click_expect("Refresh", 5, 2)
assert(sent[#sent][4] == retry_token)

receive_status(2, 2, 0, false, false, 1, 8)
receive_market(2, 8, 2, {3, 0, 1}, {1, 2, 2, 0, 0})
assert_text("OfferLabel1", "金币不足")
click_expect("Buy1")
receive_market(2, 9, 4, {0, 0, 1}, {1, 2, 3, 1, 3})
receive_status(2, 2, 0, false, false, 1, 9)
assert_text("OfferLabel3", "阵容已满")
click_expect("Buy3")
receive_status(2, 2, 2, true, false, 2, 10, 2, 0, 1)
assert_text("Status", "验证完成")
click_expect("Buy3")
click_expect("Leave")

OnDestroy()
assert(next(handlers) == nil)
for _, control in pairs(controls) do
    assert(control.callback == nil)
end
OnStart()
assert(sent[#sent][1] == 0 and sent[#sent][2] == 0)
assert_text("MarketGold", "同步商店中")
click_expect("Buy3")
receive_market(1, 1, 10, {1, 2, 3}, empty_team)
receive_status(2, 1, 0, false, false, 0, 1)
click_expect("Buy3", 5, 1)
receive_status(1, 1, 0, false, false, 0, 2, 2, 0, 0, 15, 1)
assert_text("Status", "等待原席位返回")
click_expect("Leave")
assert_text("LeaveLabel", "确认认输")
click_expect("Leave", 6, 1, 2)
click_expect("Leave")
receive_status(1, 1, 2, false, false, 0, 3, 3, 2, 2, 0, 1)
assert_text("Status", "本席告负")
click_expect("Leave")
OnDestroy()
assert(next(handlers) == nil)

-- A newer peer broadcast cannot acknowledge our still in-flight request. A
-- reordered actor-only rejection may subsequently release just its own token.
OnStart()
receive_status(2, 1, 0, false, false, 0, 1)
receive_market(1, 1, 10, {1, 2, 3}, empty_team)
click_expect("Buy1", 3, 1)
local first_token = sent[#sent][4]
receive_status(2, 1, 0, false, false, 0, 3)
receive_market(1, 3, 10, {1, 2, 3}, empty_team)
click_expect("Buy2")
click_expect("Refresh", 3, 1)
assert(sent[#sent][4] == first_token)
receive_status(2, 1, 0, false, false, 0, 2, 1, 0, 0, 60, 1, first_token)
click_expect("Buy2", 4, 1)
local second_token = sent[#sent][4]
assert(second_token > first_token)
receive_status(2, 1, 0, false, false, 0, 2, 1, 0, 0, 60, 1, first_token)
click_expect("Buy3")
receive_status(2, 1, 0, false, false, 0, 4, 2, 0, 0, 60, 1, second_token)
receive_market(1, 4, 7, {1, 0, 3}, {2, 0, 0, 0, 0})
click_expect("Buy3", 5, 1, 2)
OnDestroy()
assert(next(handlers) == nil)
print("M2 readback input passed: paired frames, private acknowledgements, identical retries, forfeit confirmation and teardown")
