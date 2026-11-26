assert(_VERSION == "Lua 5.3")
local bundle_path, bindings_path, seed = arg[1], arg[2], assert(math.tointeger(tonumber(arg[3])))
local nodes, logs = {}, {}
local configured_seed = seed
local cursor = {CursorDown = "CursorDown", CursorClick = "CursorClick",
    CursorBeginDrag = "CursorBeginDrag", CursorDrag = "CursorDrag", CursorEndDrag = "CursorEndDrag"}
local device = arg[5] or "pc"
local release = arg[6] == "release"
local canvas = assert(({pc = {1600, 900}, mobile = {1280, 720}})[device], "unknown input device")
local main_touch = device == "pc" and -1 or 4
local capture_file = assert(io.open(arg[4], "w"))
local ticking, image_writes = false, 0
local captured = {}
local listeners, listener_peak, installs, removals = 0, 0, 0, 0
local audio_plays, audio_stops, active_audio, sound_ids = 0, 0, {}, {}

local node_methods = {}
function node_methods:SetActive(value) self.active = value end
function node_methods:SetVisible(value) self.visible = value end
function node_methods:SetAnchoredPosition(x, y) self.x, self.y = x, y end
function node_methods:SetSizeDelta(width, height) self.width, self.height = width, height end
function node_methods:GetAnchoredPosition() return self.x, self.y end
function node_methods:GetSizeDelta() return self.width, self.height end
function node_methods:GetSiblingIndex() return self.sibling or 0 end
function node_methods:SetSiblingIndex(index) self.sibling = index end
function node_methods:SetAsLastSibling() self.sibling = 99 end
function node_methods:SetImage(source, image)
    assert(source == "StaticReference" and (image == 100001 or image == 106025 or image == 102036))
    self.image = image
    image_writes = image_writes + 1
end
function node_methods:AddCursorEventListener(event, callback)
    assert(self.kind == "cursorArea" and self.active and self.visible)
    assert(cursor[event] and not self.callbacks[event])
    self.callbacks[event] = callback
    listeners, installs = listeners + 1, installs + 1
    listener_peak = math.max(listener_peak, listeners)
end
function node_methods:RemoveCursorEventListener(event, callback)
    assert(self.callbacks[event] == callback)
    self.callbacks[event] = nil
    listeners, removals = listeners - 1, removals + 1
end

for line in io.lines(bindings_path) do
    local path, kind, x, y, width, height = line:match("^([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)$")
    assert(path and not nodes[path], "invalid control path " .. line)
    local parent = path:match("^(.*)/[^/]+$")
    nodes[path] = setmetatable({ kind = kind, alive = true, parent = parent and assert(nodes[parent]), callbacks = {},
        x = assert(tonumber(x)), y = assert(tonumber(y)), width = assert(tonumber(width)), height = assert(tonumber(height)) },
        { __index = node_methods })
end

local function colour(r, g, b, a)
    assert(a == 255)
    return string.format("#%02x%02x%02x", r, g, b)
end

local sandbox = {
    assert = assert, error = error, ipairs = ipairs, math = math, next = next, pairs = pairs,
    pcall = pcall, rawequal = rawequal, select = select,
    setmetatable = setmetatable, string = string, table = table, tonumber = tonumber, tostring = tostring, type = type,
    game = {
        GetUICanvasSize = function() return table.unpack(canvas) end,
        PlayAudio2D = function(sound)
            assert(math.type(sound) == "integer")
            sound_ids[sound] = true
            audio_plays = audio_plays + 1
            active_audio[audio_plays] = true
            return audio_plays
        end,
        IsAudioAlive = function(instance) return active_audio[instance] == true end,
        StopAudio = function(instance)
            assert(active_audio[instance], "invalid sound instance")
            active_audio[instance] = nil
            audio_stops = audio_stops + 1
        end,
    },
    Enum = {
        CursorEventType = cursor,
        ImageSource = { StaticReference = "StaticReference" },
        ImageType = { Stretch = "Stretch" },
    },
    Color = colour,
    print = function(message) logs[#logs + 1] = message end,
    script = {
        object = { FindChild = function(_, path) return nodes[path] end },
        GetParam = function(_, name)
            assert(name == "seed")
            return configured_seed
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
    assert(not captured[frame], "duplicate capture " .. frame)
    captured[frame] = true
    local paths = {}
    for path in pairs(nodes) do paths[#paths + 1] = path end
    table.sort(paths)
    for _, path in ipairs(paths) do
        local node = nodes[path]
        local content = node.text == nil and "~" or node.text:gsub("%%", "%%25")
            :gsub("\t", "%%09"):gsub("\n", "%%0A"):gsub("\r", "%%0D"):gsub("~", "%%7E")
        capture_file:write(table.concat({frame, path, flag(node.active), flag(node.visible),
            node.x or "", node.y or "", node.width or "", node.height or "", node.image or "",
            node.imageColor or "", node.fontColor or "", content,
            node.parent == sandbox.script.object and "root" or ""}, "\t"), "\n")
    end
end

local function label(path)
    local node = assert(nodes[path], path)
    assert(node.visible and node.active and node.kind == "text", path)
    return assert(node.text, path)
end

local function hit_area(path)
    local node = assert(nodes[path .. "/Hit"], path)
    local target = node
    while node do
        assert(node.active and node.visible, "hidden hit area " .. path)
        node = node.parent
    end
    return target
end

local function hit_centre(path)
    local x, y = canvas[1] / 2, canvas[2] / 2
    local node = hit_area(path)
    while node do
        x, y = x + node.x, y + node.y
        node = node.parent
    end
    return x, y
end

local function cursor_event(touch, x, y)
    return {touchId = touch, GetUIPos = function() return x, y end}
end

local function screen_hit(x, y)
    local overlay = nodes.Restart.active and "Restart/" or nodes.Menu.active and "Menu/"
    local match
    for key, node in pairs(nodes) do
        if node.kind == "cursorArea" and (not overlay or key:sub(1, #overlay) == overlay) then
            local ancestor, shown = node, true
            while ancestor do
                if not ancestor.active or not ancestor.visible then
                    shown = false
                    break
                end
                ancestor = ancestor.parent
            end
            if shown then
                local path = assert(key:match("^(.+)/Hit$"))
                local centre_x, centre_y = hit_centre(path)
                if math.abs(x - centre_x) <= node.width / 2 and math.abs(y - centre_y) <= node.height / 2 then
                    assert(not match, "overlapping hit areas: " .. tostring(match) .. " and " .. path)
                    match = path
                end
            end
        end
    end
    return match
end

local function deliver_click(path, touch, x, y)
    local target = hit_area(path)
    local event = cursor_event(touch or main_touch, x, y)
    target.callbacks.CursorDown(event)
    target.callbacks.CursorClick(event)
end

local function click(path, touch)
    local x, y = hit_centre(path)
    assert(screen_hit(x, y) == path, "screen cannot reach " .. path)
    deliver_click(path, touch, x, y)
end

local function blocked_click(path, touch)
    local x, y = hit_centre(path)
    assert(screen_hit(x, y) ~= path, "overlay leaves input exposed: " .. path)
    deliver_click(path, touch, x, y)
end

local function assert_tooltip(card, above_card)
    local popup = nodes.Tooltip
    local pointer = nodes["Tooltip/Pointer"]
    local card_x, card_y = hit_centre(card)
    local popup_y = popup.y + canvas[2] / 2
    assert(popup.active and popup.visible and popup.width == 420 and popup.height == 86)
    assert(popup.x + pointer.x + canvas[1] / 2 == card_x)
    assert(math.abs(popup.x) + popup.width / 2 < canvas[1] / 2)
    assert(not nodes["Tooltip/Hit"])
    local caption = nodes["Shop/Caption"]
    assert(caption.visible and math.abs(caption.x - popup.x) > (caption.width + popup.width) / 2)
    if above_card then
        assert(pointer.y < 0 and popup_y - popup.height / 2 > card_y + nodes[card .. "/Hit"].height / 2)
    else
        assert(pointer.y > 0 and popup_y + popup.height / 2 < card_y - nodes[card .. "/Hit"].height / 2)
    end
end

local function start_drag(path, touch)
    local target = hit_area(path)
    local x, y = hit_centre(path)
    assert(screen_hit(x, y) == path, "screen cannot drag " .. path)
    local press = cursor_event(touch or main_touch, x, y)
    target.callbacks.CursorDown(press)
    target.callbacks.CursorBeginDrag(press)
    return target.callbacks
end

local function drag_to(source, target, touch, offset_x, offset_y)
    local callbacks = start_drag(source, touch)
    local x, y = hit_centre(target)
    local drop = cursor_event(touch, x + (offset_x or 0), y + (offset_y or 0))
    callbacks.CursorDrag(drop)
    callbacks.CursorEndDrag(drop)
    callbacks.CursorClick(drop)
    if nodes[target .. "/DropTarget"].active then click(target, touch) end
end

local function destroy_script()
    sandbox.OnDestroy()
    assert(listeners == 0 and not ticking and next(active_audio) == nil)
    for _, node in pairs(nodes) do assert(not next(node.callbacks)) end
end

local function restart_script(new_seed)
    destroy_script()
    configured_seed = new_seed or configured_seed
    sandbox.OnStart()
    assert(nodes.Menu.active and label("Menu/Continue/Title") == "单人练习")
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
    elseif action == "sell" then
        click("Team" .. first)
        click("Shop/Sell")
    elseif action == "reward" then
        assert(first == 1 and label("Shop/Reward/Tag"):match("^1/"))
        click("Shop/Reward")
        click("Shop/Buy")
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
            local tag = nodes[path .. "/Tag"]
            if nodes[path].active and tag.active and tag.text:match(pattern) then return path end
        end
    end
end

local function inward_formation()
    local ally_mark, enemy_mark = nodes["Team1/Front"], nodes["Enemy1/Front"]
    assert(nodes.Team1.x + ally_mark.x + ally_mark.width / 2 < nodes.Enemy1.x + enemy_mark.x - enemy_mark.width / 2)
    for slot = 2, 5 do
        local ally, front_ally = nodes["Team" .. slot], nodes["Team" .. (slot - 1)]
        local enemy, front_enemy = nodes["Enemy" .. slot], nodes["Enemy" .. (slot - 1)]
        local left_seat, right_seat = nodes["Team" .. slot .. "/Name"], nodes["Enemy" .. slot .. "/Name"]
        local left_front, right_front = nodes["Team" .. (slot - 1) .. "/Name"], nodes["Enemy" .. (slot - 1) .. "/Name"]
        assert(ally.x + left_seat.width / 2 < front_ally.x - left_front.width / 2)
        assert(enemy.x - right_seat.width / 2 > front_enemy.x + right_front.width / 2)
    end
end

local function mirrored_portrait()
    local layers = 0
    while nodes["Team1/Portrait/Layer" .. (layers + 1)] do layers = layers + 1 end
    assert(layers > 0)
    for ally = 1, 5 do
        for enemy = 1, 5 do
            local left, right = "Team" .. ally, "Enemy" .. enemy
            if nodes[left].active and nodes[right].active and nodes[left .. "/Portrait/Layer1"].visible
                and label(left .. "/Name") == label(right .. "/Name") then
                assert(nodes[left .. "/Name"].x == nodes[right .. "/Name"].x)
                local asymmetry = false
                for layer = 1, layers do
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

local function finish(outcome, terminal, inspect_playback, observe_event)
    click("Primary")
    assert(label("Primary/Title") == "跳过回放" and ticking)
    assert(not nodes.Shop.active and nodes.Battle.active)
    assert(label("Battle/Outcome") == "战斗回放")
    assert(label("OpponentCaption"):find("电脑对手", 1, true))
    inward_formation()
    if not captured.battle_full and nodes["Team5/Portrait/Layer1"].visible and nodes["Enemy5/Portrait/Layer1"].visible then
        mirrored_portrait()
        capture("battle_full")
    end
    local first_event = label("Battle/Event")
    if inspect_playback == "manual" then
        click("Battle/Auto")
        for _ = 1, 250 do
            if label("Primary/Title") == "结算" then break end
            click("Battle/Replay")
            if observe_event then observe_event() end
        end
        assert(label("Battle/Event"):find("战斗结束", 1, true))
    elseif inspect_playback then
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
            local impact = nodes["BattleFX/Impact"]
            local value = impact.active and label("BattleFX/Impact/Value")
            if value and value:match("^-%d+$") and not saw_damage then
                local side, name, damage, health = label("Battle/Event"):match(" → (%S+) (%S+) -(%d+)命 · 余(%d+)命")
                assert(side and nodes.BattleFX.active and value == "-" .. damage)
                local prefix = side == "我方" and "Team" or "Enemy"
                local hit
                for slot = 1, 5 do
                    local path = prefix .. slot
                    local card = nodes[path]
                    local expected_x = card.x + (slot == 1 and (side == "我方" and 59 or -59) or 0)
                    if impact.x == expected_x and label(path .. "/Name") == name then
                        hit = path
                        break
                    end
                end
                assert(hit and label(hit .. "/LifeValue") == health)
                local bar = nodes[hit .. "/Health"]
                assert(not bar.visible or bar.width < nodes[hit .. "/HealthTrack"].width)
                capture("battle_damage")
                saw_damage = true
            end
            local actor = event_card("^出击$")
            if actor and not saw_attack then
                local portrait = nodes[actor .. "/Portrait"]
                local target = actor:find("^Team") and nodes.Enemy1 or nodes.Team1
                local strike = nodes["BattleFX/Strike"]
                assert(strike.active and portrait.x ~= 0 and portrait.x * nodes[actor].x < 0)
                assert(strike.x == (nodes[actor].x + portrait.x + target.x) / 2)
                capture("battle_attack")
                local original_x = math.abs(portrait.x)
                sandbox.OnUpdate(0.14)
                assert(math.abs(portrait.x) < original_x and strike.active)
                saw_attack = true
            end
            if value == "格挡" then
                assert(label("Battle/Event"):find("护盾抵消", 1, true))
                saw_block = true
            end
            local summoned = event_card("^入场$")
            if summoned and not saw_summon then
                assert(nodes[summoned .. "/Portrait/Layer1"].visible)
                capture("battle_summon")
                saw_summon = true
            end
        end
        assert(saw_damage and saw_attack and saw_block and saw_summon and not ticking)
    else
        click("Battle/Replay")
        assert(label("Battle/Event") ~= first_event and not ticking)
        click("Primary")
    end
    assert(label("Primary/Title") == "结算" and not ticking and not nodes["Battle/Replay"].active)
    local battle_outcome = label("Battle/Outcome")
    if outcome then
        assert(battle_outcome == "本轮" .. outcomes[outcome], label("Round/Value") .. "：" .. battle_outcome)
    end
    local result = label("Battle/Event")
    local wins, lives = label("Wins/Value"), label("Lives/Value")
    if inspect_playback then
        click("Battle/Rewatch")
        assert(label("Battle/Event") == first_event and label("Primary/Title") == "跳过回放")
        local replaying = label("Battle/Event")
        assert(ticking)
        click("OpenMenu")
        assert(not ticking)
        sandbox.OnUpdate(5)
        blocked_click("Primary")
        click("Menu/Continue")
        assert(ticking and label("Battle/Event") == replaying)
        click("Battle/Fast")
        assert(label("Battle/Fast/Title") == "速度：3 倍")
        sandbox.OnUpdate(0.2)
        assert(label("Battle/Event") ~= replaying)
        click("Battle/Fast")
        click("Primary")
        assert(label("Battle/Event") == result and label("Battle/Outcome") == battle_outcome)
        assert(label("Wins/Value") == wins and label("Lives/Value") == lives)
        assert(label("Primary/Title") == "结算")
    end
    click("Primary")
    if terminal then
        assert(label("Primary/Title") == "再挑战本局")
        assert(label("Battle/Outcome") == "单局" .. outcomes[outcome])
    else
        assert(label("Primary/Title") == "下一轮")
        click("Primary")
        assert(label("Primary/Title") == "开战")
        assert(nodes.Shop.active and not nodes.Battle.active)
    end
end

local function opening(expected_seed)
    if nodes.Menu.active then click("Menu/Continue") end
    assert(label("Round/Value") == "第 1 轮 · 准备")
    assert(logs[#logs]:find("seed=" .. expected_seed .. "$"))
    assert(label("Money/Value") == "10")
    assert(label("TeamCaption"):find("右侧前排", 1, true) and nodes["Team1/Front"].visible)
    assert(label("OpponentCaption"):find("电脑对手", 1, true))
    assert(nodes.Team1.x > nodes.Team5.x and nodes.Team5.y == nodes.Team1.y)
    for index = 1, 5 do assert(nodes["Enemy" .. index].active == false) end
    assert(not nodes["Team1/Name"].active)
    assert(label("Primary/Title") == "开战")
    assert(nodes.Reset.active and nodes["Reset/Title"].visible and not nodes.Restart.active)
    assert(label("Shop/Buy/Title") == "购买 · 3 金" and label("Shop/Reroll/Title") == "刷新 · 1 金")
    assert(label("Shop/Sell/Title") == "出售 · +1 金/级")
end

local function finish_simulation()
    destroy_script()
    assert(capture_file:close())
    assert(installs == removals and audio_stops <= audio_plays)
    print(string.format("NATIVE_RESOURCES listeners_peak=%d listeners_installed=%d listeners_released=%d portrait_image_writes=%d audio_plays=%d audio_stops=%d",
        listener_peak, installs, removals, image_writes, audio_plays, audio_stops))
    local sounds = {}
    for sound in pairs(sound_ids) do sounds[#sounds + 1] = sound end
    table.sort(sounds)
    print("NATIVE_AUDIO " .. table.concat(sounds, ","))
    for _, line in ipairs(logs) do print(line) end
    print(release and "Native release simulation passed 15 rounds, all six shop tiers, summon replay, terminal and restart"
        or "Native UI simulation passed shop, desktop/mobile input, menu recovery, replay, audio lifecycle, and all outcomes")
end

local function release_run()
    assert(seed == 8, "release candidate uses the fixed seed 8")
    capture("menu")
    opening(seed)
    local rounds = dofile("tests/native/release-practice-rounds.lua")
    for round, fixture in ipairs(rounds) do
        assert(label("Shop/Caption") == ("商店 · %d 阶"):format(math.min(6, (round + 1) // 2)))
        if round == 7 then
            assert(label("Shop/Pet2/Name") == "烬耳狞猫")
            click("Shop/Pet2")
            assert(label("Tooltip/Body") == "开场 · 对手前排受 3 伤")
            capture("tier_four")
        elseif round == 9 then
            assert(label("Shop/Pet1/Name") == "月鬃牦牛")
            click("Shop/Food2")
            assert(label("Tooltip/Heading") == "茴香卷 · 食物")
            assert(label("Tooltip/Body"):find("邻位 +1攻", 1, true))
            capture("tier_five")
            click("Shop/Food2")
        elseif round == 11 then
            assert(label("Shop/Pet3/Name") == "汐角鲸")
            click("Shop/Pet3")
            assert(label("Tooltip/Body"):find("潮角幼鲸，4攻 3命", 1, true))
            capture("tier_six")
        end
        for command = 2, #fixture do shop(table.unpack(fixture[command])) end
        if round == 8 then
            finish(fixture[1], false, "manual", function()
                local path = event_card("^入场$")
                if path and not captured.release_summon and label(path .. "/Name") == "蕨羽雏" then
                    assert(nodes[path .. "/Portrait/Layer1"].visible)
                    capture("release_summon")
                end
            end)
            assert(captured.release_summon)
        else
            finish(fixture[1], round == #rounds)
        end
    end
    assert(logs[#logs] == "AUTO_PETS_M1 phase=ended round=15 wins=10 lives=1 final=win seed=8")
    capture("victory")
    click("Primary")
    opening(seed)
end

if release then
    release_run()
    finish_simulation()
    return
end

assert(nodes.Menu.active and label("Menu/Continue/Title") == "单人练习")
capture("menu")
local menu_x, menu_y = hit_centre("Menu/Audio")
local menu_edge = hit_area("Menu/Audio").height / 2
assert(screen_hit(menu_x, menu_y - menu_edge) == "Menu/Audio")
assert(not screen_hit(menu_x, menu_y - menu_edge - 1))
click("Menu/Audio", 9)
assert(label("Menu/Audio/Title") == "音效：关闭")
opening(seed)
capture("preparation")
local wins = {
    {"draw", {"buy", 3}, {"buy", 2}, {"buy", 1}},
    {"win", {"buy", 1}, {"buy", 2}, {"feed", 1, 1}},
    {"win", {"feed", 1, 1}, {"feed", 2, 1}, {"reroll"}, {"feed", 1, 1}},
    {"win", {"feed", 1, 1}, {"feed", 2, 1}, {"reroll"}, {"feed", 1, 1}},
    {"win", {"feed", 2, 1}, {"feed", 1, 1}, {"reroll"}, {"feed", 2, 1}},
    {"win", {"feed", 2, 1}, {"feed", 1, 1}, {"reroll"}, {"feed", 1, 1}},
    {"win", {"feed", 1, 1}, {"feed", 2, 1}, {"reroll"}, {"feed", 1, 1}},
    {"win", {"feed", 1, 1}, {"feed", 2, 1}, {"reroll"}, {"feed", 2, 1}},
    {"win", {"feed", 1, 1}, {"feed", 2, 1}, {"reroll"}, {"feed", 2, 1}},
    {"win", {"feed", 2, 1}, {"feed", 1, 1}, {"reroll"}, {"feed", 1, 1}},
    {"loss", {"feed", 1, 1}, {"feed", 2, 1}, {"reroll"}, {"feed", 2, 1}},
    {"win", {"feed", 1, 1}, {"feed", 2, 1}, {"reroll"}, {"feed", 1, 1}},
}
for round, fixture in ipairs(wins) do
    if round == 3 then
        local before = label("Money/Value")
        shop("buy", 1)
        assert(label("Hint") == "阵容已满" and label("Money/Value") == before)
    end
    for command = 2, #fixture do shop(table.unpack(fixture[command])) end
    finish(fixture[1], round == #wins)
    if round == 1 then
        assert(label("Wins/Value") == "0 / 10" and label("Lives/Value") == "5 / 5")
    end
end
assert(logs[#logs] == "AUTO_PETS_M1 phase=ended round=12 wins=10 lives=4 final=win seed=1")
assert(captured.battle_full)
capture("victory")
assert(audio_plays == 0, "muted session triggered audio")
click("Primary")
opening(seed)

shop("buy", 1)
for round = 1, 5 do finish("loss", round == 5) end
assert(logs[#logs] == "AUTO_PETS_M1 phase=ended round=5 wins=0 lives=0 final=loss seed=1")
capture("defeat")
click("OpenMenu")
assert(label("Menu/NewGame/Title") == "新一局")
click("Menu/NewGame")
assert(not nodes.Restart.active and label("Menu/Difficulty/Title") == "练习难度：标准")
opening(seed + 1)

local interaction_seed = 7
restart_script(interaction_seed)
opening(interaction_seed)
click("Primary")
assert(label("Hint") == "先购买至少一只动物")
drag_to("Shop/Pet1", "Team3", -1)
assert(label("Team1/Name") == "棉尾兔")
assert(label("Team1/XP") == "L1  经验 0/2")
assert(label("Money/Value") == "7" and label("Shop/Pet1/Name") == "空商品")
drag_to("Shop/Pet2", "Team1", main_touch, nodes["Team1/Hit"].width / 2 + 1)
assert(label("Team1/Name") == "棉尾兔" and label("Money/Value") == "7"
    and nodes["Shop/Pet2/Face"].imageColor ~= "#fff4ce")
drag_to("Shop/Pet2", "Team1", main_touch, nodes["Team1/Hit"].width / 2 - 1)
assert(label("Team1/Name") == "芦纹龟")
drag_to("Team2", "Team1", 4)
assert(label("Team1/Name") == "棉尾兔")
click("Shop/Food1")
assert(label("Tooltip/Body"):find("一名队员获得", 1, true))
assert_tooltip("Shop/Food1", true)
local detail_before_food = label("Team2/Detail") .. label("Team2/LifeValue")
drag_to("Shop/Food1", "Team5", 4)
assert(label("Team2/Detail") .. label("Team2/LifeValue") == detail_before_food and label("Money/Value") == "4")
drag_to("Shop/Food1", "Team2", 4, 0, -nodes["Team2/Hit"].height / 2 + 1)
assert(label("Team2/Detail") .. label("Team2/LifeValue") ~= detail_before_food and label("Money/Value") == "1")
shop("freeze", 3)
assert(label("Shop/Pet3/Tag") == "已冻结" and nodes["Shop/Pet3/Frozen"].active)
shop("reroll")
click("Shop/Pet3")
assert(nodes["Shop/Pet3/Face"].imageColor == "#fff4ce" and nodes["Team1/Portrait/Layer1"].active)
assert(label("Tooltip/Heading"):find("兔窝接力", 1, true))
assert_tooltip("Shop/Pet3", true)
capture("populated")
click("Shop/Pet1")
assert_tooltip("Shop/Pet1", true)
capture("shop_tooltip")
finish(nil, false, true)
assert(label("Shop/Pet3/Tag") == "已冻结")
restart_script(interaction_seed)
opening(interaction_seed)

shop("buy", 1)
shop("buy", 3)
click("Team2")
click("Team1")
assert(label("Team2/Name") == "棉尾兔" and label("Team1/XP") == "L1  经验 0/2")
click("Team2")
click("Shop/Merge")
click("Team1")
assert(not nodes["Team2/Name"].active)
shop("reroll")
shop("combine", 1, 1)
assert(label("Team1/XP") == "L2  经验 2/5")
assert(label("Shop/Reward/Tag") == "1/1")
click("Shop/RewardNext")
click("Shop/Reward")
click("Shop/Buy")
assert(label("Hint") == "金币不足")
click("Shop/Reward")
click("Team1")
assert_tooltip("Team1", false)
assert(label("Team1/XP") == "L2  经验 2/5" and label("Shop/Sell/Title") == "出售 · +2 金")
click("Shop/Sell")
assert(not nodes["Team1/Name"].active)

restart_script()
opening(interaction_seed)
shop("buy", 1)
shop("buy", 3)
local merge_drag = start_drag("Team2", 11)
assert(nodes["Team2/Selected"].active)
assert(label("Hint"):find("同种队员会合并", 1, true))
merge_drag.CursorEndDrag(cursor_event(12, hit_centre("Team1")))
assert(label("Team2/Name") == "拖动中")
merge_drag.CursorDrag(cursor_event(11, hit_centre("Team1")))
assert(label("Team1/DropLabel") == "合并" and nodes["Team1/DropTarget"].active)
assert(label("Hint"):find("确认合并后会消耗拖动的队员", 1, true) and label("Team2/Name") == "拖动中")
capture("merge_preview")
merge_drag.CursorDrag(cursor_event(11, 0, 0))
assert(not nodes["Team1/DropLabel"].active and label("Team2/Name") == "拖动中")
merge_drag.CursorDrag(cursor_event(11, hit_centre("Team1")))
merge_drag.CursorEndDrag(cursor_event(11, hit_centre("Team1")))
assert(label("Team2/Name") == "棉尾兔" and nodes["Team1/DropTarget"].active)
click("Team1", 11)
assert(not nodes["Team2/Name"].active and not nodes["Team2/Selected"].active)
assert(label("Team1/XP") == "L1  经验 1/2" and not nodes["Team1/DropTarget"].active)
finish(nil)
drag_to("Shop/Pet1", "Team1", 4)
assert(label("Team1/XP") == "L2  经验 2/5" and label("Money/Value") == "7")
local reward_name = label("Shop/Reward/Name")
assert(reward_name ~= "升级奖励")
drag_to("Shop/Reward", "Team2", 4)
assert(label("Team2/Name") == reward_name and label("Money/Value") == "4")
local stale_drag = start_drag("Shop/Pet2", 4)
click("Shop/Reroll")
stale_drag.CursorEndDrag(cursor_event(4, hit_centre("Team3")))
assert(not nodes["Team3/Name"].active and label("Money/Value") == "3")

restart_script()
opening(interaction_seed)
for _ = 1, 8 do click("Shop/Reroll") end
assert(label("Money/Value") == "2" and not nodes["Team1/Name"].active)
assert(label("Hint"):find("重开本局", 1, true))
click("Reset")
assert(nodes.Restart.active and nodes["Restart/Heading"].visible)
capture("restart_confirm")
blocked_click("Shop/Reroll")
assert(label("Money/Value") == "2")
click("Restart/Cancel")
assert(not nodes.Restart.active and label("Money/Value") == "2")
click("Reset")
click("Restart/Confirm")
opening(interaction_seed)
assert(label("Shop/Pet1/Name") == "棉尾兔")

shop("buy", 1)
for _ = 1, 6 do click("Shop/Reroll") end
assert(label("Money/Value") == "1")
click("Team1")
click("Shop/Sell")
assert(label("Money/Value") == "2" and not nodes["Team1/Name"].active)
assert(label("Hint"):find("重开本局", 1, true))
click("Reset")
click("Restart/Confirm")
opening(interaction_seed)
shop("buy", 1)
finish(nil, false, "manual")

local gold, unit = label("Money/Value"), label("Team1/Name")
assert(audio_plays > 0, "enabled positive and battle feedback produced no audio calls")
click("OpenMenu", 8)
assert(next(active_audio) == nil)
click("Menu/NewGame", 8)
assert(label("Restart/Heading") == "放弃本局？")
capture("menu_discard")
blocked_click("Shop/Reroll", 8)
assert(label("Money/Value") == gold and label("Team1/Name") == unit)
click("Restart/Cancel", 8)
assert(nodes.Menu.active)
click("Menu/Continue", 8)
assert(label("Money/Value") == gold and label("Team1/Name") == unit)
click("OpenMenu", 8)
click("Menu/NewGame", 8)
click("Restart/Confirm", 8)
opening(interaction_seed + 1)
local idle_writes = image_writes
for _ = 1, 60 do sandbox.OnUpdate(1 / 60) end
assert(image_writes == idle_writes, "idle preparation rebuilt portraits")

local before_disable = installs
local pending_drag = start_drag("Shop/Pet1", main_touch)
local pending_drop = cursor_event(main_touch, hit_centre("Team1"))
pending_drag.CursorDrag(pending_drop)
assert(nodes["Team1/DropTarget"].active)
sandbox.OnDisable()
pending_drag.CursorEndDrag(pending_drop)
assert(label("Money/Value") == "10" and not ticking)
sandbox.OnEnable()
pending_drag.CursorEndDrag(pending_drop)
assert(label("Money/Value") == "10" and not nodes["Team1/DropTarget"].active)
assert(installs == before_disable, "enabling the existing view added listeners")

local staged_drag = start_drag("Shop/Pet1", main_touch)
staged_drag.CursorDrag(pending_drop)
staged_drag.CursorEndDrag(pending_drop)
assert(label("Money/Value") == "10" and nodes["Team1/DropTarget"].active)
sandbox.OnDisable()
sandbox.OnEnable()
assert(label("Money/Value") == "10" and not nodes["Team1/DropTarget"].active)

shop("buy", 1)
click("Primary")
local initial_audio = audio_plays
for _ = 1, 80 do
    sandbox.OnUpdate(0.6)
    if audio_plays > initial_audio then break end
end
assert(ticking and next(active_audio) ~= nil)
local suspended_event = label("Battle/Event")
sandbox.OnDisable()
assert(not ticking and next(active_audio) == nil)
sandbox.OnUpdate(5)
click("Primary")
assert(label("Battle/Event") == suspended_event)
sandbox.OnEnable()
assert(ticking and label("Battle/Event") == suspended_event)
sandbox.OnUpdate(0.6)
assert(label("Battle/Event") ~= suspended_event)

restart_script(interaction_seed)
assert(label("Menu/Difficulty/Title") == "练习难度：标准")
click("Menu/Difficulty")
assert(label("Menu/Difficulty/Title") == "练习难度：入门")
opening(interaction_seed)
click("OpenMenu")
assert(not nodes["Menu/Difficulty"].active and label("Menu/Progress"):match("^入门"))
click("Menu/Continue")
shop("buy", 1)
click("Primary")
assert(label("Enemy1/Name") == "芦纹龟", "beginner policy did not reach the native session")
click("OpenMenu")
click("Menu/NewGame")
click("Restart/Confirm")
opening(interaction_seed + 1)
click("OpenMenu")
assert(label("Menu/Progress"):match("^入门"), "a new run discarded the practice difficulty")

finish_simulation()
