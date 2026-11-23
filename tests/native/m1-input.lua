assert(_VERSION == "Lua 5.3")
local bundle_path, bindings_path, seed = arg[1], arg[2], assert(math.tointeger(tonumber(arg[3])))
local nodes, logs = {}, {}
local cursor_click = "CursorClick"
local capture_file = assert(io.open(arg[4], "w"))
local ticking, image_writes = false, 0
local full_formation_captured = false

local node_methods = {}
function node_methods:SetActive(value) self.active = value end
function node_methods:SetVisible(value) self.visible = value end
function node_methods:SetAnchoredPosition(x, y) self.x, self.y = x, y end
function node_methods:SetSizeDelta(width, height) self.width, self.height = width, height end
function node_methods:SetImage(source, image)
    assert(source == "StaticReference" and (image == 100001 or image == 106025))
    self.image = image
    image_writes = image_writes + 1
end
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
    local path, kind, x, y, width, height = line:match("^([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)$")
    assert(path and not nodes[path], "invalid control path " .. line)
    local parent = path:match("^(.*)/[^/]+$")
    nodes[path] = setmetatable({ kind = kind, alive = true, parent = parent and assert(nodes[parent]),
        x = assert(tonumber(x)), y = assert(tonumber(y)), width = assert(tonumber(width)), height = assert(tonumber(height)) },
        { __index = node_methods })
end

local function colour(r, g, b, a)
    assert(a == 255)
    return string.format("#%02x%02x%02x", r, g, b)
end

local sandbox = {
    assert = assert, error = error, ipairs = ipairs, math = math, next = next, pairs = pairs, select = select,
    setmetatable = setmetatable, string = string, table = table, tonumber = tonumber, tostring = tostring, type = type,
    Enum = {
        CursorEventType = { CursorClick = cursor_click },
        ImageSource = { StaticReference = "StaticReference" },
        ImageType = { Stretch = "Stretch" },
    },
    Color = colour,
    print = function(message) logs[#logs + 1] = message end,
    script = {
        object = { FindChild = function(_, path) return nodes[path] end },
        GetParam = function(_, name)
            assert(name == "seed")
            return seed
        end,
        EnableUpdate = function(_, value) ticking = value end,
    },
}
assert(loadfile(bundle_path, "t", sandbox))()
sandbox.OnStart()

local function flag(value)
    if value == nil then return "" end
    return value and "1" or "0"
end

local function capture(frame)
    local paths = {}
    for path in pairs(nodes) do paths[#paths + 1] = path end
    table.sort(paths)
    for _, path in ipairs(paths) do
        local node = nodes[path]
        local content = node.text == nil and "~" or node.text:gsub("%%", "%%25")
            :gsub("\t", "%%09"):gsub("\n", "%%0A"):gsub("\r", "%%0D"):gsub("~", "%%7E")
        capture_file:write(table.concat({frame, path, flag(node.active), flag(node.visible),
            node.x or "", node.y or "", node.width or "", node.height or "", node.image or "",
            node.imageColor or "", node.fontColor or "", content}, "\t"), "\n")
    end
end

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
local function event_card(pattern)
    for _, team in ipairs({"Team", "Enemy"}) do
        for slot = 1, 5 do
            local path = team .. slot
            if label(path .. "/Tag"):match(pattern) then return path end
        end
    end
end

local function inward_formation()
    assert(nodes.Team1.x + nodes.Team1.width / 2 < nodes.Enemy1.x - nodes.Enemy1.width / 2)
    for slot = 2, 5 do
        local ally, front_ally = nodes["Team" .. slot], nodes["Team" .. (slot - 1)]
        local enemy, front_enemy = nodes["Enemy" .. slot], nodes["Enemy" .. (slot - 1)]
        assert(ally.x + ally.width / 2 < front_ally.x - front_ally.width / 2)
        assert(enemy.x - enemy.width / 2 > front_enemy.x + front_enemy.width / 2)
    end
end

local function mirrored_portrait()
    for ally = 1, 5 do
        for enemy = 1, 5 do
            local left, right = "Team" .. ally, "Enemy" .. enemy
            if label(left .. "/Name") == label(right .. "/Name") and nodes[left .. "/Portrait/Layer1"].visible then
                assert(nodes[left .. "/Name"].x == nodes[right .. "/Name"].x)
                local asymmetry = false
                for layer = 1, 16 do
                    local key = "/Portrait/Layer" .. layer
                    local a, b = nodes[left .. key], nodes[right .. key]
                    assert(a.visible == b.visible)
                    if a.visible then
                        assert(a.image == b.image and a.imageColor == b.imageColor and a.width == b.width and a.height == b.height)
                        assert(a.x == -b.x and a.y == b.y)
                        if a.x ~= 0 then asymmetry = true end
                    end
                end
                if asymmetry then return end
            end
        end
    end
    error("no matching opposing portraits to verify mirror")
end

local function finish(outcome, terminal, inspect_playback)
    click("Primary")
    assert(label("Primary/Title") == "跳过回放" and ticking)
    assert(not nodes.Shop.active and nodes.Battle.active)
    assert(label("Battle/Outcome") == "战斗回放")
    inward_formation()
    if not full_formation_captured and nodes["Team5/Portrait/Layer1"].visible and nodes["Enemy5/Portrait/Layer1"].visible then
        full_formation_captured = true
        capture("battle_full")
    end
    local first_event = label("Battle/Event")
    if inspect_playback then
        mirrored_portrait()
        click("Battle/Auto")
        assert(not ticking)
        local stable_writes = image_writes
        sandbox.OnUpdate(0.7)
        assert(label("Battle/Event") == first_event and image_writes == stable_writes)
        click("Battle/Replay")
        assert(label("Battle/Event") ~= first_event and not ticking)
        click("Battle/Auto")
        assert(ticking)
        local saw_damage, saw_attack, saw_block, saw_summon
        for _ = 1, 160 do
            sandbox.OnUpdate(0.6)
            if not ticking then break end
            local hit = event_card("^%-%d+$")
            if hit and not saw_damage then
                local bar = nodes[hit .. "/Health"]
                assert(not bar.visible or bar.width < nodes[hit .. "/HealthTrack"].width)
                local damage = assert(label("Battle/Event"):match("受到伤害 (%d+)"))
                assert(label(hit .. "/Tag") == "-" .. damage)
                capture("battle_damage")
                saw_damage = true
            end
            if event_card("^出击$") then saw_attack = true end
            if event_card("^格挡$") then
                assert(label("Battle/Event"):find("护盾抵消", 1, true))
                saw_block = true
            end
            local summoned = event_card("^入场$")
            if summoned then
                assert(nodes[summoned .. "/Portrait/Layer1"].visible)
                saw_summon = true
            end
        end
        assert(saw_damage and saw_attack and saw_block and saw_summon and not ticking)
    else
        click("Battle/Replay")
        assert(label("Battle/Event") ~= first_event and not ticking)
        click("Primary")
    end
    assert(label("Primary/Title") == "结算" and not ticking)
    assert(label("Battle/Outcome") == "本轮" .. outcomes[outcome])
    click("Primary")
    if terminal then
        assert(label("Primary/Title") == "重开同种子")
        assert(label("Battle/Outcome") == "单局" .. outcomes[outcome])
    else
        assert(label("Primary/Title") == "下一轮")
        click("Primary")
        assert(label("Primary/Title") == "开战")
        assert(nodes.Shop.active and not nodes.Battle.active)
    end
end

local function opening(expected_seed)
    assert(label("Round/Value") == "第 1 轮 · 准备")
    assert(label("Seed"):find("种子 " .. expected_seed, 1, true))
    assert(label("Money/Value") == "10")
    assert(label("TeamCaption"):find("右侧为前排", 1, true))
    assert(nodes.Team1.x > nodes.Team5.x and nodes.Team5.y == nodes.Team1.y)
    for index = 1, 5 do assert(nodes["Enemy" .. index].active == false) end
    assert(label("Team1/Name") == "空位 1")
    assert(label("Primary/Title") == "开战")
end

opening(seed)
capture("preparation")
click("Primary")
assert(label("Hint") == "先购买至少一只动物")
shop("buy", 1)
assert(label("Team1/Name") == "灯囊蛾")
shop("buy", 2, 1)
assert(label("Team1/Name") == "芦纹龟")
shop("move", 2, 1)
assert(label("Team1/Name") == "灯囊蛾")
click("Shop/Food1")
assert(label("Shop/Info"):find("一名队员获得", 1, true))
click("Team2")
shop("freeze", 3)
assert(label("Shop/Pet3/Tag") == "已冻结" and nodes["Shop/Pet3/Frozen"].active)
shop("reroll")
click("Shop/Pet3")
assert(nodes["Shop/Pet3/Selected"].active and nodes["Team1/Portrait/Layer1"].active)
assert(label("Shop/Info"):find("幼蛾破茧", 1, true))
capture("populated")
finish("win", false, true)
assert(label("Shop/Pet3/Tag") == "已冻结")
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
assert(logs[#logs] == "AUTO_PETS_M1 phase=ended round=11 wins=10 lives=5 final=win seed=7")
assert(full_formation_captured)
capture("victory")
click("Primary")
opening(seed)

shop("buy", 1)
for round = 1, 5 do finish("loss", round == 5) end
assert(logs[#logs] == "AUTO_PETS_M1 phase=ended round=5 wins=0 lives=0 final=loss seed=7")
capture("defeat")
click("Battle/NewSeed")
opening(seed + 1)
assert(logs[#logs] == "AUTO_PETS_M1 phase=preparation round=1 wins=0 lives=5 final=- seed=8")

sandbox.OnDestroy()
for _, node in pairs(nodes) do assert(not node.callback) end
assert(loadfile(bundle_path, "t", sandbox))()
sandbox.OnStart()
opening(seed)

shop("buy", 1)
shop("buy", 3)
click("Team2")
click("Shop/Merge")
click("Team1")
assert(label("Team2/Name") == "空位 2")
shop("reroll")
shop("combine", 1, 1)
assert(label("Team1/Detail"):find("Lv2", 1, true))
assert(label("Shop/Reward/Tag") == "1/1")
click("Shop/RewardNext")
click("Shop/Reward")
click("Shop/Buy")
assert(label("Hint") == "金币不足")
click("Shop/Reward")
click("Team1")
click("Shop/Sell")
assert(label("Team1/Name") == "空位 1")

sandbox.OnDestroy()
assert(capture_file:close())
for _, node in pairs(nodes) do assert(not node.callback) end
for _, line in ipairs(logs) do print(line) end
print("Native UI simulation passed portraits, battle playback, both terminal states, draw, restart, new seed, and shop input")
