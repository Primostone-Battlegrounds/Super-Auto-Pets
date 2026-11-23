assert(_VERSION == "Lua 5.3")
local bundle_path, bindings_path, seed = arg[1], arg[2], assert(math.tointeger(tonumber(arg[3])))
local nodes, logs = {}, {}
local cursor_click = "CursorClick"

local node_methods = {}
function node_methods:SetActive(value) self.active = value end
function node_methods:SetVisible(value) self.visible = value end
function node_methods:AddCursorEventListener(event, callback)
    assert(self.kind == "cursorArea" and self.active and self.visible)
    assert(event == cursor_click and not self.callback)
    self.callback = callback
end
function node_methods:RemoveCursorEventListener(event, callback)
    assert(event == cursor_click and self.callback == callback)
    self.callback = nil
end

for line in io.lines(bindings_path) do
    local path, kind = line:match("^([^\t]+)\t(%S+)$")
    assert(path and not nodes[path], "invalid control path " .. line)
    local parent = path:match("^(.*)/[^/]+$")
    nodes[path] = setmetatable({ kind = kind, alive = true, parent = parent and assert(nodes[parent]) },
        { __index = node_methods })
end

local sandbox = {
    assert = assert, error = error, ipairs = ipairs, math = math, next = next, pairs = pairs, select = select,
    setmetatable = setmetatable, string = string, table = table, tonumber = tonumber, tostring = tostring, type = type,
    Enum = { CursorEventType = { CursorClick = cursor_click } },
    print = function(message) logs[#logs + 1] = message end,
    script = {
        object = { FindChild = function(_, path) return nodes[path] end },
        GetParam = function(_, name)
            assert(name == "seed")
            return seed
        end,
    },
}
assert(loadfile(bundle_path, "t", sandbox))()
sandbox.OnStart()

local function label(path)
    local node = assert(nodes[path], path)
    assert(node.visible and node.active and node.kind == "text", path)
    return assert(node.text, path)
end

local function click(path)
    local node = assert(nodes[path .. "/Hit"], path)
    local target = node
    while node do
        assert(node.active and node.visible, "hidden hit area " .. path)
        node = node.parent
    end
    assert(target.callback, "missing click callback " .. path)()
end

local function shop(action, first, second)
    if action == "buy" or action == "combine" then
        click("Shop/Pet" .. first)
        click(second and ("Team" .. second) or "Shop/Buy")
    elseif action == "freeze" then
        click("Shop/Pet" .. first)
        click("Shop/Freeze")
    elseif action == "move" then
        click("Team" .. first)
        click("Team" .. second)
    elseif action == "feed" then
        click("Shop/Food" .. first)
        click("Team" .. second)
    else
        assert(action == "reroll")
        click("Shop/Reroll")
    end
end

local outcomes = { win = "胜利", draw = "平局", loss = "落败" }
local function finish(outcome, terminal)
    click("Primary")
    assert(label("Primary/Title") == "结算")
    assert(not nodes.Shop.active and nodes.Battle.active)
    assert(label("Battle/Outcome") == "本轮" .. outcomes[outcome])
    local first_event = label("Battle/Event")
    click("Battle/Replay")
    assert(label("Battle/Event") ~= first_event)
    click("Primary")
    if terminal then
        assert(label("Primary/Title") == "重开")
        assert(label("Battle/Outcome") == "单局" .. outcomes[outcome])
    else
        assert(label("Primary/Title") == "下一轮")
        click("Primary")
        assert(label("Primary/Title") == "开战")
        assert(nodes.Shop.active and not nodes.Battle.active)
    end
end

local function opening()
    assert(label("Meter"):find("第 1 轮 · 准备", 1, true))
    assert(label("Shop/Caption"):find("10 金币", 1, true))
    assert(label("Team1/Name") == "空位 1")
    assert(label("Primary/Title") == "开战")
end

opening()
click("Primary")
assert(label("Hint") == "先购买至少一只动物")
shop("buy", 1)
assert(label("Team1/Name") == "灯囊蛾")
shop("buy", 2, 1)
assert(label("Team1/Name") == "芦纹龟")
shop("move", 2, 1)
assert(label("Team1/Name") == "灯囊蛾")
shop("feed", 1, 2)
shop("freeze", 3)
assert(label("Shop/Pet3/Detail"):find("冻结", 1, true))
shop("reroll")
finish("win")
assert(label("Shop/Pet3/Detail"):find("冻结", 1, true))
for offer = 1, 3 do shop("buy", offer) end
shop("move", 2, 1)
finish("win")

local combines = { [4] = 1, [6] = 3, [9] = 3 }
for round = 3, 11 do
    if combines[round] then shop("combine", combines[round], 1) end
    shop("feed", 1, 1)
    shop("feed", 2, 1)
    if not combines[round] then
        shop("reroll")
        shop("feed", 1, 1)
    end
    finish(round == 7 and "draw" or "win", round == 11)
end
assert(logs[#logs] == "AUTO_PETS_M1 phase=ended round=11 wins=10 lives=5 final=win")
click("Primary")
opening()

shop("buy", 1)
for round = 1, 5 do finish("loss", round == 5) end
assert(logs[#logs] == "AUTO_PETS_M1 phase=ended round=5 wins=0 lives=0 final=loss")
click("Primary")
opening()

shop("buy", 1)
shop("buy", 3)
click("Team2")
click("Shop/Merge")
click("Team1")
assert(label("Team2/Name") == "空位 2")
shop("reroll")
shop("combine", 1, 1)
assert(label("Team1/Detail"):find("Lv2", 1, true))
assert(label("Shop/Reward/Detail"):find("1/1", 1, true))
click("Shop/RewardNext")
click("Shop/Reward")
click("Shop/Buy")
assert(label("Hint") == "金币不足")
click("Shop/Reward")
click("Team1")
click("Shop/Sell")
assert(label("Team1/Name") == "空位 1")

sandbox.OnDestroy()
for _, node in pairs(nodes) do assert(not node.callback) end
for _, line in ipairs(logs) do print(line) end
print("Native UI simulation passed both terminal states, draw, restart, and shop input")
