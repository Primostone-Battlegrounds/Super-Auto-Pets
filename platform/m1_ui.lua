local rules_data = native_catalog
local run = require("autopets.run")
local art = require("autopets.art")
local animal_ability = require("autopets.animal_ability")
local root
local view_enabled = false
local rules = rules_data.rules

local outcomes = {win = "胜利", loss = "落败", draw = "平局"}
local styles = {guardian = "守护", striker = "强攻", swarm = "群战"}
local difficulty_names = {standard = "标准", beginner = "入门"}
local phases = {preparation = "准备", battle = "战斗", settlement = "结算", ended = "终局"}
local primary = {preparation = "开战", battle = "结算", settlement = "下一轮", ended = "再挑战本局"}
local events = {
    start = "战斗开始", skill = "发动技能", attack = "发起攻击", damage = "受到伤害",
    faint = "退场", summon = "入场", buff = "增加生命", shield = "获得护盾", result = "战斗结束",
}
local errors = {
    empty_team = "先购买至少一只动物", missing_offer = "这个位置暂无商品", invalid_position = "请选择有效位置",
    insufficient_gold = "金币不足", team_full = "阵容已满", different_pet = "只能合并同种动物",
    max_level = "已达最高等级", same_position = "请选择不同站位", all_frozen = "当前商品都已冻结",
    strike_limit = "战斗超过步数上限，无法结算", opponent_preparing = "对手正在准备，请稍后开战",
}

local session, state, selection, message
local press, drag
local menu_open, has_started = true, false
local difficulty
local confirming_restart
local reward_index, event_index = 1, 1
local listeners, controls, portraits = {}, {}, {}
local visibility, displayed_text, displayed_colour = {}, {}, {}
local playing, elapsed, replay_speed = false, 0, 1
local replay_complete, reviewing = false, false
local muted, sound_instance = false, nil
-- Built-in 千星 sound catalog, from the pinned MCP tooling.
local action_sounds = {buy = 50916, combine = 50917, merge = 50917, feed = 50882, freeze = 50937, reroll = 50929}
local result_sounds = {win = 50915, loss = 50931, draw = 50916}
local preparing_layout
local lunging
local accents = {win = 0x286452, loss = 0x984434, draw = 0x89591e}
local drop_labels = {buy = "购买", combine = "购买并合并", feed = "喂食", move = "换位", merge = "合并"}
local effects = {
    attack = {label = "出击", face = 0xe6c881, ink = 0x80521d},
    damage = {face = 0xe1a18a, ink = 0x8f3c30},
    summon = {label = "入场", face = 0x94c2a8, ink = 0x286452},
    shield = {label = "护盾", face = 0x9ebec5, ink = 0x315a6d},
    buff = {label = "强化", face = 0x94c2a8, ink = 0x286452},
}

local function control(path)
    if not controls[path] then controls[path] = assert(root:FindChild(path), "missing control: " .. path) end
    return controls[path]
end

local function show(path, visible)
    if visibility[path] == visible then return end
    visibility[path] = visible
    local node = control(path)
    if visible then node:SetActive(true) end
    node:SetVisible(visible)
    if not visible then node:SetActive(false) end
end

local function colour(rgb)
    return Color(rgb >> 16, (rgb >> 8) & 255, rgb & 255, 255)
end

local function text(path, content, rgb)
    show(path, true)
    local node = control(path)
    if displayed_text[path] ~= content then
        node.text = content
        displayed_text[path] = content
    end
    if rgb and displayed_colour[path] ~= rgb then
        node.fontColor = colour(rgb)
        displayed_colour[path] = rgb
    end
end

local function stop_sound()
    if sound_instance and type(game.StopAudio) == "function" then
        pcall(game.StopAudio, sound_instance)
    end
    sound_instance = nil
end

local function play_sound(sound)
    if muted or not sound or type(game.PlayAudio2D) ~= "function" then return end
    stop_sound()
    local ok, instance = pcall(game.PlayAudio2D, sound)
    if ok and math.type(instance) == "integer" then sound_instance = instance end
end

local function portrait(path, id, mirrored)
    local key = id and (id .. (mirrored and ":left" or ":right")) or false
    if portraits[path] == key then return end
    portraits[path] = key
    local base = path .. "/Portrait"
    local layers = id and assert(art[id], id) or {}
    show(base, true)
    for index = 1, portrait_layers do
        local layer_path = base .. "/Layer" .. index
        local layer = layers[index]
        show(layer_path, layer ~= nil)
        if layer then
            local image, x, y, width, height, r, g, b = table.unpack(layer)
            local node = control(layer_path)
            node:SetImage(Enum.ImageSource.StaticReference, image)
            node.imageType = Enum.ImageType.Stretch
            node:SetAnchoredPosition((mirrored and -x or x) * 1.56, y * 1.56)
            node:SetSizeDelta(width * 1.56, height * 1.56)
            node.imageColor = Color(r, g, b, 255)
        end
    end
end

local function card(path, title, detail, selected, id, face, rim, mirrored)
    show(path, true)
    show(path .. "/Rim", true)
    show(path .. "/Face", true)
    control(path .. "/Face").imageColor = colour(face)
    control(path .. "/Rim").imageColor = colour(rim)
    text(path .. "/Name", title)
    show(path .. "/StatsPaper", detail ~= "")
    text(path .. "/Detail", detail)
    portrait(path, id, mirrored)
    if selected ~= nil then show(path .. "/Selected", selected) end
end

local function team_card(path, unit, index, selected, effect)
    local mirrored = selected == nil
    local background = mirrored and 0xb79389 or 0x8aaf9c
    local rim = selected and 0x9b6021 or 0x9fb2aa
    if effect then background, rim = effect.face, effect.ink end
    local health_path = path .. "/Health"
    local preparing = state.phase == "preparation"
    show(path .. "/HealthTrack", unit ~= nil and not preparing)
    show(health_path, unit ~= nil and unit.health > 0 and not preparing)
    if not mirrored then
        show(path .. "/XPPaper", preparing and unit ~= nil)
        if preparing and unit then
            local threshold = rules.level_xp[unit.level + 1]
            local progress = threshold and string.format("经验 %d/%d", unit.xp, threshold) or "经验已满"
            text(path .. "/XP", "L" .. unit.level .. "  " .. progress)
        else
            show(path .. "/XP", false)
        end
    end
    if not unit then
        card(path, "空位 " .. index, "", selected, nil, background, rim)
        text(path .. "/Tag", "")
        return
    end
    local pet = rules_data.pet_by_id[unit.id] or rules_data.token_by_id[unit.id]
    card(path, pet.name, string.format("%d攻  %d命", unit.attack, unit.health),
        selected, unit.id, background, rim, mirrored)
    local tag = effect and effect.label or ((unit.shield or 0) > 0 and "盾 " .. unit.shield
        or (not preparing and "L" .. unit.level or ""))
    text(path .. "/Tag", tag, effect and effect.ink or 0x315a6d)

    local maximum = unit.max_health or unit.health
    local ratio = maximum > 0 and math.max(0, unit.health / maximum) or 0
    local width = 88 * ratio
    local bar = control(health_path)
    if width > 0 then
        bar:SetSizeDelta(width, 4)
        bar:SetAnchoredPosition((width - 88) / 2, -61)
    end
    bar.imageColor = colour(ratio <= 0.35 and 0x984434 or 0x448269)
end

local function matches(picked, kind, index)
    return picked ~= nil and picked.kind == kind and picked.index == index
end

local function offer(kind, index)
    if kind == "pet" then return state.shop.pets[index] end
    if kind == "food" then return state.shop.foods[index] end
    return state.shop.rewards[index]
end

local function action_for_team(source, index, dropped)
    local unit = state.shop.team[index]
    if source.kind == "team" then
        local same_species = dropped and unit and unit.id == state.shop.team[source.index].id
        if dropped then
            index = math.min(index, #state.shop.team)
            if index == source.index then return end
        end
        return (source.merge or same_species) and "merge" or "move", index
    elseif source.kind == "food" then
        if dropped and not unit then return end
        return "feed", index
    elseif unit and unit.id == offer(source.kind, source.index).id then
        return "combine", index
    end
    return "buy", dropped and math.min(index, #state.shop.team + 1) or index
end

local function drag_feedback()
    if not drag then return end
    if not drag.target then
        if drag.kind == "food" then return "拖向一名队员喂食" end
        if drag.kind == "team" then return "拖到同种队员会合并，点击两个站位可换位" end
        return "松开放入目标站位，空位表示队尾"
    end
    local action, index = action_for_team(drag, drag.target, true)
    if not action then return "此处不能放入，松开将取消" end
    local unit = state.shop.team[index]
    if (action == "merge" or action == "combine") and unit.level == rules.max_level then
        return "目标已满级，无法合并"
    end
    if action == "buy" and #state.shop.team == rules.team_size then return "阵容已满，无法购买" end
    local cost = (action == "buy" or action == "combine") and rules.pet_cost or (action == "feed" and rules.food_cost)
    if cost and state.shop.gold < cost then return string.format("金币不足，需要 %d 金", cost) end
    local name = drop_labels[action]
    if action == "merge" then return "松开将合并，拖动的队员会被消耗", name end
    if cost then return string.format("松开将%s，花费 %d 金", name, cost), name end
    return "松开将移动该队员", name
end

local function offer_card(path, kind, index)
    local item = offer(kind, index)
    local selected = matches(drag or selection, kind, index)
    local face = selected and 0xfff9e9 or 0xe9d3a0
    local rim = selected and 0xa66c27 or (item and item.frozen and 0x406f82 or 0xd2ba86)
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

local function selected_info(picked)
    local kind, index = picked.kind, picked.index
    if kind == "team" then
        local unit = state.shop.team[index]
        return animal_ability.describe(rules_data, rules_data.pet_by_id[unit.id], unit.level)
    end
    local item = offer(kind, index)
    if kind == "food" then
        local food = rules_data.food_by_id[item.id]
        if food.adjacent_attack or food.adjacent_health then
            return food.name .. " · 食物", string.format("目标 +%d攻 +%d命 · 邻位 +%d攻 +%d命",
                food.attack, food.health, food.adjacent_attack or 0, food.adjacent_health or 0)
        end
        local stats = {}
        if food.attack > 0 then stats[#stats + 1] = string.format("攻击 +%d", food.attack) end
        if food.health > 0 then stats[#stats + 1] = string.format("生命 +%d", food.health) end
        return food.name .. " · 食物", "一名队员获得 " .. table.concat(stats, "，")
    end
    return animal_ability.describe(rules_data, rules_data.pet_by_id[item.id], 1)
end

local function draw_tooltip(preparing)
    local picked = preparing and not menu_open and not confirming_restart and (drag or selection)
    show("Tooltip", not not picked)
    local caption = control("Shop/Caption")
    if not picked then
        caption:SetAnchoredPosition(-465, 106)
        return
    end
    local parents = {team = "Team", pet = "Shop/Pet", food = "Shop/Food"}
    local path = picked.kind == "reward" and "Shop/Reward" or parents[picked.kind] .. picked.index
    local card_x = control(path):GetAnchoredPosition()
    local x = math.max(-394, math.min(394, card_x))
    caption:SetAnchoredPosition(x < -185 and 452 or -465, 106)
    control("Tooltip"):SetAnchoredPosition(x, -10)
    control("Tooltip/Pointer"):SetAnchoredPosition(card_x - x, picked.kind == "team" and 33 or -33)
    local heading, body = selected_info(picked)
    text("Tooltip/Heading", heading)
    text("Tooltip/Body", body)
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
    if event.attack_amount then
        return string.format("%s %s · +%d攻 +%d命", side, event.name, event.attack_amount, event.amount)
    end
    if event.amount then return summary .. " " .. event.amount end
    return summary
end

local function arrange(preparing)
    if preparing_layout == preparing then return end
    preparing_layout = preparing
    show("Field/PrepRail", preparing)
    show("Field/AllyRail", not preparing)
    show("Field/RivalRail", not preparing)
    show("Field/Clash", not preparing)
    for index = 1, rules.team_size do
        local x, y = 91 + (index - 1) * 112, 115 - (index - 1) * 9
        local team_path = "Team" .. index
        control(team_path):SetAnchoredPosition(preparing and (3 - index) * 176 or -x, preparing and 104 or y)
        show(team_path .. "/Hit", preparing)
        if preparing then show("Enemy" .. index, false) end
    end
end

local function unit_path(side, slot)
    return (side == "player" and "Team" or "Enemy") .. slot
end

local function draw_battle_cue(event, passed)
    local strike = event and event.type == "attack"
    local impact = event and event.type == "damage"
    local actor = strike and unit_path(event.side, event.slot)
    if lunging and lunging ~= actor then control(lunging .. "/Portrait"):SetAnchoredPosition(0, 27) end
    lunging = actor
    local intensity = math.max(0, 1 - (passed or 0) / 0.28)
    show("BattleFX", impact == true or (strike == true and intensity > 0))
    show("BattleFX/Strike", strike == true and intensity > 0)
    show("BattleFX/Impact", impact == true)
    if strike then
        local direction = event.side == "player" and 1 or -1
        local lunge = direction * 12 * intensity
        control(actor .. "/Portrait"):SetAnchoredPosition(lunge, 27 + 2 * intensity)
        local x, y = control(actor):GetAnchoredPosition()
        local target_x, target_y = control(unit_path(event.target_side, event.target_slot)):GetAnchoredPosition()
        control("BattleFX/Strike"):SetAnchoredPosition((x + lunge + target_x) / 2, (y + target_y) / 2 + 27 - 118)
    elseif impact then
        local x, y = control(unit_path(event.side, event.slot)):GetAnchoredPosition()
        local centreward = event.side == "player" and 1 or -1
        local lateral = event.slot == 1 and centreward * 59 or 0
        local above = event.slot == 1 and 52 or 70
        control("BattleFX/Impact"):SetAnchoredPosition(x + lateral, y + above - 118)
        local burst = control("BattleFX/Impact/Burst")
        burst:SetSizeDelta(52 + 12 * intensity, 34 + 7 * intensity)
        burst.imageColor = colour(event.amount == 0 and 0xaac9d2 or 0xf3c58a)
        text("BattleFX/Impact/Value", event.amount == 0 and "格挡" or ("-" .. event.amount),
            event.amount == 0 and 0x315a6d or 0x8f3c30)
    end
end

local function replay_pending()
    return reviewing or (state.phase == "battle" and not replay_complete)
end

local function draw_menu()
    show("Menu", menu_open)
    if not menu_open then return end
    text("Menu/Continue/Title", has_started and "继续本局" or "单人练习")
    show("Menu/NewGame", has_started)
    show("Menu/Difficulty", not has_started)
    if has_started then
        text("Menu/Progress", string.format("%s · 第 %d 轮 · %s · %d 胜 · 剩余 %d 命",
            difficulty_names[difficulty], state.round, phases[state.phase], state.wins, state.lives))
        text("Menu/NewGame/Title", state.phase == "ended" and "新一局" or "放弃并开新局")
    else
        show("Menu/Progress", false)
        text("Menu/Difficulty/Title", "练习难度：" .. difficulty_names[difficulty])
    end
    text("Menu/Audio/Title", muted and "音效：关闭" or "音效：开启")
end

local function draw(refresh)
    if refresh ~= false then state = session:snapshot() end
    local preparing = state.phase == "preparation"
    local battle = state.battle
    local event = battle and battle.events[event_index]
    local player, enemy = state.shop.team, state.opponent and state.opponent.team
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
    if event and event.type == "damage" then
        local paint = event.amount == 0 and effects.shield or effects.damage
        effect = { label = "", face = paint.face, ink = paint.ink }
    end
    local drag_hint, drop_label = drag_feedback()
    arrange(preparing)
    text("Round/Value", string.format("第 %d 轮 · %s", state.round, phases[state.phase]))
    text("Money/Value", tostring(state.shop.gold))
    text("Wins/Value", string.format("%d / %d", state.wins, rules.wins_to_win))
    text("Lives/Value", string.format("%d / %d", state.lives, rules.start_lives), state.lives <= 1 and 0x984434 or 0x286452)
    text("TeamCaption", preparing and "我的阵容 · 右侧为前排" or "我方")
    local opponent = preparing and "下一位电脑对手" or "电脑对手"
    local style = state.opponent and styles[state.opponent.style]
    text("OpponentCaption", style and (opponent .. " · " .. style) or opponent)
    for index = 1, rules.team_size do
        local hit = effect and event.slot == index
        if not preparing then
            team_card("Enemy" .. index, enemy[index], index, nil, hit and event.side == "enemy" and effect)
        end
        team_card("Team" .. index, player[index], index, matches(drag or selection, "team", index),
            hit and event.side == "player" and effect)
        local drop = drop_label and drag.target == index
        show("Team" .. index .. "/DropTarget", drop == true)
        if drop then text("Team" .. index .. "/DropLabel", drop_label)
        else show("Team" .. index .. "/DropLabel", false) end
    end
    show("Shop", preparing)
    show("Battle", not preparing)
    show("Reset", preparing)
    draw_menu()
    show("Restart", confirming_restart ~= nil)
    if confirming_restart then
        local in_menu = confirming_restart == "menu"
        text("Restart/Heading", in_menu and "放弃本局？" or "重开本局？")
        text("Restart/Body", in_menu and "本局阵容与战绩将清空，开始一局新游戏。" or "本局阵容与战绩将清空。")
        text("Restart/Cancel/Title", in_menu and "返回菜单" or "继续本局")
        text("Restart/Confirm/Title", in_menu and "确认放弃" or "确认重开")
    end
    draw_battle_cue(event, elapsed)
    local title = primary[state.phase]
    local hint = "拖动商品或队员到阵容，也可点击选择"
    if preparing then
        if #state.shop.team == 0 then
            hint = state.shop.gold < rules.pet_cost and "金币不足以招募。点“重开本局”恢复。"
                or "先拖一只动物入队，或点选购买。输一轮扣一命，平局保留生命。"
        end
        reward_index = math.max(1, math.min(reward_index, #state.shop.rewards))
        text("Shop/Caption", string.format("商店 · %d 阶", state.shop.tier))
        text("Shop/Buy/Title", string.format("购买 · %d 金", rules.pet_cost))
        text("Shop/Reroll/Title", string.format("刷新 · %d 金", rules.reroll_cost))
        local picked = drag or selection
        local selling = picked and picked.kind == "team" and state.shop.team[picked.index]
        local refund = selling and string.format("+%d 金", selling.level * rules.sell_gold_per_level)
            or string.format("+%d 金/级", rules.sell_gold_per_level)
        text("Shop/Sell/Title", "出售 · " .. refund)
        for index = 1, rules.pet_shop_slots do offer_card("Shop/Pet" .. index, "pet", index) end
        for index = 1, rules.food_shop_slots do offer_card("Shop/Food" .. index, "food", index) end
        offer_card("Shop/Reward", "reward", reward_index)
    else
        local replaying = replay_pending()
        local headline = state.final and "单局" .. outcomes[state.final] or "本轮" .. outcomes[battle.outcome]
        local accent = replaying and 0x286452 or accents[battle.outcome]
        text("Battle/Outcome", replaying and "战斗回放" or headline, accent)
        control("Battle/Rule").imageColor = colour(accent)
        control("Battle/Border").imageColor = colour(state.final and accent or 0x90aa91)
        text("Battle/Event", string.format("%d / %d   %s", event_index, #battle.events, battle_event(event)))
        text("Battle/Auto/Title", playing and "暂停回放" or "继续回放")
        text("Battle/Fast/Title", string.format("速度：%d 倍", replay_speed))
        show("Battle/Replay", replaying)
        show("Battle/Auto", replaying)
        show("Battle/Fast", replaying)
        show("Battle/Rewatch", replay_complete and not reviewing)
        show("Battle/NewSeed", state.phase == "ended" and not reviewing)
        if replaying then
            title = "跳过回放"
            hint = "可暂停、调整速度或跳到本轮结果"
        elseif state.phase == "ended" then
            hint = "可重看最后一场战斗，或开始新一局"
        else
            hint = "可重看战斗，或继续本局"
        end
    end
    draw_tooltip(preparing)
    text("Primary/Title", title)
    text("Hint", drag_hint or message or hint)
end

local function log_state()
    print(string.format("AUTO_PETS_M1 phase=%s round=%d wins=%d lives=%d final=%s seed=%d",
        state.phase, state.round, state.wins, state.lives, state.final or "-", state.seed))
end

local function command(action, ...)
    drag = nil
    local ok, error_code = session:shop_action(action, ...)
    if ok then
        message = nil
        if action ~= "freeze" then selection = nil end
        play_sound(action_sounds[action])
    else
        message = errors[error_code] or error_code
    end
    draw()
end

local function choose_offer(kind, index)
    if state.phase ~= "preparation" then return end
    if not offer(kind, index) then message = errors.missing_offer; draw(); return end
    local already_selected = matches(selection, kind, index)
    selection = not already_selected and {kind = kind, index = index} or nil
    message = selection and (kind == "food" and "选择要喂食的队员" or "点击购买添加到队尾，或选择站位") or nil
    draw()
end

local function apply_to_team(action, source, index)
    if action == "buy" or action == "combine" then
        command(action, source.index, index, source.kind == "reward")
    else
        command(action, source.index, index)
    end
end

local function choose_team(index)
    if state.phase ~= "preparation" then return end
    local unit = state.shop.team[index]
    if not selection or matches(selection, "team", index) then
        selection = not selection and unit and {kind = "team", index = index} or nil
        message = selection and "选择另一个站位移动，或点击合并队员、出售" or nil
        draw()
        return
    end
    local action, destination = action_for_team(selection, index)
    apply_to_team(action, selection, destination)
end

local function begin_drag(event, kind, index)
    if drag or state.phase ~= "preparation" then return end
    local item
    if kind == "team" then item = state.shop.team[index] else item = offer(kind, index) end
    if item then
        drag = {touch = event.touchId, kind = kind, index = index}
        draw(false)
    end
end

local function drop_slot(event)
    local pointer_x, pointer_y = event:GetUIPos()
    local width, height = game.GetUICanvasSize()
    -- The script root stretches across the canvas. The roster and its hit areas have centred anchors and pivots.
    local x, y = pointer_x - width / 2, pointer_y - height / 2
    for index = 1, rules.team_size do
        local path = "Team" .. index
        local slot_x, slot_y = control(path):GetAnchoredPosition()
        local hit = control(path .. "/Hit")
        local hit_x, hit_y = hit:GetAnchoredPosition()
        local hit_width, hit_height = hit:GetSizeDelta()
        if math.abs(x - slot_x - hit_x) <= hit_width / 2 and math.abs(y - slot_y - hit_y) <= hit_height / 2 then
            return index
        end
    end
end

local function update_drag(event)
    if not drag or drag.touch ~= event.touchId then return end
    local target = drop_slot(event)
    if drag.target == target then return end
    drag.target = target
    draw(false)
end

local function end_drag(event)
    if not drag or drag.touch ~= event.touchId then return end
    local source = drag
    press, drag = nil, nil
    if state.phase ~= "preparation" then return end
    local index = drop_slot(event)
    if index then
        local action, destination = action_for_team(source, index, true)
        if action then
            apply_to_team(action, source, destination)
            return
        end
    end
    message = "已取消拖放"
    draw(false)
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
    drag = nil
    local count = #state.shop.rewards
    if count > 0 then reward_index = reward_index % count + 1 end
    selection = nil
    message = count > 0 and "选择要购买的升级奖励" or "队员升级可获得奖励"
    draw()
end

local function sync_updates()
    script:EnableUpdate(view_enabled and playing and not menu_open)
end

local function set_playing(value)
    playing = value
    sync_updates()
end

local function reach_result()
    event_index, elapsed = #state.battle.events, 0
    replay_complete, reviewing = true, false
    set_playing(false)
end

local function replay()
    if not replay_pending() then return end
    set_playing(false)
    stop_sound()
    event_index = event_index + 1
    elapsed = 0
    if event_index == #state.battle.events then reach_result() end
    draw(false)
end

local function toggle_replay()
    if not replay_pending() then return end
    set_playing(not playing)
    if not playing then stop_sound() end
    draw(false)
end

local function toggle_speed()
    if not replay_pending() then return end
    replay_speed = replay_speed == 1 and 3 or 1
    draw(false)
end

local function rewatch()
    if not state.battle or not replay_complete or reviewing then return end
    event_index, elapsed, reviewing = 1, 0, true
    set_playing(true)
    draw(false)
end

local function next_seed()
    return state.seed % 2147483646 + 1
end

local function reset_view()
    press, drag, selection, message = nil, nil, nil, nil
    reward_index, event_index, elapsed = 1, 1, 0
    replay_complete, reviewing = false, false
    set_playing(false)
end

local function advance(new_seed)
    if replay_pending() then
        stop_sound()
        reach_result()
        draw(false)
        return
    end
    local old = state.phase
    local ok, error_code
    if old == "preparation" then
        ok, error_code = session:submit()
    elseif old == "battle" then
        ok, error_code = session:settle()
    elseif old == "settlement" then
        ok, error_code = session:advance()
    else
        ok, error_code = session:restart(new_seed)
    end
    if ok then
        if old == "battle" then
            reach_result()
            play_sound(result_sounds[state.battle.outcome])
        else
            reset_view()
            set_playing(old == "preparation")
        end
    else
        message = errors[error_code] or error_code
    end
    draw()
    if ok then log_state() end
end

local function open_menu()
    menu_open, drag = true, nil
    stop_sound()
    sync_updates()
    draw(false)
end

local function continue_game()
    has_started, menu_open = true, false
    sync_updates()
    draw(false)
end

local function choose_difficulty()
    if has_started then return end
    difficulty = difficulty == "standard" and "beginner" or "standard"
    session = run.new(state.seed, difficulty, rules_data)
    draw()
end

local function toggle_audio()
    muted = not muted
    if muted then stop_sound() end
    draw_menu()
end

local function show_restart(context)
    if context == "board" and state.phase ~= "preparation" then return end
    if context == "menu" and (not has_started or state.phase == "ended") then return end
    drag = nil
    confirming_restart = context
    draw(false)
end

local function new_game_from_menu()
    if not has_started then return end
    if state.phase ~= "ended" then
        show_restart("menu")
        return
    end
    session = run.new(next_seed(), difficulty, rules_data)
    has_started = false
    reset_view()
    draw()
    log_state()
end

local function confirm_restart()
    if not confirming_restart then return end
    local in_menu = confirming_restart == "menu"
    confirming_restart = nil
    if in_menu then
        session = run.new(next_seed(), difficulty, rules_data)
        menu_open = false
    else
        local ok, error_code = session:restart()
        if not ok then
            message = errors[error_code] or error_code
            draw()
            return
        end
    end
    stop_sound()
    reset_view()
    draw()
    log_state()
end

function OnUpdate(dt)
    if not view_enabled or not playing or menu_open then return end
    local battle = state.battle
    local event = battle.events[event_index]
    local delay = event.type == "damage" and 0.55 or 0.4
    elapsed = elapsed + dt * replay_speed
    if elapsed < delay then
        if event.type == "attack" or event.type == "damage" then draw_battle_cue(event, elapsed) end
        return
    end
    event_index, elapsed = event_index + 1, 0
    local upcoming = battle.events[event_index]
    if upcoming.type == "damage" then play_sound(upcoming.amount > 0 and 50936 or 51044) end
    if event_index == #battle.events then reach_result() end
    draw(false)
end

local function allows_input(path)
    if not view_enabled then return false end
    if confirming_restart then return path:match("^Restart/") ~= nil end
    if menu_open then return path:match("^Menu/") ~= nil end
    return not path:match("^Menu/") and not path:match("^Restart/")
end

local function pressed_here(path, event)
    return event and press and press.touch == event.touchId and press.path == path
end

local function bind(path, callback, on_drag)
    local hit = control(path .. "/Hit")
    hit:SetActive(true)
    hit:SetVisible(true)
    local bound = {
        [Enum.CursorEventType.CursorDown] = function(event)
            if not allows_input(path) then return end
            press = {touch = event.touchId, path = path}
            if drag then
                drag = nil
                draw(false)
            end
        end,
        [Enum.CursorEventType.CursorClick] = function(event)
            if not pressed_here(path, event) then return end
            local moved = press.moved
            press = nil
            if not moved and allows_input(path) then callback() end
        end,
    }
    if on_drag then
        bound[Enum.CursorEventType.CursorBeginDrag] = function(event)
            if not allows_input(path) or not pressed_here(path, event) then return end
            press.moved = true
            on_drag(event)
        end
        bound[Enum.CursorEventType.CursorDrag] = function(event)
            if pressed_here(path, event) and allows_input(path) then update_drag(event) end
        end
        bound[Enum.CursorEventType.CursorEndDrag] = function(event)
            if pressed_here(path, event) and allows_input(path) then end_drag(event) end
        end
    end
    for event, handler in pairs(bound) do hit:AddCursorEventListener(event, handler) end
    listeners[hit] = bound
end

local function bind_card(path, kind, index)
    bind(path, function()
        if kind == "team" then choose_team(index) else choose_offer(kind, index or reward_index) end
    end, function(event) begin_drag(event, kind, index or reward_index) end)
end

local function bind_button(path, callback)
    show(path, true)
    show(path .. "/Rim", true)
    show(path .. "/Face", true)
    show(path .. "/Title", true)
    bind(path, callback)
end

local function release_view()
    view_enabled = false
    set_playing(false)
    stop_sound()
    for hit, bound in pairs(listeners) do
        if hit.alive then
            for event, handler in pairs(bound) do hit:RemoveCursorEventListener(event, handler) end
        end
    end
    local old_portrait = lunging and controls[lunging .. "/Portrait"]
    if old_portrait and old_portrait.alive then old_portrait:SetAnchoredPosition(0, 27) end
    root, session, state = nil, nil, nil
    press, drag, selection, message = nil, nil, nil, nil
    listeners, controls, portraits = {}, {}, {}
    visibility, displayed_text, displayed_colour = {}, {}, {}
    preparing_layout, lunging = nil, nil
end

function OnStart(view_root, back_to_game_menu)
    if session then release_view() end
    root, view_enabled = view_root or script.object, true
    menu_open, has_started, confirming_restart = true, false, nil
    difficulty = "standard"
    muted, replay_speed = false, 1
    reset_view()
    for id, layers in pairs(art) do
        assert(#layers <= portrait_layers, "portrait exceeds the native pool: " .. id)
    end
    local seed = assert(math.tointeger(script:GetParam("seed")), "seed must be an integer")
    session = run.new(seed, difficulty, rules_data)
    for index = 1, rules.team_size do bind_card("Team" .. index, "team", index) end
    for index = 1, rules.pet_shop_slots do bind_card("Shop/Pet" .. index, "pet", index) end
    for index = 1, rules.food_shop_slots do bind_card("Shop/Food" .. index, "food", index) end
    bind_card("Shop/Reward", "reward")
    bind_button("Shop/Buy", buy)
    bind_button("Shop/Freeze", freeze)
    bind_button("Shop/Sell", sell)
    bind_button("Shop/Merge", merge)
    bind_button("Shop/Reroll", function() command("reroll") end)
    bind_button("Shop/RewardNext", next_reward)
    bind_button("Battle/Replay", replay)
    bind_button("Battle/Auto", toggle_replay)
    bind_button("Battle/Fast", toggle_speed)
    bind_button("Battle/Rewatch", rewatch)
    bind_button("Battle/NewSeed", function()
        if state.phase == "ended" then advance(next_seed()) end
    end)
    bind_button("Primary", function() advance() end)
    bind_button("OpenMenu", open_menu)
    bind_button("Menu/Continue", continue_game)
    bind_button("Menu/NewGame", new_game_from_menu)
    bind_button("Menu/Difficulty", choose_difficulty)
    bind_button("Menu/Audio", toggle_audio)
    if back_to_game_menu then bind_button("Menu/Back", back_to_game_menu) end
    bind_button("Reset", function() show_restart("board") end)
    bind_button("Restart/Cancel", function() show_restart(nil) end)
    bind_button("Restart/Confirm", confirm_restart)
    for _, path in ipairs({"Border", "Panel", "Header", "Heading", "Field", "Field/Surface", "Field/Divider",
        "Shop/Paper", "Shop/Rail", "Shop/Rule", "Shop/FoodDivider", "Shop/RewardDivider", "TeamCaption",
        "FooterLine", "Battle/Border", "Battle/Surface", "Battle/Rule", "Menu/Backdrop", "Menu/Rim", "Menu/Paper",
        "Menu/Rule", "Menu/Heading"}) do
        show(path, true)
    end
    for _, name in ipairs({"Shade", "Rim", "Paper", "Heading", "Body"}) do show("Restart/" .. name, true) end
    for _, path in ipairs({"Tooltip/Border", "Tooltip/Paper", "Tooltip/Pointer",
        "BattleFX/Strike/Wake", "BattleFX/Strike/Glint", "BattleFX/Strike/Upper", "BattleFX/Strike/Lower",
        "BattleFX/Impact/Burst", "BattleFX/Impact/Flash", "BattleFX/Impact/Spark"}) do show(path, true) end
    for _, path in ipairs({"Round", "Money", "Wins", "Lives"}) do
        show(path, true)
        show(path .. "/Surface", true)
        show(path .. "/Label", true)
    end
    draw()
    log_state()
end

function OnEnable()
    view_enabled = true
    if session then
        sync_updates()
        draw(false)
    end
end

function OnDisable()
    view_enabled = false
    press, drag = nil, nil
    sync_updates()
    stop_sound()
end

function OnDestroy()
    release_view()
end
