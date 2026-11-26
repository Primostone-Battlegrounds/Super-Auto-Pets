local source, layout, captures = assert(arg[1]), assert(arg[2]), assert(arg[3])
local order = {}
for line in io.lines(layout) do order[#order + 1] = line end
local output = assert(io.open(captures, "w"))
local function simulate()
    local controls, signals, commands = {}, {}, {}
    local function get(path) return assert(controls[path], path) end
    for _, line in ipairs(order) do
        local path, active, visible, x, y, width, height = line:match("([^\t]+)\t([01])\t([01])\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)")
        controls[path] = {
            alive = true, active = active == "1", visible = visible == "1", events = {}, keys = {},
            x = x, y = y, width = width, height = height,
            GetChild = function(_, name) return get(path .. "/" .. name) end,
            FindChild = function(_, name) return get(path .. "/" .. name) end,
            SetActive = function(self, value) assert(type(value) == "boolean"); self.active = value end,
            SetVisible = function(self, value) assert(type(value) == "boolean"); self.visible = value end,
            SetAnchoredPosition = function(self, px, py) self.x, self.y = px, py end,
            SetSizeDelta = function(self, w, h) self.width, self.height = w, h end,
            GetAnchoredPosition = function(self) return tonumber(self.x), tonumber(self.y) end,
            GetSizeDelta = function(self) return tonumber(self.width), tonumber(self.height) end,
            GetSiblingIndex = function(self) return self.sibling_index or 2 end,
            SetSiblingIndex = function(self, index) self.sibling_index = index end,
            SetAsLastSibling = function(self) self.sibling_index = 99 end,
            SetImage = function(self, _, image) self.image = image end,
            AddCursorEventListener = function(self, event, callback) assert(not self.events[event]); self.events[event] = callback end,
            RemoveCursorEventListener = function(self, event, callback)
                assert(self.events[event] == callback); self.events[event] = nil
            end,
            AddKeyEventListener = function(self, event, callback) assert(not self.keys[event]); self.keys[event] = callback end,
            RemoveKeyEventListener = function(self, event, callback) assert(self.keys[event] == callback); self.keys[event] = nil end,
        }
    end
    local function colour(r, g, b) return string.format("#%02x%02x%02x", r, g, b) end
    local enabled
    local env = setmetatable({
        game = {
            ServerSignal = function(name)
                local args = {}
                return {
                    AddInt = function(_, value) args[#args + 1] = assert(math.tointeger(value)) end,
                    AddBool = function(_, value) assert(type(value) == "boolean"); args[#args + 1] = tostring(value) end,
                    SendSignal = function() commands[#commands + 1] = name .. ":" .. table.concat(args, ",") end,
                }
            end,
        },
        Color = colour,
        Enum = {
            CursorEventType = {CursorDown = 1, CursorClick = 2, CursorBeginDrag = 3, CursorDrag = 4, CursorEndDrag = 5},
            ImageSource = {StaticReference = 1}, ImageType = {Stretch = 1},
            KeyEventType = {KeyboardCharacterSkill1KeyDown = 1, KeyboardInteractKeyDown = 2, KeyboardCharacterSkill2KeyDown = 3},
        },
        script = {
            object = {FindChild = function(_, path) return get(path) end, GetChild = function(_, path) return get(path) end},
            GetParam = function(_, name) assert(name == "seed"); return 8 end,
            EnableUpdate = function(_, value) enabled = value end,
            RegisterServerSignalHandler = function(_, name, callback) assert(not signals[name]); signals[name] = callback end,
            UnregisterServerSignalHandler = function(_, name) assert(signals[name]); signals[name] = nil end,
        },
    }, {__index = _G})
    assert(loadfile(source, "t", env))()
    env.OnStart()
    assert(commands[#commands] == "AP_GameChooseMode:0,false,1")
    local function press(path)
        local target = get(path)
        local ancestor = path
        while ancestor do
            local control = get(ancestor)
            assert(control.active and control.visible, ancestor)
            ancestor = ancestor:match("^(.*)/")
        end
        if target.events[1] then target.events[1]({touchId = 1}) end
        assert(target.events[2], path)({touchId = 1})
    end
    local function receive(name, values) assert(signals[name], name)(name, values) end
    local function view(mode, count, token, duel_reason, room_reason, loading, requested, reason)
        receive("AP_GameLobby", {mode, count, loading or 0, requested or 0, reason or 0,
            token, loading and 2 or 1, duel_reason, room_reason, requested and token or 0})
    end
    local function start_count()
        local count = 0
        for _, command in ipairs(commands) do
            if command:match("^AP_GameChooseMode:[28],") then count = count + 1 end
        end
        return count
    end
    local function expect(command) assert(commands[#commands] == command, tostring(commands[#commands])) end
    local function capture(name)
        for _, row in ipairs(order) do
            local path = row:match("^[^\t]+")
            local c = get(path)
            local text = c.text and c.text:gsub("[^%w ._-]", function(char) return string.format("%%%02X", char:byte()) end) or "~"
            output:write(table.concat({name, path, c.active and 1 or 0, c.visible and 1 or 0, c.x, c.y,
                c.width, c.height, c.image or "", c.imageColor or c.color or "", c.fontColor or "", text}, "\t"), "\n")
        end
    end
    local function destroy()
        env.OnDisable()
        assert(not enabled)
        env.OnDestroy()
        assert(next(signals) == nil)
        for _, c in pairs(controls) do assert(next(c.events) == nil and next(c.keys) == nil) end
    end
    return {press = press, receive = receive, get = get, view = view, expect = expect, capture = capture,
        destroy = destroy, start_count = start_count, update = env.OnUpdate}
end

local function market(round, empty)
    local raw = {round, 1, 10, 0, 0, 2, 1, 2, 3, 1, -2, 1, 21, 3, 2, 1, 1, 2, 22, 3, 2, 1, 1}
    for i = #raw + 1, 41 do raw[i] = 0 end
    if empty then
        raw[6] = 0
        for i = 12, #raw do raw[i] = 0 end
    end
    return raw
end
local function duel_snapshot(version, phase, ready, sequence, ack)
    return {2, 1, 1, phase, ready, false, 0, version, sequence or 1, phase == 2 and 2 or 0, 0,
        30, ack or 0, phase == 2 and 0 or 5, 5, 0}
end
local function room_snapshot(revision, phase, human, lives, places, winner, ack)
    return {revision, phase, 1, 1, revision, human, winner or 0, false,
        lives or {5,5,5,5,5,5,5,5}, places or {0,0,0,0,0,0,0,0}, {2,1,4,3,6,5,8,7}, {0,0,0,0,0,0,0,0},
        market(1), ack or 0, 42}
end

local practice = simulate()
assert(practice.get("Lobby/Status").text == "同步中…")
practice.press("Lobby/Guide/Hit")
assert(practice.get("Lobby/Help").active and not practice.get("Lobby/Choices").active)
assert(practice.get("Lobby/Guide/Title").text == "返回主菜单")
practice.expect("AP_GameChooseMode:0,false,1")
practice.view(0, 1, 1, 1, 0)
assert(practice.get("Lobby/Help").active and not practice.get("Lobby/Status").active)
practice.capture("lobby_guide")
practice.press("Lobby/Guide/Hit")
assert(not practice.get("Lobby/Help").active and practice.get("Lobby/Choices").active)
assert(practice.get("Lobby/Guide/Title").text == "玩法说明")
practice.capture("menu")
practice.press("Lobby/Choices/Practice/Hit")
practice.press("Practice/Menu/Continue/Hit")
local function practice_press(path) practice.press("Practice/" .. path .. "/Hit") end
practice_press("OpenMenu")
practice.capture("practice_pause")
practice_press("Menu/Audio")
assert(practice.get("Practice/Menu/Audio/Title").text == "音效：关闭")
practice_press("Menu/Audio")
assert(practice.get("Practice/Menu/Audio/Title").text == "音效：开启")
practice_press("Menu/NewGame")
assert(practice.get("Practice/Restart").active and practice.get("Practice/Restart/Heading").text == "放弃本局？")
practice_press("Restart/Cancel")
assert(practice.get("Practice/Menu").active and not practice.get("Practice/Restart").active)
practice_press("Menu/Continue")
assert(not practice.get("Practice/Menu").active and practice.get("Practice/Money/Value").text == "10")
local function shop(action, from, to)
    if action == "buy" or action == "combine" then
        practice_press("Shop/Pet" .. from)
        practice_press(to and "Team" .. to or "Shop/Buy")
    elseif action == "feed" then
        practice_press("Shop/Food" .. from)
        practice_press("Team" .. to)
    elseif action == "move" or action == "sell" then
        practice_press("Team" .. from)
        practice_press(to and "Team" .. to or "Shop/Sell")
    elseif action == "reward" then
        practice_press("Shop/Reward")
        practice_press("Shop/Buy")
    else
        assert(action == "reroll")
        practice_press("Shop/Reroll")
    end
end
local rounds = dofile("tests/native/release-practice-rounds.lua")
local outcomes = {win = "胜利", loss = "落败", draw = "平局"}
for round, actions in ipairs(rounds) do
    assert(practice.get("Practice/Shop/Caption").text == ("商店 · %d 阶"):format(math.min(6, (round + 1) // 2)))
    for index = 2, #actions do shop(table.unpack(actions[index])) end
    if round == 1 then practice.capture("practice_shop") end
    if round == 11 then practice.capture("practice_tier_six") end
    practice_press("Primary")
    assert(practice.get("Practice/Primary/Title").text == "跳过回放")
    if round == 1 then practice.capture("practice_battle") end
    practice_press("Primary")
    assert(practice.get("Practice/Battle/Outcome").text == "本轮" .. outcomes[actions[1]])
    practice_press("Primary")
    if round < #rounds then practice_press("Primary") end
end
assert(practice.get("Practice/Primary/Title").text == "再挑战本局")
assert(practice.get("Practice/Wins/Value").text == "10 / 10" and practice.get("Practice/Lives/Value").text == "1 / 5")
practice.capture("practice_result")
practice_press("Primary")
assert(practice.get("Practice/Round/Value").text == "第 1 轮 · 准备")
practice.press("Practice/OpenMenu/Hit")
practice.press("Practice/Menu/Back/Hit")
practice.expect("AP_GameChooseMode:0,false,2")
assert(practice.get("Lobby/Choices/Practice/Title").text == "继续 AI 练习")
practice.press("Lobby/Choices/Practice/Hit")
practice.press("Practice/Menu/Continue/Hit")
assert(practice.get("Practice/Round/Value").text == "第 1 轮 · 准备")
practice.destroy()

local duel = simulate()
duel.view(0, 1, 1, 1, 3, 1)
duel.press("Lobby/Choices/Duel/Hit")
assert(duel.start_count() == 0)
assert(duel.get("Lobby/Status").text:find("加载中"))
assert(duel.get("Lobby/Feedback").text:find("等待好友"))
duel.capture("waiting_friend")
duel.update(2)
duel.expect("AP_GameChooseMode:0,false,2")
duel.view(0, 2, 2, 0, 0)
assert(duel.get("Lobby/Feedback").text:find("已到齐"))
duel.view(0, 1, 1, 1, 3, 1)
assert(duel.get("Lobby/Feedback").text:find("已到齐"))
duel.press("Lobby/Choices/Duel/Hit")
duel.expect("AP_GameChooseMode:2,false,3")
duel.press("Lobby/Choices/Duel/Hit")
duel.press("Lobby/Choices/Room/Hit")
assert(duel.start_count() == 1)
duel.view(2, 2, 3, 4, 4, 0, 2)
assert(duel.get("Practice/Team1/Portrait").parent == duel.get("Duel/ReplayBoard"))
duel.expect("AP_DuelRequest:0,0,0,0,0,0,0")
duel.receive("AP_DuelSnapshot", duel_snapshot(1, 0, false))
duel.receive("AP_DuelMarket", {1, 1, market(1, true)})
duel.press("Duel/Ready")
assert(duel.get("Duel/Status").text:find("请先购买至少一只动物"))
duel.expect("AP_DuelRequest:0,0,0,0,0,0,0")
assert(duel.get("Duel/Status").text:find("余 30 秒"))
duel.update(1)
assert(duel.get("Duel/Status").text:find("余 29 秒"))
duel.press("Duel/MarketOffers/Buy1")
duel.expect("AP_DuelRequest:11,1,1,1,1,0,0")
duel.receive("AP_DuelSnapshot", duel_snapshot(2, 0, false, 1, 1))
assert(duel.get("Duel/Status").text:find("操作未生效"))
duel.receive("AP_DuelMarket", {1, 2, market(1)})
duel.capture("duel_shop")
duel.receive("AP_DuelSnapshot", duel_snapshot(3, 2, false, 2, 1))
assert(duel.get("Duel/Status").text:find("告负"))
for _, name in ipairs({"MarketOffers", "Ready", "Advance", "Leave", "Replay"}) do
    assert(not duel.get("Duel/" .. name).active and not duel.get("Duel/" .. name).visible, name)
end
duel.capture("duel_result")
duel.press("Duel/Back/Hit")
duel.view(0, 2, 4, 0, 0)
assert(duel.get("Lobby/Continue").active and not duel.get("Lobby/Choices").active)
duel.press("Lobby/Continue/Hit")
assert(duel.get("Duel").active)
duel.destroy()
assert(duel.get("Practice/Team1/Portrait").parent == duel.get("Practice/Team1"))
assert(duel.get("Practice/Team1/Portrait").y == 27 and duel.get("Practice/Team1/Portrait").sibling_index == 2)

local leaving_duel = simulate()
leaving_duel.view(2, 2, 0, 4, 4)
leaving_duel.receive("AP_DuelSnapshot", duel_snapshot(1, 0, false))
leaving_duel.receive("AP_DuelMarket", {1, 1, market(1)})
leaving_duel.press("Duel/Leave")
assert(leaving_duel.get("Duel/LeaveLabel").text == "确认认输")
leaving_duel.expect("AP_DuelRequest:0,0,0,0,0,0,0")
leaving_duel.press("Duel/Leave")
leaving_duel.expect("AP_DuelRequest:6,1,1,1,0,0,0")
leaving_duel.destroy()

local room = simulate()
room.press("Lobby/Choices/Room/Hit")
assert(room.start_count() == 0 and room.get("Lobby/Feedback").text:find("确认玩家人数"))
room.view(0, 1, 1, 1, 0)
room.press("Lobby/Choices/Room/Hit")
room.expect("AP_GameChooseMode:8,false,2")
assert(room.get("Lobby/Feedback").text:find("正在发起"))
assert(room.get("Lobby/Cancel").active)
room.update(6)
room.expect("AP_GameChooseMode:0,false,3")
assert(room.get("Lobby/Feedback").text:find("可以重试"))
assert(room.get("Lobby/Status").text == "同步中…")
assert(not room.get("Lobby/Cancel").active)
room.press("Lobby/Choices/Room/Hit")
assert(room.start_count() == 1, "the old availability snapshot must expire")
room.view(0, 1, 3, 1, 3, 1)
room.press("Lobby/Choices/Room/Hit")
assert(room.start_count() == 1)
assert(room.get("Lobby/Feedback").text:find("再点一次"))
room.press("Lobby/Choices/Room/Hit")
room.expect("AP_GameChooseMode:8,true,4")
room.view(8, 1, 4, 4, 4, 1, 8)
assert(room.get("Practice/Shop/Pet1/Portrait").parent == room.get("Room/Match/Replay"))
room.expect("AP_RoomRequest:0,0,0,0,0,0,0")
local empty_room = room_snapshot(1, 2, 1)
empty_room[13] = market(1, true)
room.receive("AP_RoomView", empty_room)
room.press("Room/Match/Ready/Hit")
assert(room.get("Room/Match/Hint").text:find("请先购买至少一只动物"))
room.expect("AP_RoomRequest:0,0,0,0,0,0,0")
assert(room.get("Room/Match/Status").text:find("余 42 秒"))
room.update(1)
assert(room.get("Room/Match/Status").text:find("余 41 秒"))
assert(room.get("Room/Match/Shop").active and room.get("Room/Match/Shop").visible)
assert(room.get("Room/Standings/Count").text:find("7 机器人"))
room.press("Room/Match/Shop/Offer1/Hit")
room.expect("AP_RoomRequest:11,1,1,1,0,0,1")
room.capture("room_shop")
local future_frame = {}
for index = 1, 66 do future_frame[index] = 0 end
room.receive("AP_RoomBattle", {11, 2, 1, 2, 0, future_frame})
room.receive("AP_RoomView", room_snapshot(2, 5, 1, {3,0,0,0,0,0,0,0}, {1,2,3,4,5,6,7,8}, 1, 1))
assert(room.get("Room/Match/Hint").text:find("第 1 名"))
for _, name in ipairs({"Previous", "Forward", "Follow"}) do
    assert(not room.get("Room/Match/Replay/" .. name).active and not room.get("Room/Match/Replay/" .. name).visible, name)
end
room.capture("room_result")
room.press("Room/Back/Hit")
room.expect("AP_GameChooseMode:0,false,5")
assert(room.get("Lobby").active and not room.get("Room").active)
room.destroy()
assert(room.get("Practice/Shop/Pet1/Portrait").parent == room.get("Practice/Shop/Pet1"))

local leaving_room = simulate()
leaving_room.view(8, 1, 0, 4, 4)
leaving_room.receive("AP_RoomView", room_snapshot(1, 2, 1))
leaving_room.press("Room/Match/Forfeit/Hit")
assert(leaving_room.get("Room/Match/Forfeit/Text").text == "确认认输")
leaving_room.expect("AP_RoomRequest:0,0,0,0,0,0,0")
leaving_room.press("Room/Match/Forfeit/Hit")
leaving_room.expect("AP_RoomRequest:3,1,1,0,0,0,1")
leaving_room.destroy()

local cancelled = simulate()
cancelled.view(0, 1, 1, 1, 0)
cancelled.press("Lobby/Choices/Room/Hit")
cancelled.expect("AP_GameChooseMode:8,false,2")
cancelled.press("Lobby/Guide/Hit")
assert(cancelled.get("Lobby/Help").active and not cancelled.get("Lobby/Cancel").active)
cancelled.expect("AP_GameChooseMode:8,false,2")
cancelled.press("Lobby/Guide/Hit")
assert(cancelled.get("Lobby/Cancel").active)
cancelled.press("Lobby/Cancel/Hit")
assert(cancelled.get("Lobby/Feedback").text:find("已停止等待"))
cancelled.press("Lobby/Guide/Hit")
cancelled.view(8, 1, 2, 4, 4, 0, 8)
assert(cancelled.get("Lobby/Help").active and not cancelled.get("Lobby/Continue").active)
cancelled.press("Lobby/Guide/Hit")
assert(cancelled.get("Lobby").active and cancelled.get("Lobby/Continue").active and not cancelled.get("Room").active)
cancelled.press("Lobby/Continue/Hit")
assert(cancelled.get("Room").active)
cancelled.destroy()

local guest = simulate()
guest.view(0, 2, 1, 6, 6)
guest.press("Lobby/Choices/Duel/Hit")
guest.press("Lobby/Choices/Room/Hit")
assert(guest.start_count() == 0 and guest.get("Lobby/Feedback").text:find("等待关卡内的发起者"))
guest.view(2, 2, 0, 4, 4)
assert(guest.get("Duel").active)
guest.destroy()
output:close()
print("Game readback: six-tier practice; zero ineligible starts, one eligible request, timeout, cancel, stale replies, guest permissions; duel and room ready, leave, shop and terminal.")
