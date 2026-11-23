local rules_data = require("autopets.data")
local run = require("autopets.run")
local art = require("autopets.art")
local root = script.object
local rules = rules_data.rules

local outcomes = {win = "胜利", loss = "落败", draw = "平局"}
local styles = {guardian = "守护", striker = "强攻", swarm = "群战"}
local phases = {preparation = "准备", battle = "战斗", settlement = "结算", ended = "终局"}
local primary = {preparation = "开战", battle = "结算", settlement = "下一轮", ended = "重开同种子"}
local events = {
    start = "战斗开始", skill = "发动技能", attack = "发起攻击", damage = "受到伤害",
    faint = "退场", summon = "入场", buff = "增加生命", shield = "获得护盾", result = "战斗结束",
}
local errors = {
    empty_team = "先购买至少一只动物", missing_offer = "这个位置暂无商品", invalid_position = "请选择有效位置",
    insufficient_gold = "金币不足", team_full = "阵容已满", different_pet = "只能合并同种动物",
    max_level = "已达最高等级", same_position = "请选择不同站位", all_frozen = "当前商品都已冻结",
}

local session, state, selection, message
local reward_index, event_index = 1, 1
local listeners, controls, portraits = {}, {}, {}
local playing, elapsed = false, 0
local accents = {win = 0xaad3aa, loss = 0xe49381, draw = 0xefbd73}
local effects = {
    attack = {label = "出击", face = 0x605336, ink = 0xefbd73},
    damage = {label = "失血", face = 0x603f3e, ink = 0xe49381},
    summon = {label = "入场", face = 0x39594b, ink = 0xaad3aa},
    shield = {label = "护盾", face = 0x355464, ink = 0xadd2cf},
    buff = {label = "强化", face = 0x39594b, ink = 0xaad3aa},
}

local function control(path)
    if not controls[path] then controls[path] = assert(root:FindChild(path), "missing control: " .. path) end
    return controls[path]
end

local function show(path, visible)
    local node = control(path)
    if visible then node:SetActive(true) end
    node:SetVisible(visible)
    if not visible then node:SetActive(false) end
end

local function colour(rgb)
    return Color(rgb >> 16, (rgb >> 8) & 255, rgb & 255, 255)
end

local function text(path, content, rgb)
    local node = control(path)
    node:SetActive(true)
    node:SetVisible(true)
    node.text = content
    if rgb then node.fontColor = colour(rgb) end
end

local function portrait(path, id)
    local key = id or false
    if portraits[path] == key then return end
    portraits[path] = key
    local base = path .. "/Portrait"
    local layers = id and assert(art[id], id) or {}
    show(base, true)
    show(base .. "/Medallion", true)
    for index = 1, 16 do
        local layer_path = base .. "/Layer" .. index
        local layer = layers[index]
        show(layer_path, layer ~= nil)
        if layer then
            local image, x, y, width, height, r, g, b = table.unpack(layer)
            local node = control(layer_path)
            node:SetImage(Enum.ImageSource.StaticReference, image)
            node.imageType = Enum.ImageType.Stretch
            node:SetAnchoredPosition(x * 1.15, y * 1.15)
            node:SetSizeDelta(width * 1.15, height * 1.15)
            node.imageColor = Color(r, g, b, 255)
        end
    end
end

local function card(path, title, detail, selected, id, face, rim)
    show(path, true)
    show(path .. "/Rim", true)
    show(path .. "/Face", true)
    control(path .. "/Face").imageColor = colour(face)
    control(path .. "/Rim").imageColor = colour(rim)
    text(path .. "/Name", title)
    text(path .. "/Detail", detail)
    portrait(path, id)
    if selected ~= nil then show(path .. "/Selected", selected) end
end

local function team_card(path, unit, index, selected, effect)
    local background = selected == nil and 0x344143 or 0x203a3e
    local rim = selected and 0xefbd73 or 0x3b5553
    if effect then background, rim = effect.face, effect.ink end
    local health_path = path .. "/Health"
    show(path .. "/HealthTrack", unit ~= nil)
    show(health_path, unit ~= nil and unit.health > 0)
    if not unit then
        card(path, "空位 " .. index, "", selected, nil, background, rim)
        text(path .. "/Tag", "")
        return
    end
    local pet = rules_data.pet_by_id[unit.id] or rules_data.token_by_id[unit.id]
    card(path, pet.name, string.format("%d 攻  %d 命  Lv%d", unit.attack, unit.health, unit.level),
        selected, unit.id, background, rim)
    local tag = effect and effect.label or ((unit.shield or 0) > 0 and "盾 " .. unit.shield or "")
    text(path .. "/Tag", tag, effect and effect.ink or 0xefbd73)

    local maximum = unit.max_health or unit.health
    local ratio = maximum > 0 and math.max(0, unit.health / maximum) or 0
    local width = 130 * ratio
    local bar = control(health_path)
    if width > 0 then
        bar:SetSizeDelta(width, 4)
        bar:SetAnchoredPosition(27 + (width - 130) / 2, -32)
    end
    bar.imageColor = colour(ratio <= 0.35 and 0xe49381 or 0xaad3aa)
end

local function is_selected(kind, index)
    return selection ~= nil and selection.kind == kind and selection.index == index
end

local function offer(kind, index)
    if kind == "pet" then return state.shop.pets[index] end
    if kind == "food" then return state.shop.foods[index] end
    return state.shop.rewards[index]
end

local function offer_card(path, kind, index)
    local item = offer(kind, index)
    local selected = is_selected(kind, index)
    local face = selected and 0xf8eac1 or 0xeedcaa
    local rim = selected and 0xf4b768 or (item and item.frozen and 0x458c99 or 0xb99153)
    show(path .. "/Frozen", item and item.frozen == true or false)
    text(path .. "/Tag", item and item.frozen and "已冻结" or "")
    if not item then
        card(path, kind == "reward" and "升级奖励" or "空商品", "", selected, nil, face, rim)
        return
    end
    local is_food = kind == "food"
    local definition = (is_food and rules_data.food_by_id or rules_data.pet_by_id)[item.id]
    local cost = is_food and rules.food_cost or rules.pet_cost
    local detail = string.format("%d金  %d攻 %d命", cost, definition.attack, definition.health)
    if kind == "reward" then text(path .. "/Tag", string.format("%d/%d", index, #state.shop.rewards)) end
    card(path, definition.name, detail, selected, item.id, face, rim)
end

local function battle_event(event)
    if event.type == "result" then return "战斗结束 · " .. outcomes[event.outcome] end
    if not event.name then return events[event.type] or event.type end
    local side = event.side == "player" and "我方" or "对方"
    local summary = side .. " " .. event.name .. " · " .. (events[event.type] or event.type)
    if event.type == "damage" then
        if event.amount == 0 then return string.format("%s %s · 护盾抵消 %d", side, event.name, event.absorbed) end
        local shield = event.absorbed > 0 and " · 盾挡 " .. event.absorbed or ""
        return string.format("%s %d · 剩余 %d 命%s", summary, event.amount, event.health, shield)
    end
    if event.ability then return summary .. "「" .. event.ability .. "」" end
    if event.target_name then return summary .. " → " .. event.target_name end
    if event.amount then return summary .. " " .. event.amount end
    return summary
end

local function draw(refresh)
    if refresh ~= false then state = session:snapshot() end
    local preparing = state.phase == "preparation"
    local battle = state.battle
    local event = battle and battle.events[event_index]
    local player, enemy = state.shop.team, state.opponent.team
    if battle then
        for index = event_index, 1, -1 do
            local board = battle.events[index].board
            if board then
                player, enemy = board.player, board.enemy
                break
            end
        end
    end
    local effect = event and effects[event.type]
    if event and event.type == "damage" and event.amount == 0 then effect = effects.shield end
    text("Round/Value", string.format("第 %d 轮 · %s", state.round, phases[state.phase]))
    text("Wins/Value", string.format("%d / %d", state.wins, rules.wins_to_win))
    text("Lives/Value", string.format("%d / %d", state.lives, rules.start_lives), state.lives <= 1 and 0xe49381 or 0xaad3aa)
    text("Seed", "种子 " .. state.seed)
    text("OpponentCaption", "对手营地 · " .. styles[state.opponent.style])
    for index = 1, rules.team_size do
        local hit = effect and event.slot == index
        team_card("Enemy" .. index, enemy[index], index, nil, hit and event.side == "enemy" and effect)
        team_card("Team" .. index, player[index], index, is_selected("team", index),
            hit and event.side == "player" and effect)
    end
    show("Shop", preparing)
    show("Battle", not preparing)
    local title = primary[state.phase]
    local hint = "选中商品或队员后，再点目标格或操作按钮"
    if preparing then
        reward_index = math.max(1, math.min(reward_index, #state.shop.rewards))
        text("Shop/Caption", string.format("商店 T%d · %d 金币", state.shop.tier, state.shop.gold))
        for index = 1, rules.pet_shop_slots do offer_card("Shop/Pet" .. index, "pet", index) end
        for index = 1, rules.food_shop_slots do offer_card("Shop/Food" .. index, "food", index) end
        offer_card("Shop/Reward", "reward", reward_index)
    else
        local replaying = state.phase == "battle" and event_index < #battle.events
        local headline = state.final and "单局" .. outcomes[state.final] or "本轮" .. outcomes[battle.outcome]
        local accent = replaying and 0xefbd73 or accents[battle.outcome]
        text("Battle/Outcome", replaying and "战斗回放" or headline, accent)
        control("Battle/Rule").imageColor = colour(accent)
        control("Battle/Border").imageColor = colour(state.final and accent or 0x46605c)
        text("Battle/Event", string.format("%d / %d   %s", event_index, #battle.events, battle_event(event)))
        show("Battle/Auto", replaying)
        show("Battle/NewSeed", state.phase == "ended")
        text("Battle/Auto/Title", playing and "暂停回放" or "继续回放")
        if replaying then title = "跳过回放" end
        if state.phase == "ended" then
            hint = "重开可以复盘同一局，也可以换种子开始新一局"
        elseif replaying then
            hint = "暂停后逐条看战斗事件，或直接跳到本轮结果"
        else
            hint = "可以单步重看战斗事件，或继续本局"
        end
    end
    text("Primary/Title", title)
    text("Hint", message or hint)
end

local function log_state()
    print(string.format("AUTO_PETS_M1 phase=%s round=%d wins=%d lives=%d final=%s seed=%d",
        state.phase, state.round, state.wins, state.lives, state.final or "-", state.seed))
end

local function command(action, ...)
    local ok, error_code = session:shop_action(action, ...)
    message = ok and nil or (errors[error_code] or error_code)
    if ok and action ~= "freeze" then selection = nil end
    draw()
end

local function choose_offer(kind, index)
    if state.phase ~= "preparation" then return end
    if not offer(kind, index) then message = errors.missing_offer; draw(); return end
    local already_selected = is_selected(kind, index)
    selection = not already_selected and {kind = kind, index = index} or nil
    message = selection and (kind == "food" and "选择要喂食的队员" or "点击购买添加到队尾，或选择站位") or nil
    draw()
end

local function choose_team(index)
    if state.phase ~= "preparation" then return end
    local unit = state.shop.team[index]
    if not selection or is_selected("team", index) then
        selection = not selection and unit and {kind = "team", index = index} or nil
        message = selection and "选择另一个站位移动，或点击合并队员、出售" or nil
        draw()
        return
    end
    local source = selection
    if source.kind == "team" then
        command(source.merge and "merge" or "move", source.index, index)
    elseif source.kind == "food" then
        command("feed", source.index, index)
    else
        local reward = source.kind == "reward"
        if unit and unit.id == offer(source.kind, source.index).id then
            command("combine", source.index, index, reward)
        else
            command("buy", source.index, index, reward)
        end
    end
end

local function buy()
    if selection and (selection.kind == "pet" or selection.kind == "reward") then
        command("buy", selection.index, nil, selection.kind == "reward")
    else
        message = "先选择商店的动物或升级奖励"
        draw()
    end
end

local function freeze()
    if selection and (selection.kind == "pet" or selection.kind == "food") then
        command("freeze", selection.kind, selection.index)
    else
        message = "先选择商店的动物或食物"
        draw()
    end
end

local function sell()
    if selection and selection.kind == "team" then
        command("sell", selection.index)
    else
        message = "先选择要出售的队员"
        draw()
    end
end

local function merge()
    if selection and selection.kind == "team" then
        selection.merge = true
        message = "选择另一只同种动物作为合并目标"
    else
        message = "先选择要合并的队员"
    end
    draw()
end

local function next_reward()
    local count = #state.shop.rewards
    if count > 0 then reward_index = reward_index % count + 1 end
    selection = nil
    message = count > 0 and "选择要购买的升级奖励" or "队员升级可获得奖励"
    draw()
end

local function set_playing(value)
    if playing ~= value then script:EnableUpdate(value) end
    playing, elapsed = value, 0
end

local function replay()
    local battle = state.battle
    if not battle then return end
    set_playing(false)
    event_index = event_index % #battle.events + 1
    draw(false)
end

local function toggle_replay()
    if state.phase == "battle" and event_index < #state.battle.events then
        set_playing(not playing)
        draw(false)
    end
end

local function advance(new_seed)
    local old = state.phase
    local ok, error_code
    if old == "preparation" then
        ok, error_code = session:submit()
    elseif old == "battle" then
        if event_index < #state.battle.events then
            set_playing(false)
            event_index = #state.battle.events
            draw(false)
            return
        end
        ok, error_code = session:settle()
    elseif old == "settlement" then
        ok, error_code = session:advance()
    else
        ok, error_code = session:restart(new_seed)
    end
    if ok then
        selection, message = nil, nil
        reward_index = 1
        if old ~= "battle" then event_index = 1 end
        set_playing(old == "preparation")
    else
        message = errors[error_code] or error_code
    end
    draw()
    if ok then log_state() end
end

function OnUpdate(dt)
    if not playing or state.phase ~= "battle" then return end
    local battle = state.battle
    local event = battle.events[event_index]
    local delay = event.type == "damage" and 0.55 or 0.4
    elapsed = elapsed + dt
    if elapsed < delay then return end
    event_index, elapsed = event_index + 1, 0
    if event_index == #battle.events then set_playing(false) end
    draw(false)
end

local function bind(path, callback)
    local hit = control(path .. "/Hit")
    hit:SetActive(true)
    hit:SetVisible(true)
    hit:AddCursorEventListener(Enum.CursorEventType.CursorClick, callback)
    listeners[hit] = callback
end

local function bind_button(path, callback)
    show(path, true)
    show(path .. "/Rim", true)
    show(path .. "/Face", true)
    show(path .. "/Title", true)
    bind(path, callback)
end

function OnStart()
    session = run.new(assert(math.tointeger(script:GetParam("seed")), "seed must be an integer"))
    for index = 1, rules.team_size do bind("Team" .. index, function() choose_team(index) end) end
    for index = 1, rules.pet_shop_slots do bind("Shop/Pet" .. index, function() choose_offer("pet", index) end) end
    for index = 1, rules.food_shop_slots do bind("Shop/Food" .. index, function() choose_offer("food", index) end) end
    bind("Shop/Reward", function() choose_offer("reward", reward_index) end)
    bind_button("Shop/Buy", buy)
    bind_button("Shop/Freeze", freeze)
    bind_button("Shop/Sell", sell)
    bind_button("Shop/Merge", merge)
    bind_button("Shop/Reroll", function() command("reroll") end)
    bind_button("Shop/RewardNext", next_reward)
    bind_button("Battle/Replay", replay)
    bind_button("Battle/Auto", toggle_replay)
    bind_button("Battle/NewSeed", function()
        if state.phase == "ended" then advance(state.seed % 2147483646 + 1) end
    end)
    bind_button("Primary", function() advance() end)
    for _, path in ipairs({"Border", "Panel", "Header", "Moon", "MoonShade", "MoonSpark", "Heading", "Seed",
        "Divider", "TeamCaption", "FooterLine", "Battle/Border", "Battle/Surface", "Battle/Rule"}) do
        show(path, true)
    end
    for _, path in ipairs({"Round", "Wins", "Lives"}) do
        show(path, true)
        show(path .. "/Surface", true)
        show(path .. "/Label", true)
    end
    draw()
    log_state()
end

function OnDestroy()
    set_playing(false)
    for hit, callback in pairs(listeners) do
        if hit.alive then hit:RemoveCursorEventListener(Enum.CursorEventType.CursorClick, callback) end
    end
    listeners = {}
end
