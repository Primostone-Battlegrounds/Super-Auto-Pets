local extracted, bounds = assert(arg[1]), assert(arg[2])
local controls, signals, commands = {}, {}, {}
local tokens = {}
local cursor = "CursorClick"
local enum = {"KeyboardCharacterSkill1KeyDown", "KeyboardInteractKeyDown", "KeyboardCharacterSkill2KeyDown"}
local keyboard = {}
local function get(path)
    return assert(controls[path], path)
end
for line in io.lines(bounds) do
    local path, visible = line:match("^([^\t]+)\t([01])$")
    controls[path] = {
        alive = true, active = visible == "1",
        GetChild = function(_, name) return get(path .. "/" .. name) end,
        FindChild = function(_, name) return get(path .. "/" .. name) end,
        SetActive = function(control, value) assert(type(value) == "boolean"); control.active = value end,
        SetVisible = function(_, value) assert(type(value) == "boolean") end,
        AddCursorEventListener = function(control, event, receive)
            assert(event == cursor and not control.click)
            control.click = receive
        end,
        RemoveCursorEventListener = function(control, event, receive)
            assert(event == cursor and control.click == receive)
            control.click = nil
        end,
        AddKeyEventListener = function(_, event, receive)
            assert(not keyboard[event])
            keyboard[event] = receive
        end,
        RemoveKeyEventListener = function(_, event, receive)
            assert(keyboard[event] == receive)
            keyboard[event] = nil
        end,
    }
end
local env = setmetatable({
    script = {
        object = {GetChild = function(_, name) return get(name) end},
        RegisterServerSignalHandler = function(_, name, receive)
            assert(not signals[name])
            signals[name] = receive
        end,
        UnregisterServerSignalHandler = function(_, name)
            assert(signals[name])
            signals[name] = nil
        end,
    },
    game = {
        ServerSignal = function(name)
            assert(name == "AP_RoomRequest")
            local values = {}
            return {
                AddInt = function(_, value)
                    assert(math.type(value) == "integer")
                    values[#values + 1] = value
                end,
                SendSignal = function()
                    assert(#values == 7)
                    commands[#commands + 1] = table.concat(values, ",", 1, 6)
                    tokens[#tokens + 1] = values[7]
                end,
            }
        end,
    },
    Enum = {CursorEventType = {CursorClick = cursor}, KeyEventType = {}},
}, {__index = _G})
for _, event in ipairs(enum) do env.Enum.KeyEventType[event] = event end

local function command(expected)
    assert(commands[#commands] == expected, tostring(commands[#commands]) .. " expected " .. expected)
end
local function click_at(path)
    return get("Match/" .. path .. "/Hit").click()
end
local function label(path)
    return get("Match/" .. path).text
end
local function view(revision, phase, round, sequence, ready, market, lives, places, winner, opponents, ack)
    signals.AP_RoomView("AP_RoomView", {revision, phase, round, phase == 0 and 0 or 1, sequence, 1,
        winner or 0, ready, lives or {5, 5, 5, 5, 5, 5, 5, 5}, places or {0, 0, 0, 0, 0, 0, 0, 0},
        opponents or {2, 1, 4, 3, 6, 5, 8, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, market or {},
        ack == nil and (tokens[#tokens] or 0) or ack})
end
local function market(round)
    local stock = {round, 1, 10, 0, 0, 2, 1, 2, 3, 1, -2,
        1, 21, 2, 4, 1, 0, 2, 22, 3, 2, 1, 1}
    for i = #stock + 1, 41 do stock[i] = 0 end
    stock[42], stock[43] = 1, 3
    return stock
end
local function board(code, health)
    local state = {}
    for i = 1, 66 do state[i] = 0 end
    state[13], state[14], state[15], state[16], state[17], state[18] = code, 3, health, 8, 1, 2
    state[31], state[32], state[33], state[34], state[36] = 2, 2, 5, 5, 1
    state[61], state[62], state[63] = 1, 1, 2
    return state
end

assert(loadfile(extracted, "t", env))()
env.OnStart()
command("0,0,0,0,0,0")
view(1, 0, 0, 0, false)
assert(label("Status") == "等待入席" and not get("Match/Ready").active)
view(3, 2, 1, 1, false, market(1))
assert(label("Shop/Money") == "金币 10 · 1 阶 · 阵容 2 / 5 · 右侧为前排")
assert(get("Standings/Count").text == "1 真人 · 7 机器人 · 8 存活")
assert(get("Standings/Opponent").text == "我的席位 1")
assert(label("Shop/Freeze5/Text") == "解冻")
view(2, 0, 0, 0, false)
assert(label("Status") == "经营准备 · 第 1 轮")
click_at("Shop/Offer3")
command("11,1,1,3,0,0")
local first_token = tokens[#tokens]
view(4, 2, 1, 1, false, market(1), nil, nil, nil, nil, 0)
click_at("Shop/Offer1")
assert(#commands == 2, "pending input was sent twice")
click_at("Refresh")
command("11,1,1,3,0,0")
assert(tokens[#tokens] == first_token)
view(5, 2, 1, 2, false, market(1))
click_at("Shop/Team1")
click_at("Shop/Offer1")
command("12,1,2,1,1,0")
view(6, 2, 1, 3, false, market(1))
click_at("Shop/Offer5")
command("16,1,3,2,1,0")
view(7, 2, 1, 4, false, market(1))
click_at("Shop/Freeze5")
command("17,1,4,2,1,0")
view(8, 2, 1, 5, false, market(1))
click_at("Shop/Sell")
command("13,1,5,0,1,0")
view(9, 2, 1, 6, false, market(1))
click_at("Shop/Team1")
click_at("Shop/Team2")
command("14,1,6,1,2,0")
view(10, 2, 1, 7, false, market(1))
click_at("Shop/Team1")
click_at("Shop/Merge")
click_at("Shop/Team2")
command("15,1,7,1,2,0")
view(11, 2, 1, 8, false, market(1))
click_at("Shop/RewardNext")
click_at("Shop/Reward")
command("11,1,8,2,0,1")
view(12, 2, 1, 9, false, market(1))
keyboard[enum[3]]()
command("10,1,9,0,0,0")
view(13, 2, 1, 10, false, market(1))
keyboard[enum[2]]()
command("1,1,10,0,0,0")
view(14, 2, 1, 11, true, market(1))
assert(not get("Match/Ready").active and label("Hint") == "已准备，等待其他席位")
local sent = #commands
click_at("Shop/Offer1")
assert(#commands == sent)
signals.AP_RoomBattle("AP_RoomBattle", {24, 1, 1, 2, 1, board(1, 2)})
view(15, 3, 1, 11, true, market(1))
assert(get("Standings/Opponent").text == "本轮对手 · 席位 2")
assert(label("Replay/Own1"):find("3攻 · 2命", 1, true))
signals.AP_RoomBattle("AP_RoomBattle", {20, 1, 1, 2, 0, board(1, 8)})
signals.AP_RoomBattle("AP_RoomBattle", {25, 1, 3, 4, 2, board(1, 8)})
assert(label("Replay/RoundText"):find("回放 2 / 2", 1, true))
click_at("Replay/Previous")
assert(label("Replay/Own1"):find("3攻 · 8命", 1, true))
click_at("Replay/Follow")
assert(label("Replay/RoundText"):find("本轮获胜", 1, true))
local first, second = {1, 1, 21, 40, 100, 1, 0}, {1, 2, 22, 1, 1, 1, 0}
signals.AP_RoomReplay("AP_RoomReplay", {1, 3, 4, 1, 11, first, second})
assert(label("Replay/Own1"):find("3攻 · 2命", 1, true))
signals.AP_RoomReplay("AP_RoomReplay", {1, 1, 2, 1, 11, first, second})
assert(label("Replay/Own1"):find("40攻 · 100命", 1, true))
signals.AP_RoomBattle("AP_RoomBattle", {26, 1, 1, 2, 0, board(1, 3)})
assert(label("Replay/Own1"):find("40攻 · 100命", 1, true))
click_at("Replay/Follow")
assert(label("Replay/RoundText"):find("本轮获胜", 1, true))
view(16, 2, 2, 1, false, market(2))
assert(not get("Match/Replay").active and get("Match/Shop").active)
click_at("Forfeit")
assert(label("Forfeit/Text") == "确认认输" and #commands == sent)
click_at("Forfeit")
command("3,2,1,0,0,0")
view(17, 3, 2, 2, true, market(2), {0, 2, 0, 0, 0, 0, 0, 0}, {8, 0, 2, 3, 4, 5, 6, 7}, nil,
    {0, 0, 0, 0, 0, 0, 0, 0})
assert(label("Replay/RoundText") == "已淘汰")
view(18, 5, 2, 2, true, market(2), {0, 2, 0, 0, 0, 0, 0, 0}, {8, 1, 2, 3, 4, 5, 6, 7}, 2)
assert(get("Standings/Seat1Detail").text == "真人 · 第 8 名")
assert(get("Standings/Opponent").text == "获胜席位 2")
assert(label("Hint") == "我的名次 · 第 8 名")
local late = signals.AP_RoomView
local previous_token = tokens[#tokens]
env.OnDestroy()
assert(not next(signals) and not next(keyboard))
for _, control in pairs(controls) do assert(not control.click) end
late("AP_RoomView", {})
env.OnStart()
command("0,0,0,0,0,0")
view(19, 2, 2, 1, false, market(2), nil, nil, nil, nil, 0)
click_at("Shop/Reroll")
command("10,2,1,0,0,0")
assert(tokens[#tokens] > previous_token)
sent = #commands
view(17, 2, 2, 1, false, market(2), nil, nil, nil, nil, previous_token)
click_at("Shop/Offer1")
assert(#commands == sent, "a prior listener's acknowledgement unlocked new input")
env.OnDestroy()
print("M3 native UI passed shop actions, readiness, frame order, final places and listener lifecycle")
