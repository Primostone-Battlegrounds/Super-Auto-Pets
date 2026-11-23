local rules_data = require("autopets.data")
local run = require("autopets.run")
local root = script.object
local rules = rules_data.rules

local outcomes = {win = "胜利", loss = "落败", draw = "平局"}
local styles = {guardian = "守护", striker = "强攻", swarm = "群战"}
local phases = {preparation = "准备", battle = "战斗", settlement = "结算", ended = "终局"}
local primary = {preparation = "开战", battle = "结算", settlement = "下一轮", ended = "重开"}
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
local listeners = {}

local function control(path)
    return assert(root:FindChild(path), "missing control: " .. path)
end

local function show(path, visible)
    local node = control(path)
    if visible then node:SetActive(true) end
    node:SetVisible(visible)
    if not visible then node:SetActive(false) end
end

local function text(path, content)
    local node = control(path)
    node:SetActive(true)
    node:SetVisible(true)
    node.text = content
end

local function card(path, title, detail, selected)
    show(path, true)
    show(path .. "/Face", true)
    text(path .. "/Name", title)
    text(path .. "/Detail", detail)
    if selected ~= nil then show(path .. "/Selected", selected) end
end

local function team_card(path, unit, index, selected)
    if unit then
        local pet = rules_data.pet_by_id[unit.id]
        card(path, pet.name, string.format("攻 %d · 命 %d · Lv%d", unit.attack, unit.health, unit.level), selected)
    else
        card(path, "空位 " .. index, "", selected)
    end
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
    if not item then
        card(path, kind == "reward" and "升级奖励" or "空商品", "", selected)
        return
    end
    local is_food = kind == "food"
    local definition = (is_food and rules_data.food_by_id or rules_data.pet_by_id)[item.id]
    local cost = is_food and rules.food_cost or rules.pet_cost
    local detail = string.format("%d 金 · 攻%d 命%d", cost, definition.attack, definition.health)
    if item.frozen then detail = "冻结 · " .. detail end
    if kind == "reward" then detail = string.format("%d/%d · %s", index, #state.shop.rewards, detail) end
    card(path, definition.name, detail, selected)
end

local function battle_event(event)
    if event.type == "result" then return "战斗结束 · " .. outcomes[event.outcome] end
    if not event.name then return events[event.type] or event.type end
    local side = event.side == "player" and "我方" or "对方"
    local summary = side .. " " .. event.name .. " · " .. (events[event.type] or event.type)
    if event.ability then return summary .. "「" .. event.ability .. "」" end
    if event.target_name then return summary .. " → " .. event.target_name end
    if event.amount then return summary .. " " .. event.amount end
    return summary
end

local function draw()
    state = session:snapshot()
    local preparing = state.phase == "preparation"
    text("Meter", string.format("第 %d 轮 · %s     胜 %d/%d · 命 %d/%d",
        state.round, phases[state.phase], state.wins, rules.wins_to_win, state.lives, rules.start_lives))
    text("OpponentCaption", "对手 · " .. styles[state.opponent.style])
    for index = 1, rules.team_size do
        team_card("Enemy" .. index, state.opponent.team[index], index)
        team_card("Team" .. index, state.shop.team[index], index, is_selected("team", index))
    end
    show("Shop", preparing)
    show("Battle", not preparing)
    if preparing then
        reward_index = math.max(1, math.min(reward_index, #state.shop.rewards))
        text("Shop/Caption", string.format("商店 T%d · %d 金币", state.shop.tier, state.shop.gold))
        for index = 1, rules.pet_shop_slots do offer_card("Shop/Pet" .. index, "pet", index) end
        for index = 1, rules.food_shop_slots do offer_card("Shop/Food" .. index, "food", index) end
        offer_card("Shop/Reward", "reward", reward_index)
    else
        local battle = state.battle
        local headline = state.final and "单局" .. outcomes[state.final] or "本轮" .. outcomes[battle.outcome]
        text("Battle/Outcome", headline)
        text("Battle/Event", string.format("%d/%d  %s", event_index, #battle.events, battle_event(battle.events[event_index])))
    end
    text("Primary/Title", primary[state.phase])
    text("Hint", message or (preparing and "先选商品或队员，再选目标格或点击操作按钮" or "点击查看战斗事件，或继续本局"))
end

local function log_state()
    print(string.format("AUTO_PETS_M1 phase=%s round=%d wins=%d lives=%d final=%s",
        state.phase, state.round, state.wins, state.lives, state.final or "-"))
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

local function replay()
    local battle = state.battle
    if not battle then return end
    event_index = event_index % #battle.events + 1
    draw()
end

local function advance()
    local old = state.phase
    local ok, error_code
    if old == "preparation" then
        ok, error_code = session:submit()
    elseif old == "battle" then
        ok, error_code = session:settle()
    elseif old == "settlement" then
        ok, error_code = session:advance()
    else
        ok, error_code = session:restart()
    end
    if ok then
        selection, message = nil, nil
        reward_index, event_index = 1, 1
    else
        message = errors[error_code] or error_code
    end
    draw()
    if ok then log_state() end
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
    bind_button("Primary", advance)
    show("Panel", true)
    show("Heading", true)
    show("TeamCaption", true)
    draw()
    log_state()
end

function OnDestroy()
    for hit, callback in pairs(listeners) do
        if hit.alive then hit:RemoveCursorEventListener(Enum.CursorEventType.CursorClick, callback) end
    end
    listeners = {}
end
