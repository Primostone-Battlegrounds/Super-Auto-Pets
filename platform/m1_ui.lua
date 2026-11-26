local rules_data = native_catalog
local run = require("autopets.run")
local art = require("autopets.art")
local bind_portrait = require("autopets.native_portrait")
local animal_ability = require("autopets.animal_ability")
local pet_presentation = require("autopets.pet_presentation")
local shop_input = require("autopets.shop_input")
local replay_view = require("autopets.replay_view")
local root
local view_enabled = false
local rules = rules_data.rules

local outcomes = {win = "胜利", loss = "落败", draw = "平局"}
local styles = {guardian = "守护", striker = "强攻", swarm = "群战"}
local difficulty_names = {standard = "标准", beginner = "入门"}
local phases = {preparation = "准备", battle = "战斗", settlement = "结算", ended = "终局"}
local primary = {preparation = "开战", battle = "结算", settlement = "下一轮", ended = "再挑战本局"}
local battle_sides = {player = "我方", enemy = "对方"}
local errors = {
    empty_team = "先购买至少一只动物", missing_offer = "这个位置暂无商品", invalid_position = "请选择有效位置",
    insufficient_gold = "金币不足", team_full = "阵容已满", different_pet = "只能合并同种动物",
    max_level = "已达最高等级", same_position = "请选择不同站位", all_frozen = "当前商品都已冻结",
    strike_limit = "战斗超过步数上限，无法结算", opponent_preparing = "对手正在准备，请稍后开战",
}

local session, state, selection, message
local press, drag, pending_drop, hovered
local drop_targets = {}
local menu_open, has_started = true, false
local difficulty
local confirming_restart
local reward_index, event_index = 1, 1
local listeners, controls = {}, {}
local portrait, shared_portraits
local parked_portraits = {}
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

local function control(path)
    if not controls[path] then controls[path] = assert(root:FindChild(path), "missing control: " .. path) end
    return controls[path]
end

local function portrait_control(path)
    local enemy, suffix = path:match("^Enemy(%d+)(/Portrait.*)$")
    if shared_portraits and enemy then return control(shared_portrait_homes[tonumber(enemy)] .. suffix) end
    return control(path)
end

local function restore_portraits()
    for _, entry in ipairs(parked_portraits) do
        if entry.picture.alive and entry.parent.alive then
            entry.picture.parent = entry.parent
            entry.picture:SetSiblingIndex(entry.sibling)
            entry.picture:SetAnchoredPosition(entry.x, entry.y)
        end
    end
    parked_portraits = {}
end

local function arrange_portraits(preparing)
    if not shared_portraits then return end
    restore_portraits()
    if not preparing then
        for index, path in ipairs(shared_portrait_homes) do
            local picture = control(path .. "/Portrait")
            local x, y = picture:GetAnchoredPosition()
            parked_portraits[index] = {picture = picture, parent = control(path), sibling = picture:GetSiblingIndex(), x = x, y = y}
            picture.parent = control("Enemy" .. index)
            picture:SetAsLastSibling()
        end
    end
    portrait = bind_portrait(portrait_control, 1.68)
    lunging = nil
end

local function clear_drag()
    if not drag then return end
    local picture, parent = drag.picture, drag.parent
    if picture.alive and parent.alive then
        picture.parent = parent
        picture:SetSiblingIndex(drag.sibling)
        picture:SetAnchoredPosition(drag.x, drag.y)
    end
    drag = nil
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

local function card(path, title, selected, id, face, rim, mirrored)
    show(path, true)
    show(path .. "/Rim", true)
    show(path .. "/Face", true)
    control(path .. "/Face").imageColor = colour(face)
    control(path .. "/Rim").imageColor = colour(rim)
    if drag and drag.parent == control(path) then title = "拖动中" end
    if title then text(path .. "/Name", title) else show(path .. "/Name", false) end
    portrait(path .. "/Portrait", id, mirrored)
    if selected ~= nil and not path:match("^Shop/") then show(path .. "/Selected", selected) end
end

local function card_stats(path, attack, health, boosted)
    local occupied = attack ~= nil
    for _, child in ipairs({"StatsPaper", "LifePaper", "Detail", "LifeValue"}) do
        show(path .. "/" .. child, occupied)
    end
    if occupied then
        local format = boosted and "%+d" or "%d"
        text(path .. "/Detail", string.format(format, attack))
        text(path .. "/LifeValue", string.format(format, health))
    end
end

local function team_card(path, unit, selected, effect)
    local mirrored = selected == nil
    local preparing = state.phase == "preparation"
    local background = unit and (mirrored and 0xf0c49e or 0xd6dcac) or (preparing and 0xe8d5ab or 0xdac297)
    local rim = selected and 0xa86214 or not unit and 0xa28654 or mirrored and 0x976b43 or 0x819254
    if effect then background, rim = effect.face, effect.ink end
    local health_path = path .. "/Health"
    show(path .. "/HealthTrack", unit ~= nil and not preparing)
    show(health_path, unit ~= nil and unit.health > 0 and not preparing)
    if not mirrored then
        show(path .. "/XPPaper", preparing and unit ~= nil)
        if preparing and unit then
            if shared_portraits then
                text(path .. "/XP", pet_presentation.level(unit, rules.level_xp))
            else
                local threshold = rules.level_xp[unit.level + 1]
                local progress = threshold and string.format("经验 %d/%d", unit.xp, threshold) or "经验已满"
                text(path .. "/XP", "L" .. unit.level .. "  " .. progress)
            end
        else
            show(path .. "/XP", false)
        end
    end
    if not unit then
        card(path, nil, selected, nil, background, rim, mirrored)
        card_stats(path)
        show(path .. "/Tag", false)
        return
    end
    local pet = rules_data.pet_by_id[unit.id] or rules_data.token_by_id[unit.id]
    card(path, pet.name, selected, unit.id, background, rim, mirrored)
    card_stats(path, unit.attack, unit.health)
    local tag = effect and effect.label or ((unit.shield or 0) > 0 and "盾 " .. unit.shield
        or (not preparing and "L" .. unit.level or ""))
    text(path .. "/Tag", tag, effect and effect.ink or 0x315a6d)

    local maximum = unit.max_health or unit.health
    local ratio = maximum > 0 and math.max(0, unit.health / maximum) or 0
    local width = 88 * ratio
    local bar = control(health_path)
    if width > 0 then
        bar:SetSizeDelta(width, 4)
        bar:SetAnchoredPosition((width - 88) / 2, -71)
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
        local member = state.shop.team[source.index]
        local same_species = (dropped or shared_portraits) and unit and member and unit.id == member.id
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

local function drag_feedback(source)
    if not source then return end
    if not source.target then
        if source.kind == "food" then return "拖向一名队员喂食" end
        if source.kind == "team" then return "拖到同种队员合并，拖到其他站位换位" end
        return "拖向目标站位，空位表示队尾"
    end
    local action, index = action_for_team(source, source.target, true)
    if not action then return "此处不能放入，松开将取消" end
    local unit = state.shop.team[index]
    if (action == "merge" or action == "combine") and unit.level == rules.max_level then
        return "目标已满级，无法合并"
    end
    if action == "buy" and #state.shop.team == rules.team_size then return "阵容已满，无法购买" end
    local cost = (action == "buy" or action == "combine") and rules.pet_cost or (action == "feed" and rules.food_cost)
    if cost and state.shop.gold < cost then return string.format("金币不足，需要 %d 金", cost) end
    local name = drop_labels[action]
    if action == "merge" then return "确认合并后会消耗拖动的队员", name, action, index end
    if cost then return string.format("%s需 %d 金", name, cost), name, action, index end
    return "确认后移动该队员", name, action, index
end

local function offer_card(path, kind, index)
    local item = offer(kind, index)
    local selected = matches(drag or selection, kind, index)
    local face = selected and 0xfff4ce or 0xead19a
    local rim = selected and 0xa86214 or (item and item.frozen and 0x245f72 or 0xa16c39)
    show(path .. "/Frozen", item and item.frozen == true or false)
    show(path .. "/Price", not not item)
    show(path .. "/PriceIcon", not not item)
    local frozen = item and item.frozen == true
    show(path .. "/Tag", not not item and (shared_portraits or frozen or kind == "reward"))
    if frozen and not shared_portraits then text(path .. "/Tag", "已冻结") end
    if not item then
        card(path, kind == "reward" and "升级奖励" or "空商品", selected, nil, face, rim)
        card_stats(path)
        return
    end
    local is_food = kind == "food"
    local definition = (is_food and rules_data.food_by_id or rules_data.pet_by_id)[item.id]
    local cost = is_food and rules.food_cost or rules.pet_cost
    if shared_portraits then
        text(path .. "/Tag", pet_presentation.tier(definition))
    elseif kind == "reward" then
        text(path .. "/Tag", string.format("%d/%d", index, #state.shop.rewards))
    end
    card(path, definition.name, selected, item.id, face, rim)
    text(path .. "/Price", string.format("%d金", cost))
    card_stats(path, definition.attack, definition.health, is_food)
end

local function selected_info(picked)
    local kind, index = picked.kind, picked.index
    if kind == "team" then
        local unit = state.shop.team[index]
        if shared_portraits then return pet_presentation.animal(rules_data, rules_data.pet_by_id[unit.id], unit) end
        return animal_ability.describe(rules_data, rules_data.pet_by_id[unit.id], unit.level)
    end
    local item = offer(kind, index)
    if kind == "food" then
        local food = rules_data.food_by_id[item.id]
        if shared_portraits then return pet_presentation.food(food) end
        if food.adjacent_attack or food.adjacent_health then
            return food.name .. " · 食物", string.format("目标 +%d攻 +%d命 · 邻位 +%d攻 +%d命",
                food.attack, food.health, food.adjacent_attack or 0, food.adjacent_health or 0)
        end
        local stats = {}
        if food.attack > 0 then stats[#stats + 1] = string.format("攻击 +%d", food.attack) end
        if food.health > 0 then stats[#stats + 1] = string.format("生命 +%d", food.health) end
        return food.name .. " · 食物", "一名队员获得 " .. table.concat(stats, "，")
    end
    local pet = rules_data.pet_by_id[item.id]
    if shared_portraits then return pet_presentation.animal(rules_data, pet) end
    return animal_ability.describe(rules_data, pet, 1)
end

local function draw_tooltip(preparing)
    local picked = preparing and not menu_open and not confirming_restart and (drag or selection or hovered)
    show("Tooltip", not not picked)
    if not picked then
        if not shared_portraits then control("Shop/Caption"):SetAnchoredPosition(-465, 106) end
        return
    end
    local parents = {team = "Team", pet = "Shop/Pet", food = "Shop/Food"}
    local path = picked.kind == "reward" and "Shop/Reward" or parents[picked.kind] .. picked.index
    local card_x, card_y = control(path):GetAnchoredPosition()
    local x = math.max(-370, math.min(370, card_x))
    if not shared_portraits then control("Shop/Caption"):SetAnchoredPosition(x < -150 and 452 or -465, 106) end
    local beside_team = picked.kind == "team"
    local tooltip = control("Tooltip")
    local _, tooltip_height = tooltip:GetSizeDelta()
    local _, hit_height = control(path .. "/Hit"):GetSizeDelta()
    tooltip:SetAnchoredPosition(x, beside_team and card_y - (tooltip_height + hit_height) / 2 - 6 or -2)
    control("Tooltip/Pointer"):SetAnchoredPosition(card_x - x, beside_team and 40 or -40)
    local heading, body = selected_info(picked)
    text("Tooltip/Heading", heading)
    text("Tooltip/Body", body)
end

local function arrange(preparing)
    if preparing_layout == preparing then return end
    preparing_layout = preparing
    arrange_portraits(preparing)
    local track_y = preparing and 17 or -15
    control("Field/PrepRail"):SetAnchoredPosition(0, track_y)
    control("Field/TrackShadow"):SetAnchoredPosition(0, track_y - 7)
    show("Field/RivalTrack", not preparing)
    control("TeamCaption"):SetAnchoredPosition(-309, preparing and 208 or 161)
    control("OpponentCaption"):SetAnchoredPosition(309, preparing and 208 or 161)
    control("Hint"):SetAnchoredPosition(preparing and -52 or -153, -292)
    control("Hint"):SetSizeDelta(preparing and 590 or 824, 53)
    for index = 1, rules.team_size do
        local x, y = 82 + (index - 1) * 112, 54
        local team_path = "Team" .. index
        local prep_y = shared_portraits and 145 or 82
        control(team_path):SetAnchoredPosition(preparing and (3 - index) * 176 or -x, preparing and prep_y or y)
        show(team_path .. "/Hit", preparing)
        if preparing then show("Enemy" .. index, false) end
    end
end

local function unit_path(side, slot)
    return (side == "player" and "Team" or "Enemy") .. slot
end

local function draw_battle_cue(event, passed, cue)
    local strike = cue and cue.kind == "attack"
    local impact = cue and (cue.kind == "damage" or cue.kind == "guard" or cue.kind == "shield")
    local actor = strike and unit_path(cue.side, cue.slot)
    if lunging and lunging ~= actor then portrait_control(lunging .. "/Portrait"):SetAnchoredPosition(0, 27) end
    lunging = actor
    local intensity = math.max(0, 1 - (passed or 0) / 0.28)
    show("BattleFX", impact == true or (strike == true and intensity > 0))
    show("BattleFX/Strike", strike == true and intensity > 0)
    show("BattleFX/Impact", impact == true)
    if strike then
        local direction = cue.side == "player" and 1 or -1
        local lunge = direction * 10 * intensity
        portrait_control(actor .. "/Portrait"):SetAnchoredPosition(lunge, 27 + 2 * intensity)
        local x, y = control(actor):GetAnchoredPosition()
        local target_x, target_y = control(unit_path(event.target_side, event.target_slot)):GetAnchoredPosition()
        control("BattleFX/Strike"):SetAnchoredPosition((x + lunge + target_x) / 2, (y + target_y) / 2 + 27 - 118)
    elseif impact then
        local x, y = control(unit_path(cue.side, cue.slot)):GetAnchoredPosition()
        local centreward = cue.side == "player" and 1 or -1
        local lateral = cue.slot == 1 and centreward * 59 or 0
        local above = cue.slot == 1 and 52 or 70
        control("BattleFX/Impact"):SetAnchoredPosition(x + lateral, y + above - 118)
        local burst = control("BattleFX/Impact/Burst")
        burst:SetSizeDelta(52 + 12 * intensity, 34 + 7 * intensity)
        burst.imageColor = colour(cue.face)
        local has_shield = cue.kind == "shield" or (event.absorbed or 0) > 0
        show("BattleFX/Impact/Spark", has_shield)
        text("BattleFX/Impact/Value", cue.label, cue.ink)
    end
end

local function replay_pending()
    return reviewing or (state.phase == "battle" and not replay_complete)
end

local function draw_menu()
    show("Menu", menu_open)
    if not menu_open then return end
    if shared_portraits then text("Menu/Heading", has_started and "暂停" or "单人 AI 练习") end
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
    local event = battle and replay_view.event(battle.events, event_index, rules_data)
    local player, enemy = state.shop.team, state.opponent and state.opponent.team
    local board = battle and replay_view.board(battle.events, event_index)
    if board then player, enemy = board.player, board.enemy end
    local first_cue, second_cue = replay_view.cues(event, board)
    local function effect(side, slot)
        if first_cue and first_cue.side == side and first_cue.slot == slot then return first_cue end
        if second_cue and second_cue.side == side and second_cue.slot == slot then return second_cue end
    end
    local drop_source = drag or pending_drop
    local drag_hint, drop_label = drag_feedback(drop_source)
    arrange(preparing)
    text("Round/Value", shared_portraits and preparing and tostring(state.round)
        or string.format("第 %d 轮 · %s", state.round, phases[state.phase]))
    text("Money/Value", tostring(state.shop.gold))
    text("Wins/Value", string.format("%d / %d", state.wins, rules.wins_to_win))
    text("Lives/Value", string.format("%d / %d", state.lives, rules.start_lives), state.lives <= 1 and 0x9c3328 or 0x733b31)
    text("TeamCaption", preparing and "我的阵容 · 右侧前排" or "我方")
    local opponent = preparing and "下一位电脑对手" or "电脑对手"
    local style = state.opponent and styles[state.opponent.style]
    text("OpponentCaption", style and (opponent .. " · " .. style) or opponent)
    if drag then
        show("TeamCaption", false)
        show("OpponentCaption", false)
    end
    for index = 1, rules.team_size do
        if not preparing then
            team_card("Enemy" .. index, enemy[index], nil, effect("enemy", index))
        end
        local path = "Team" .. index
        team_card(path, player[index], matches(drag or selection, "team", index), effect("player", index))
        local drop = drop_label and drop_source.target == index
        local origin = drag or shared_portraits and selection
        local _, _, legal = drag_feedback(origin and {kind = origin.kind, index = origin.index, merge = origin.merge, target = index})
        show(path .. "/DropTarget", drop == true or legal ~= nil)
        local action = drop and pending_drop and pending_drop.action or legal
        local combining = action == "merge" or action == "combine"
        if drop or legal then
            control(path .. "/DropTarget").imageColor = colour(combining and 0x9f782a or drop and 0x20655e or 0x508774)
        end
        if drop then
            show(path .. "/Name", false)
            local caption = pending_drop and ("确认" .. drop_label) or drop_label
            text(path .. "/DropLabel", shared_portraits and combining and ("➜ " .. caption) or caption)
        elseif shared_portraits and combining then
            text(path .. "/DropLabel", "➜ 合并")
        else
            show(path .. "/DropLabel", false)
        end
    end
    show("Shop", preparing)
    show("Battle", not preparing)
    show("Reset", preparing and not shared_portraits)
    if shared_portraits then show("Heading", false) end
    draw_menu()
    show("Restart", confirming_restart ~= nil)
    if confirming_restart then
        local in_menu = confirming_restart == "menu"
        text("Restart/Heading", in_menu and "放弃本局？" or "重开本局？")
        text("Restart/Body", in_menu and "本局阵容与战绩将清空，开始一局新游戏。" or "本局阵容与战绩将清空。")
        text("Restart/Cancel/Title", in_menu and "返回菜单" or "继续本局")
        text("Restart/Confirm/Title", in_menu and "确认放弃" or "确认重开")
    end
    draw_battle_cue(event, elapsed, first_cue)
    local title = primary[state.phase]
    local hint = "拖动商品或队员到阵容，也可点击选择"
    if preparing then
        if #state.shop.team == 0 then
            hint = state.shop.gold < rules.pet_cost and (shared_portraits and "金币不足以招募。可从暂停菜单重开。"
                or "金币不足以招募。点“重开本局”恢复。")
                or "先招一只动物：拖到高亮站位，点一下确认。也可以点选动物后购买。"
        end
        reward_index = math.max(1, math.min(reward_index, #state.shop.rewards))
        text("Shop/Caption", string.format("商店 · %d 阶", state.shop.tier))
        text("Shop/Buy/Title", string.format("购买 · %d 金", rules.pet_cost))
        local reroll_tier = shared_portraits and (" · " .. pet_presentation.tier(state.shop.tier)) or ""
        text("Shop/Reroll/Title", pending_drop and "取消拖放" or string.format("刷新 · %d 金", rules.reroll_cost) .. reroll_tier)
        local picked = drag or selection
        local selling = picked and picked.kind == "team" and state.shop.team[picked.index]
        local refund = selling and string.format("+%d 金", selling.level * rules.sell_gold_per_level)
            or string.format("+%d 金/级", rules.sell_gold_per_level)
        text("Shop/Sell/Title", "出售 · " .. refund)
        for index = 1, rules.pet_shop_slots do offer_card("Shop/Pet" .. index, "pet", index) end
        for index = 1, rules.food_shop_slots do offer_card("Shop/Food" .. index, "food", index) end
        offer_card("Shop/Reward", "reward", reward_index)
        if shared_portraits then
            local freezing = picked and (picked.kind == "pet" or picked.kind == "food") and offer(picked.kind, picked.index)
            local buying = picked and (picked.kind == "pet" or picked.kind == "reward") and offer(picked.kind, picked.index)
            show("Shop/Merge", false)
            show("Shop/Buy", not not buying)
            show("Shop/Sell", not not selling)
            show("Shop/Freeze", not not freezing)
            show("Shop/Reward", #state.shop.rewards > 0)
            show("Shop/RewardNext", #state.shop.rewards > 1)
            if selling then
                local x = control("Team" .. picked.index):GetAnchoredPosition()
                control("Shop/Sell"):SetAnchoredPosition(x, 146)
            end
            if freezing then
                local x = control("Shop/" .. (picked.kind == "pet" and "Pet" or "Food") .. picked.index):GetAnchoredPosition()
                control("Shop/Freeze"):SetAnchoredPosition(x, -118)
                text("Shop/Freeze/Title", freezing.frozen and "解冻" or "冻结")
            end
        end
    else
        local replaying = replay_pending()
        local headline = state.final and "单局" .. outcomes[state.final] or "本轮" .. outcomes[battle.outcome]
        local accent = replaying and 0x286452 or accents[battle.outcome]
        text("Battle/Outcome", replaying and "战斗回放" or headline, accent)
        text("Battle/Event", string.format("%d / %d   %s", event_index, #battle.events,
            replay_view.describe(event, rules_data, battle_sides)))
        text("Battle/Auto/Title", playing and "暂停回放" or "继续回放")
        text("Battle/Fast/Title", string.format("速度：%d 倍", replay_speed))
        show("Battle/Replay", replaying)
        show("Battle/Auto", replaying)
        show("Battle/Fast", replaying)
        show("Battle/Rewatch", replay_complete and not reviewing)
        show("Battle/NewSeed", state.phase == "ended" and not reviewing)
        control("Battle/Rewatch"):SetAnchoredPosition(state.phase == "ended" and -111 or 0, -33)
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
    if pending_drop then
        drag_hint = string.format("%s。点高亮站位确认，或点「取消拖放」。", drag_hint)
    end
    text("Hint", drag_hint or message or hint)
end

local function log_state()
    print(string.format("AUTO_PETS_M1 phase=%s round=%d wins=%d lives=%d final=%s seed=%d",
        state.phase, state.round, state.wins, state.lives, state.final or "-", state.seed))
end

local function command(action, ...)
    clear_drag()
    local ok, error_code = session:shop_action(action, ...)
    if ok then
        local before = state.shop
        state = session:snapshot()
        hovered = nil
        message = shared_portraits and pet_presentation.level_up(before, state.shop, rules_data) or nil
        if action ~= "freeze" then selection = nil end
        play_sound(action_sounds[action])
    else
        message = errors[error_code] or error_code
    end
    draw(false)
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
        message = selection and (shared_portraits and "选择同种队员合并，其他站位换位" or "选择另一个站位移动，或点击合并队员、出售") or nil
        draw()
        return
    end
    local action, destination = action_for_team(selection, index)
    apply_to_team(action, selection, destination)
end

local function move_drag_picture(event, target)
    local x, y = event:GetUIPos()
    local width, height = game.GetUICanvasSize()
    -- Keep the dragged portrait clear of the target portrait and the drop label.
    local picture_width, picture_height = drag.picture:GetSizeDelta()
    local half_width, half_height = picture_width / 2, picture_height / 2
    local lift = y + 42
    if target then
        local path = "Team" .. target
        local slot_x, slot_y = control(path):GetAnchoredPosition()
        x = width / 2 + slot_x + (slot_x > 0 and -88 or 88)
        lift = height / 2 + slot_y + 72
    end
    local center_x = math.max(half_width, math.min(width - half_width, x))
    local center_y = math.max(half_height, math.min(height - half_height, lift))
    drag.picture:SetAnchoredPosition(center_x - width / 2, center_y - height / 2)
end

local function begin_drag(event, path, kind, index)
    if drag or state.phase ~= "preparation" then return end
    local item
    if kind == "team" then item = state.shop.team[index] else item = offer(kind, index) end
    if item then
        local picture = control(path .. "/Portrait")
        local x, y = picture:GetAnchoredPosition()
        drag = {touch = event.touchId, kind = kind, index = index, picture = picture,
            parent = control(path), sibling = picture:GetSiblingIndex(), x = x, y = y}
        picture.parent = root
        picture:SetAsLastSibling()
        move_drag_picture(event)
        draw(false)
    end
end

local function drop_slot(event)
    return shop_input.team_slot(event, drop_targets)
end

local function update_drag(event)
    if not drag or drag.touch ~= event.touchId then return end
    local target = drop_slot(event)
    move_drag_picture(event, target)
    if drag.target == target then return end
    drag.target = target
    draw(false)
end

local function end_drag(event)
    if not drag or drag.touch ~= event.touchId then return end
    local target = drop_slot(event)
    local source = {kind = drag.kind, index = drag.index, target = target}
    press = nil
    clear_drag()
    if state.phase ~= "preparation" then return end
    local feedback, _, action, destination = drag_feedback(source)
    if action then
        -- Native release and system interruption can both arrive as EndDrag.
        -- Only a new click may commit the pending placement.
        source.action, source.destination = action, destination
        pending_drop, selection = source, nil
        message = nil
    else
        message = target and feedback or "已取消拖放"
    end
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
    clear_drag()
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
    clear_drag()
    press, selection, message, pending_drop, hovered = nil, nil, nil, nil, nil
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
    clear_drag()
    menu_open = true
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
    clear_drag()
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
    local event = replay_view.event(battle.events, event_index, rules_data)
    local delay = replay_view.duration(event)
    elapsed = elapsed + dt * replay_speed
    if elapsed < delay then
        if event.type == "attack" or event.type == "damage" or event.type == "shield" then
            local cue = replay_view.cues(event, replay_view.board(battle.events, event_index))
            draw_battle_cue(event, elapsed, cue)
        end
        return
    end
    event_index, elapsed = event_index + 1, 0
    local upcoming = replay_view.event(battle.events, event_index, rules_data)
    if upcoming.type == "damage" then
        if (upcoming.health_loss or upcoming.amount) > 0 then play_sound(50936)
        elseif upcoming.absorbed > 0 then play_sound(51044) end
    end
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

local function bind(path, callback, on_drag, kind, index)
    local hit = control(path .. "/Hit")
    hit:SetActive(true)
    hit:SetVisible(true)
    local bound = {
        [Enum.CursorEventType.CursorDown] = function(event)
            if not allows_input(path) then return end
            press = {touch = event.touchId, path = path}
            if drag then
                clear_drag()
                draw(false)
            end
        end,
        [Enum.CursorEventType.CursorClick] = function(event)
            if not pressed_here(path, event) then return end
            local moved = press.moved
            press = nil
            if moved or not allows_input(path) then return end
            local drop = pending_drop
            if not drop then callback(); return end
            pending_drop = nil
            if path == "Team" .. drop.target then
                apply_to_team(drop.action, drop, drop.destination)
            else
                message = "已取消拖放"
                draw(false)
            end
        end,
    }
    if shared_portraits and kind and Enum.CursorEventType.CursorEnter and Enum.CursorEventType.CursorExit then
        bound[Enum.CursorEventType.CursorEnter] = function()
            if not allows_input(path) or state.phase ~= "preparation" then return end
            local item = kind == "team" and state.shop.team[index()] or kind ~= "team" and offer(kind, index())
            hovered = item and {kind = kind, index = index()} or nil
            draw_tooltip(true)
        end
        bound[Enum.CursorEventType.CursorExit] = function()
            if hovered and matches(hovered, kind, index()) then
                hovered = nil
                draw_tooltip(state.phase == "preparation")
            end
        end
    end
    if on_drag then
        bound[Enum.CursorEventType.CursorBeginDrag] = function(event)
            if not allows_input(path) or not pressed_here(path, event) then return end
            press.moved = true
            if pending_drop then
                pending_drop = nil
                draw(false)
            end
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
    end, function(event) begin_drag(event, path, kind, index or reward_index) end, kind,
        function() return index or reward_index end)
end

local function bind_button(path, callback)
    show(path, true)
    show(path .. "/Rim", true)
    show(path .. "/Face", true)
    show(path .. "/Title", true)
    bind(path, callback)
end

local function fill_viewport()
    local width, height = game.GetUICanvasSize()
    for _, path in ipairs({"Border", "Panel", "Menu/Backdrop", "Restart/Shade"}) do
        control(path):SetSizeDelta(width, height)
    end
    for _, path in ipairs({"Header", "Field/Surface", "Field/Ground", "Field/PrepRail", "Field/TrackShadow",
        "Shop/Paper", "Shop/Rail", "Battle/Surface"}) do
        local _, authored_height = control(path):GetSizeDelta()
        control(path):SetSizeDelta(width, authored_height)
    end
end

local function release_view()
    view_enabled = false
    clear_drag()
    restore_portraits()
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
    press, selection, message, pending_drop, hovered = nil, nil, nil, nil, nil
    listeners, controls, portrait = {}, {}, nil
    drop_targets = {}
    visibility, displayed_text, displayed_colour = {}, {}, {}
    preparing_layout, lunging = nil, nil
end

function OnStart(view_root, back_to_game_menu)
    if session then release_view() end
    root, view_enabled = view_root or script.object, true
    if not view_root then set_visual_plates(root) end
    shared_portraits = view_root ~= nil
    if shared_portraits and game.GetUICanvasSize then fill_viewport() end
    portrait = bind_portrait(portrait_control, 1.68)
    menu_open, has_started, confirming_restart = true, false, nil
    difficulty = "standard"
    muted, replay_speed = false, 1
    reset_view()
    for id, layers in pairs(art) do
        assert(#layers <= portrait_layers, "portrait exceeds the native pool: " .. id)
    end
    local seed = assert(math.tointeger(script:GetParam("seed")), "seed must be an integer")
    session = run.new(seed, difficulty, rules_data)
    for index = 1, rules.team_size do
        local path = "Team" .. index
        drop_targets[index] = {control(path), control(path .. "/Hit")}
        bind_card(path, "team", index)
    end
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
    for _, path in ipairs({"Border", "Panel", "Header", "Heading", "Field", "Field/Surface", "Field/Cloud", "Field/Ridge", "Field/Divider", "Field/Ground",
        "Field/PrepRail", "Field/TrackShadow", "Field/LeftBrush", "Field/RightBrush", "Field/Foreground", "Field/Pine",
        "Team1/Front", "Enemy1/Front",
        "Shop/Paper", "Shop/Rail", "TeamCaption",
        "Battle/Surface", "Menu/Backdrop", "Menu/Rim", "Menu/Paper",
        "Menu/Heading"}) do
        show(path, true)
    end
    for _, name in ipairs({"Shade", "Paper", "Heading", "Body"}) do show("Restart/" .. name, true) end
    for _, path in ipairs({"Tooltip/Border", "Tooltip/Paper", "Tooltip/Pointer",
        "BattleFX/Strike/Wake", "BattleFX/Strike/Glint", "BattleFX/Strike/Upper",
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
    clear_drag()
    restore_portraits()
    preparing_layout = nil
    press, pending_drop = nil, nil
    sync_updates()
    stop_sound()
end

function OnDestroy()
    release_view()
end
