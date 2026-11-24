local mode, extracted, bindings = assert(arg[1]), assert(arg[2]), assert(arg[3])
local count = assert(tonumber(arg[4]))
package.path = "src/?.lua;" .. package.path
local standings = dofile("platform/multiplayer_standings.lua")
local room = require("autopets.room")
local duel_host = require("autopets.duel_host")
local controls, writes = {}, 0
for name in io.lines(bindings) do
    controls[name] = setmetatable({}, {__newindex = function(control, key, value)
        assert(key == "text")
        rawset(control, "current", value)
        writes = writes + 1
    end})
end

local panel = {GetChild = function(_, name) return assert(controls[name], name) end}
local function value(name)
    return assert(controls[name], name).current
end

local signal, request
if mode == "duel" then
    signal, request = "AP_DuelSnapshot", "AP_DuelRequest"
    assert(count == 4 or count == 7)
else
    assert(mode == "room" and count == 1)
    signal, request = "AP_EightProbeView", "AP_EightProbeRequest"
end
local callback, refreshes
refreshes = 0
local env = setmetatable({
    script = {
        object = {GetChild = function(_, name)
            assert(name == "Standings")
            return panel
        end},
        RegisterServerSignalHandler = function(_, name, handler)
            assert(name == signal and not callback)
            callback = handler
        end,
        UnregisterServerSignalHandler = function(_, name)
            assert(name == signal and callback)
            callback = nil
        end,
    },
    game = {
        ServerSignal = function(name)
            assert(name == request)
            local ints = 0
            return {
                AddInt = function(_, input)
                    assert(input == 0, "initial standings read must not mutate the game")
                    ints = ints + 1
                end,
                SendSignal = function()
                    assert(callback and ints == count)
                    refreshes = refreshes + 1
                end,
            }
        end,
    },
}, {__index = _G})
assert(loadfile(extracted, "t", env))()
env.OnStart()
assert(refreshes == 1)
if mode == "duel" then
    callback(signal, {1, 0, 1, 0, false, false, 0, 1, 0, 0, 0, 0, 0})
    assert(value("Phase"):find("等待入席", 1, true))
    callback(signal, {2, 2, 1, 0, true, false, 0, 3, 2, 0, 0, 57, 1})
    assert(value("Seat2") == "席位 2 · 我")
    assert(value("Seat2Detail") == "真人 · 已准备")
    local before = writes
    callback(signal, {1, 0, 1, 0, false, false, 0, 2, 0, 0, 0, 0, 0})
    assert(writes == before)
    callback(signal, {2, 2, 2, 2, true, false, 2, 4, 3, 0, 1, 0, 2})
    assert(value("Phase") == "第 2 轮 · 两轮同步验证完成")
    assert(value("Opponent") == "" and value("Seat2Detail") == "真人")
    callback(signal, {2, 2, 3, 3, true, false, 2, 5, 2, 0, 0, 0, 0, 4, 5, 0})
    assert(value("Phase") == "第 3 轮 · 战斗计算")
    assert(value("Opponent") == "本轮对手 · 席位 1" and value("Seat2Detail") == "真人 · 4 命")
    callback(signal, {2, 2, 3, 2, true, false, 3, 6, 2, 2, 5, 0, 0, 4, 0, 2})
    assert(value("Opponent") == "获胜席位 2" and value("Seat2Detail") == "真人 · 冠军")
else
    local empty = {0, 0, 0, 0, 0, 0, 0, 0}
    callback(signal, {1, 1, 0, 5, 0, empty, empty})
    assert(value("Phase") == "入席等待 · 5 秒" and value("Seat8Detail") == "空席")
    callback(signal, {3, 1, 1, 0, 4, {1, 2, 2, 2, 2, 2, 2, 2}, {0, 4, 4, 4, 4, 4, 4, 4}})
    assert(value("Count") == "1 真人 · 7 机器人" and value("Seat1") == "席位 1 · 我")
    assert(value("Seat8Detail") == "机器人 · 工作 4")
    local before = writes
    callback(signal, {2, 1, 0, 1, 0, empty, empty})
    assert(writes == before and value("Seat8Detail") == "机器人 · 工作 4")
    callback(signal, {4, 1, 1, 0, 4, {1, 3, 2, 2, 2, 2, 2, 2}, {0, 0, 4, 4, 4, 4, 4, 4}})
    assert(value("Seat2Detail") == "真人 · 暂离")
end
local stale_callback = callback
env.OnDestroy()
assert(not callback)
stale_callback(signal, {})
env.OnStart()
assert(refreshes == 2 and callback)
env.OnDestroy()

local render = standings.bind(panel, mode)
if mode == "room" then
    local solo = room.new(7, {wait_ms = 5, preparation_ms = 2, settlement_ms = 2, starting_lives = 1, max_rounds = 8})
    assert(solo:join("P1", 0) == 1)
    local view = standings.room(assert(solo:snapshot("P1")), 0)
    assert(render(view) and not view.shop and not view.battle)
    assert(value("Phase") == "等待入席 · 1 秒")
    assert(solo:tick(5))
    view = standings.room(assert(solo:snapshot("P1")), 5)
    assert(render(view) and value("Count") == "1 真人 · 7 机器人 · 8 存活")
    assert(value("Opponent"):find("本轮对手", 1, true))
    assert(value("Seat8Detail") == "机器人 · 1 命 · 已准备")
    local before = writes
    assert(not render(view) and writes == before)
    for _ = 1, 24 do
        local state = assert(solo:snapshot("P1"))
        if state.phase == "ended" then break end
        assert(solo:tick(state.deadline))
        assert(render(standings.room(assert(solo:snapshot("P1")), state.deadline)))
    end
    local final = solo:public_snapshot()
    assert(final.phase == "ended" and final.winner)
    assert(value("Opponent") == "获胜席位 " .. final.winner)
    for _, seat in ipairs(final.seats) do
        local display = value("Seat" .. seat.seat .. "Detail")
        local rank = seat.place == 1 and "冠军" or ("第 " .. seat.place .. " 名")
        assert(display:find(rank, 1, true))
    end

    local odd = room.new(9, {wait_ms = 100, preparation_ms = 5})
    for index = 1, 8 do assert(odd:join("P" .. index, 0) == index) end
    assert(odd:leave("P2", 1))
    local rest
    for _, seat in ipairs(odd:public_snapshot().seats) do
        if seat.pairing == "bye" and seat.active then rest = seat.seat end
    end
    assert(rest)
    local fresh = standings.bind(panel, mode)
    assert(fresh(standings.room(assert(odd:snapshot("P" .. rest)), 1)))
    assert(value("Opponent") == "本轮轮空" and value("Count") == "8 真人 · 0 机器人 · 7 存活")
    assert(value("Seat2Detail") == "真人 · 第 8 名 · 退出")
else
    local host = duel_host.new(7, "P1", "P2", {reconnect_ms = 20})
    local first, first_frames = host:connect("P1", 0)
    local second, joined = host:connect("P2", 1)
    local function own(frames)
        for _, frame in ipairs(frames) do
            if frame.connection == first then return frame.state end
        end
        error("missing viewer's frame")
    end
    local view = standings.duel(own(first_frames), 0)
    assert(render(view) and not view.shop and not view.battle)
    assert(value("Opponent") == "等待原席位恢复")
    assert(render(standings.duel(own(joined), 1)))
    assert(value("Opponent") == "本轮对手 · 席位 2")
    assert(value("Seat1Detail") == "真人 · 5 命" and value("Seat2Detail") == "真人 · 5 命")
    local left, frames = host:disconnect(second, 2)
    assert(left and render(standings.duel(own(frames), 2)))
    assert(value("Seat2Detail") == "真人 · 暂离")
    local ok, timed = host:tick(22)
    assert(ok and render(standings.duel(own(timed), 22)))
    assert(value("Opponent") == "获胜席位 1" and value("Seat1Detail") == "真人 · 冠军")
    assert(value("Seat2Detail") == "真人 · 第 2 名")
end

print("Native " .. mode .. " standings passed readback signal, two lifecycle runs, and authoritative state display")
