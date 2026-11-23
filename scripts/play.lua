package.path = "src/?.lua;" .. package.path

local data = require("autopets.data")
local run = require("autopets.run")

local rules = data.rules

local function number(text)
    return text and math.tointeger(tonumber(text))
end

local seed = number(arg[1])
if #arg > 1 or (arg[1] and not seed) then
    io.stderr:write("用法  lua scripts/play.lua [整数种子]\n")
    os.exit(1)
end

local game = run.new(seed or os.time())

local function ability_text(pet, level)
    local ability = pet.ability
    local power = ability.power * level
    local detail
    if ability.effect == "shield_front" then
        detail = string.format("开场为最前 %d 名友方各提供 %d 护盾", ability.targets, power)
    elseif ability.effect == "hit_random" then
        detail = string.format("开场随机攻击最多 %d 名敌方，各造成 %d 伤害", ability.targets, power)
    elseif ability.effect == "buff_front" then
        detail = string.format("退场时为最前面的友方增加 %d 生命", power)
    elseif ability.effect == "summon" then
        local token = data.token_by_id[ability.token]
        detail = string.format("退场时召唤最多 %d 只%s（%d 攻 %d 命）",
            ability.power, token.name, token.attack + level - 1, token.health)
    end
    return ability.name .. (detail and " · " .. detail or "")
end

local function print_team(label, team)
    print(label .. "（从前至后）")
    if #team == 0 then
        print("  空")
    end
    for index, unit in ipairs(team) do
        local pet = data.pet_by_id[unit.id]
        print(string.format("  %d  %s  攻 %d  命 %d  Lv%d  XP %d  %s",
            index, pet.name, unit.attack, unit.health, unit.level, unit.xp or 0,
            ability_text(pet, unit.level)))
    end
end

local function print_offers(label, offers, definitions)
    print(label)
    for index, offer in ipairs(offers) do
        if offer then
            local item = definitions[offer.id]
            local frozen = offer.frozen and "  [冻结]" or ""
            if item.ability then
                print(string.format("  %d  %s  T%d  攻 %d  命 %d  %s%s",
                    index, item.name, item.tier, item.attack, item.health, ability_text(item, 1), frozen))
            else
                print(string.format("  %d  %s  T%d  攻 %+d  命 %+d%s",
                    index, item.name, item.tier, item.attack, item.health, frozen))
            end
        else
            print(string.format("  %d  空", index))
        end
    end
end

local outcomes = { win = "胜利", loss = "落败", draw = "平局" }
local phases = { preparation = "准备", battle = "战斗", settlement = "结算", ended = "终局" }
local styles = { guardian = "守护", striker = "强攻", swarm = "群战" }
local sides = { player = "己方", enemy = "对手" }

local function show()
    local state = game:snapshot()
    print(string.format("第 %d 轮  %s  胜场 %d/%d  生命 %d/%d  种子 %d",
        state.round, phases[state.phase], state.wins, rules.wins_to_win,
        state.lives, rules.start_lives, state.seed))
    if state.phase == "preparation" then
        print_team("己方阵容", state.shop.team)
        print_team("对手 · " .. styles[state.opponent.style], state.opponent.team)
        print(string.format("金币 %d  商店 T%d  刷新 %d 金币",
            state.shop.gold, state.shop.tier, rules.reroll_cost))
        print_offers(string.format("动物（%d 金币）", rules.pet_cost),
            state.shop.pets, data.pet_by_id)
        print_offers(string.format("食物（%d 金币）", rules.food_cost),
            state.shop.foods, data.food_by_id)
        if #state.shop.rewards > 0 then
            print_offers(string.format("升级奖励（%d 金币）", rules.pet_cost),
                state.shop.rewards, data.pet_by_id)
        end
    else
        print("本轮 " .. outcomes[state.battle.outcome])
        if state.phase == "battle" then
            print("输入 settle 结算战斗，或 replay 重看事件。")
        elseif state.phase == "settlement" then
            print("输入 next 进入下一轮。")
        else
            print("单局" .. outcomes[state.final] .. "。输入 restart [种子] 重开。")
        end
    end
end

local errors = {
    wrong_phase = "当前阶段无法执行该操作",
    empty_team = "请先购买动物",
    missing_offer = "该位置没有商品",
    invalid_position = "位置无效",
    insufficient_gold = "金币不足",
    team_full = "阵容已满",
    different_pet = "只能合成同种动物",
    max_level = "目标动物已满级",
    same_position = "请选择两个不同的阵容位置",
    invalid_offer_type = "商品类型应为 pet 或 food",
    all_frozen = "当前商品均已冻结",
    invalid_seed = "种子应为整数",
}

local function report(error_code)
    print("操作失败 · " .. (errors[error_code] or error_code))
end

local function shop_action(action, ...)
    local ok, error_code = game:shop_action(action, ...)
    if ok then
        show()
    else
        report(error_code)
    end
end

local function unit_label(side, slot, name, id)
    return string.format("%s %s [%s]", sides[side] or "", name or id or "", slot or "?")
end

local function event_label(event)
    local unit = unit_label(event.side, event.slot, event.name, event.id)
    if event.type == "start" then
        return "战斗开始"
    elseif event.type == "skill" then
        return unit .. " 发动 " .. (event.ability or "技能")
    elseif event.type == "attack" then
        local target = unit_label(event.target_side, event.target_slot, event.target_name, event.target_id)
        return unit .. " 攻击 " .. target
    elseif event.type == "damage" then
        local shield = event.absorbed > 0 and string.format("，护盾抵消 %d", event.absorbed) or ""
        return string.format("%s 受到 %d 伤害，剩余生命 %d%s", unit, event.amount, event.health, shield)
    elseif event.type == "faint" then
        return unit .. " 退场"
    elseif event.type == "summon" then
        return string.format("%s 被召唤（%d 攻 %d 命）", unit, event.attack, event.health)
    elseif event.type == "buff" then
        return string.format("%s 增加 %d 生命，当前生命 %d", unit, event.amount, event.health)
    elseif event.type == "shield" then
        return string.format("%s 获得 %d 护盾，当前护盾 %d", unit, event.amount, event.shield)
    elseif event.type == "result" then
        return "战斗结束 · " .. outcomes[event.outcome]
    end
    return event.type
end

local function replay()
    local result = game:snapshot().battle
    if not result then
        print("当前回合还没有战斗记录。")
        return
    end
    for _, event in ipairs(result.events) do
        print("  " .. event_label(event))
    end
end

local help = [[
show  查看本轮
buy <动物> [站位]  购买动物
combine <动物> <队员>  购买并合成
reward <奖励> [站位]  购买升级奖励
reward-merge <奖励> <队员>  购买奖励并合成
sell <队员>  售出动物
move <队员> <站位>  调整站位
merge <来源> <目标>  合并同种队员
food <食物> <队员>  喂食
freeze <pet|food> <货位>  切换冻结
reroll  刷新商店
battle  开始战斗
replay  回放战斗事件
settle  结算战斗
next  继续下一轮
restart [种子]  在准备或终局重开（默认沿用当前种子）
help  显示指令
quit  退出]]

local function transition(action, ...)
    local ok, error_code = game[action](game, ...)
    if ok then
        if action == "submit" then
            replay()
        end
        show()
    else
        report(error_code)
    end
end

local handlers = {
    show = { 0, 0, show },
    buy = { 1, 2, function(offer, position) shop_action("buy", offer, position) end },
    combine = { 2, 2, function(offer, target) shop_action("combine", offer, target) end },
    reward = { 1, 2, function(offer, position) shop_action("buy", offer, position, true) end },
    ["reward-merge"] = { 2, 2, function(offer, target) shop_action("combine", offer, target, true) end },
    sell = { 1, 1, function(position) shop_action("sell", position) end },
    move = { 2, 2, function(from, to) shop_action("move", from, to) end },
    merge = { 2, 2, function(from, to) shop_action("merge", from, to) end },
    food = { 2, 2, function(offer, target) shop_action("feed", offer, target) end },
    freeze = { 2, 2, function(kind, offer) shop_action("freeze", kind, offer) end },
    reroll = { 0, 0, function() shop_action("reroll") end },
    battle = { 0, 0, function() transition("submit") end },
    replay = { 0, 0, replay },
    settle = { 0, 0, function() transition("settle") end },
    next = { 0, 0, function() transition("advance") end },
    restart = { 0, 1, function(next_seed) transition("restart", next_seed) end },
    help = { 0, 0, function() print(help) end },
}

print("小动物自走棋  ·  输入 help 查看指令")
show()
while true do
    io.write("> ")
    io.flush()
    local line = io.read("*l")
    if not line then
        break
    end
    local words = {}
    for word in line:gmatch("%S+") do
        words[#words + 1] = word
    end
    local command = table.remove(words, 1)
    if command == "quit" and #words == 0 then
        break
    end
    if command then
        local handler = handlers[command]
        local valid = handler and #words >= handler[1] and #words <= handler[2]
        if valid then
            local first_number = command == "freeze" and 2 or 1
            for index = first_number, #words do
                words[index] = number(words[index])
                if not words[index] then
                    valid = false
                    break
                end
            end
        end
        if valid then
            handler[3](table.unpack(words))
        else
            print("指令或参数无效。输入 help 查看用法。")
        end
    end
end
