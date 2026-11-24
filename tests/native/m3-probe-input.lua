local extracted = assert(arg[1])
local click = "CursorClick"
local cursor, signals, sent = {}, {}, {}
local controls = {
    Status = {},
    Roster = {},
    Private = {},
    LuaRequest = {alive = true},
}
controls.LuaRequest.AddCursorEventListener = function(_, event, handler)
    assert(event == click and not cursor[event])
    cursor[event] = handler
end
controls.LuaRequest.RemoveCursorEventListener = function(_, event, handler)
    assert(cursor[event] == handler)
    cursor[event] = nil
end
local logs = {}
local env = setmetatable({
    Enum = {CursorEventType = {CursorClick = click}},
    script = {
        object = {GetChild = function(_, name) return assert(controls[name]) end},
        RegisterServerSignalHandler = function(_, name, handler)
            assert(not signals[name])
            signals[name] = handler
        end,
        UnregisterServerSignalHandler = function(_, name)
            assert(signals[name])
            signals[name] = nil
        end,
    },
    game = {
        ServerSignal = function(name)
            assert(name == "AP_EightProbeRequest")
            return {
                AddInt = function(request, value) request.path = value end,
                SendSignal = function(request) sent[#sent + 1] = request.path end,
            }
        end,
    },
    print = function(line) logs[#logs + 1] = line end,
}, {__index = _G})
assert(loadfile(extracted, "t", env))()
env.OnStart()
assert(sent[1] == 0)

local function view(revision, field, seat, seconds, batch, states, work)
    signals.AP_EightProbeView("AP_EightProbeView", {revision, field, seat, seconds, batch, states, work})
end
local function reply(seat, path, native, lua)
    signals.AP_EightProbeReply("AP_EightProbeReply", {seat, path, native, lua})
end
local zeros = {0, 0, 0, 0, 0, 0, 0, 0}
view(1, 1, 0, 5, 0, zeros, zeros)
assert(controls.Status.text:find("入席等待 5 秒", 1, true))
local logical_states = {1, 2, 2, 2, 2, 2, 2, 2}
view(3, 1, 1, 0, 4, logical_states, {0, 4, 4, 4, 4, 4, 4, 4})
assert(controls.Status.text:find("场内真人 1", 1, true))
assert(controls.Roster.text:find("8  机器人 · 工作 4", 1, true))
view(2, 1, 0, 1, 0, zeros, zeros)
assert(controls.Roster.text:find("8  机器人 · 工作 4", 1, true))

cursor[click]()
assert(sent[2] == 2)
reply(1, 2, 1, 1)
assert(controls.Private.text:find("原生 1  ·  界面 1", 1, true))
reply(1, 1, 1, 0)
reply(2, 2, 2, 2)
assert(controls.Private.text:find("原生 1  ·  界面 1", 1, true))
env.OnDestroy()
assert(next(signals) == nil and next(cursor) == nil)
env.OnStart()
assert(sent[3] == 0)
reply(1, 0, 2, 3)
assert(controls.Private.text == "")
view(5, 1, 1, 0, 4, logical_states, {0, 4, 4, 4, 4, 4, 4, 4})
assert(controls.Private.text:find("原生 2  ·  界面 3", 1, true))
env.OnDestroy()
assert(next(signals) == nil and next(cursor) == nil)
print(string.format("M3 probe Lua simulation: 2 starts, 2 teardowns, %d accepted messages", #logs))
