local controls = {}
for _, name in ipairs({"Status", "Refresh", "Ready", "Advance"}) do
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
game = {
    ServerSignal = function(name)
        assert(name == "AP_DuelRequest")
        local arguments = {}
        return {
            AddInt = function(_, value)
                arguments[#arguments + 1] = value
            end,
            SendSignal = function()
                assert(#arguments == 2)
                sent[#sent + 1] = arguments
            end,
        }
    end,
}
script = {
    object = {GetChild = function(_, name) return assert(controls[name]) end},
    RegisterServerSignalHandler = function(self, name, callback)
        assert(name == "AP_DuelSnapshot" and self.receive == nil)
        self.receive = callback
    end,
    UnregisterServerSignalHandler = function(self, name)
        assert(name == "AP_DuelSnapshot" and self.receive ~= nil)
        self.receive = nil
    end,
}
local function receive(players, round, phase, ready, continued, settlements, version)
    script.receive("AP_DuelSnapshot", {players, 1, round, phase, ready, continued, settlements, version})
end

dofile(assert(arg[1]))
OnStart()
assert(sent[1][1] == 0 and sent[1][2] == 0)
receive(1, 1, 0, false, false, 0, 1)
assert(controls.Status.text:find("等待第 2 位玩家", 1, true))
controls.Ready.callback()
assert(sent[2][1] == 1 and sent[2][2] == 1)
receive(2, 1, 1, true, false, 1, 4)
local settlement = controls.Status.text
assert(settlement:find("本轮已结算", 1, true))
receive(2, 1, 0, true, false, 0, 3)
assert(controls.Status.text == settlement)
controls.Advance.callback()
assert(sent[3][1] == 2 and sent[3][2] == 1)
receive(2, 2, 0, false, false, 1, 6)
controls.Refresh.callback()
assert(sent[4][1] == 0 and sent[4][2] == 2)
receive(2, 2, 2, true, false, 2, 10)
assert(controls.Status.text:find("验证完成", 1, true))
OnDestroy()
assert(script.receive == nil)
for _, control in pairs(controls) do
    assert(control.callback == nil)
end
OnStart()
assert(sent[5][1] == 0 and sent[5][2] == 0)
OnDestroy()
