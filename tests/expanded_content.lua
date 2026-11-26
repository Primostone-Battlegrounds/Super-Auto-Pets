package.path = "src/?.lua;" .. package.path

local describe = require("autopets.animal_ability").describe
local battle = require("autopets.battle")
local expanded = require("autopets.expanded_data")
local release = require("autopets.release_data")
local rng = require("autopets.rng")
local shop = require("autopets.shop")

local function equal(a, b)
    if type(a) ~= "table" or type(b) ~= "table" then return a == b end
    for key, value in pairs(a) do
        if not equal(value, b[key]) then return false end
    end
    for key in pairs(b) do
        if a[key] == nil then return false end
    end
    return true
end

-- The expected source IDs and combat parameters are independent of the
-- shipped catalog and remain fixed across Lua versions and all three levels.
local additions = {
    {
        {"hamster", "仓鼠", 1, 3, "faint", "buff_front", 2},
        {"chick", "小鸡", 1, 2, "faint", "summon", 1, nil, "nestling"},
        {"hedgehog", "刺猬", 2, 2, "hurt", "shield_next", 2},
        {"sparrow", "麻雀", 2, 2, "summon", "rally_summon", 1},
        {"frog", "青蛙", 2, 3, "attack", "splash", 1},
        {"mouse", "小鼠", 1, 4, "start", "hit_back", 1},
        {"gecko", "壁虎", 3, 1, "start", "hit_front", 1},
    },
    {
        {"squirrel", "松鼠", 2, 4, "start", "shield_front", 1, 2},
        {"badger", "獾", 3, 4, "attack", "splash", 2},
        {"beaver", "河狸", 2, 5, "hurt", "shield_next", 3},
        {"raccoon", "浣熊", 4, 3, "start", "hit_back", 2},
        {"robin", "知更鸟", 2, 4, "faint", "summon", 1, nil, "fledgling"},
        {"duckling", "小鸭", 2, 3, "summon", "rally_summon", 1},
        {"chameleon", "变色龙", 2, 4, "faint", "buff_front", 3},
    },
    {
        {"red_panda", "小熊猫", 3, 5, "faint", "shield_front", 2, 2},
        {"donkey", "驴", 4, 5, "hurt", "shield_next", 4},
        {"penguin", "企鹅", 3, 6, "summon", "rally_summon", 1},
        {"alpaca", "羊驼", 4, 4, "start", "shield_front", 2, 3},
        {"platypus", "鸭嘴兽", 5, 4, "attack", "splash", 2},
        {"lemur", "狐猴", 5, 3, "start", "hit_back", 3},
        {"barn_owl", "仓鸮", 3, 5, "faint", "summon", 2, nil, "nestling"},
    },
    {
        {"boar", "野猪", 6, 5, "attack", "splash", 3},
        {"porcupine", "豪猪", 4, 7, "hurt", "shield_next", 5},
        {"sea_lion", "海狮", 5, 6, "faint", "buff_front", 5},
        {"toucan", "巨嘴鸟", 4, 5, "faint", "summon", 2, nil, "fledgling"},
        {"koala", "考拉", 3, 8, "start", "shield_front", 2, 4},
        {"flamingo", "火烈鸟", 4, 5, "summon", "rally_summon", 2},
        {"giraffe", "长颈鹿", 5, 5, "start", "hit_back", 4},
    },
    {
        {"elephant", "大象", 5, 10, "faint", "buff_front", 7},
        {"snow_leopard", "雪豹", 8, 4, "start", "hit_random", 3, 2},
        {"crocodile", "鳄鱼", 6, 6, "attack", "splash", 4},
        {"kangaroo", "袋鼠", 6, 6, "faint", "shield_front", 4, 2},
        {"brown_bear", "棕熊", 6, 9, "hurt", "shield_next", 6},
        {"bison", "野牛", 6, 9, "start", "hit_front", 5},
        {"octopus", "章鱼", 4, 7, "summon", "rally_summon", 2},
    },
    {
        {"rhinoceros", "犀牛", 8, 9, "faint", "buff_front", 10},
        {"hippo", "河马", 7, 12, "hurt", "shield_next", 8},
        {"tiger", "老虎", 10, 6, "attack", "splash", 6},
        {"orca", "虎鲸", 9, 8, "start", "hit_front", 7},
        {"gorilla", "大猩猩", 6, 11, "start", "shield_front", 3, 4},
        {"giant_panda", "大熊猫", 6, 11, "faint", "shield_front", 4, 3},
        {"blue_whale", "蓝鲸", 8, 11, "start", "hit_random", 3, 3},
    },
}
local legacy_names = {
    "乌龟", "雨燕", "兔子", "旱獭", "狐狸", "水獭", "麝", "猫咪", "绵羊",
    "貘", "狞猫", "鹌鹑", "牦牛", "红隼", "白鹤", "麝牛", "穿山甲", "独角鲸",
}
local token_stats = {nestling = {1, 1}, fledgling = {2, 2}}
for id, token in pairs(release.token_by_id) do token_stats[id] = {token.attack, token.health} end

local function normalized(pet)
    local fields = {}
    for key, value in pairs(pet) do
        if key ~= "name" then fields[key] = value end
    end
    return fields
end

assert(#expanded.pets == 60 and #expanded.foods == 12)
assert(#expanded.rules_hash == 71 and expanded.rules_hash:match("^sha256:%x+$"))
assert(expanded.rules_hash ~= release.rules_hash and equal(expanded.rules, release.rules))
local identifiers, names = {}, {}
for _, list in ipairs({expanded.pets, expanded.foods, expanded.token_by_id}) do
    for _, definition in pairs(list) do
        assert(not identifiers[definition.id] and not names[definition.name], definition.id)
        identifiers[definition.id], names[definition.name] = true, true
    end
end
local tokens = 0
for id, token in pairs(expanded.token_by_id) do
    tokens = tokens + 1
    assert(not expanded.pet_by_id[id] and not expanded.food_by_id[id] and token.id == id)
    assert(equal({token.attack, token.health}, token_stats[id]), id)
end
assert(tokens == 7)
for index, base in ipairs(release.foods) do
    local food = expanded.foods[index]
    assert(food == expanded.food_by_id[base.id] and equal(normalized(food), normalized(base)), base.id)
end

local skills = {}
for tier, new in ipairs(additions) do
    local expected = release.pets_at_tier(tier)
    local available = expanded.pets_at_tier(tier)
    assert(#expected == 3 and #new == 7 and #available == 10)
    assert(#expanded.pets_for_tier(tier) == tier * 10 and #expanded.foods_for_tier(tier) == tier * 2)
    assert(expanded.tier_for_round(tier * 2 - 1) == tier and expanded.tier_for_round(tier * 2) == tier)
    for index, base in ipairs(expected) do
        local pet = available[index]
        assert(pet.name == legacy_names[(tier - 1) * 3 + index] and equal(normalized(pet), normalized(base)), base.id)
        skills[base.id] = base.ability
    end
    for index, entry in ipairs(new) do
        local id, name, attack, health, trigger, effect, power, targets, token = table.unpack(entry, 1, 9)
        local pet = available[3 + index]
        assert(pet.id == id and pet.name == name and pet.attack == attack and pet.health == health, id)
        skills[id] = {trigger = trigger, effect = effect, power = power, targets = targets, token = token}
        for _, field in ipairs({"trigger", "effect", "power", "targets", "token"}) do
            assert(pet.ability[field] == skills[id][field], id .. "/" .. field)
        end
    end
    for slot, pet in ipairs(available) do
        assert(pet == expanded.pets[(tier - 1) * 10 + slot] and pet.tier == tier)
        assert(expanded.pet_by_id[pet.id] == pet)
    end
    available[1] = nil
    assert(#expanded.pets_at_tier(tier) == 10)
end

local function unit(id, uid, level, attack, health)
    local pet = assert(expanded.pet_by_id[id])
    return {id = id, uid = uid, level = level or 1, attack = attack or pet.attack, health = health or pet.health}
end

local function reserves(count)
    local team = {}
    for index = 1, count do team[index] = unit("frog", 20 + index, 1, 20, 30) end
    return team
end

local function opponents(count, attack, health)
    local team = {}
    for index = 1, count do team[index] = unit("hamster", 40 + index, 1, attack or 1, health or 45) end
    return team
end

local function trigger_window(result, actor_uid)
    local window
    for index, event in ipairs(result.events) do
        if window then
            if event.strike ~= window.event.strike or event.type == "skill" then break end
            window.following[#window.following + 1] = event
        elseif event.type == "skill" and event.uid == actor_uid then
            window = {event = event, index = index, following = {}}
        end
    end
    return window
end

local function first_events(window, kind, count)
    local events = {}
    for _, event in ipairs(window.following) do
        if event.type ~= kind then break end
        events[#events + 1] = event
    end
    assert(#events == count, window.event.id .. "/" .. kind)
    return events
end

local function verify_behavior(pet, skill, level)
    local power = skill.power * level
    local actor = unit(pet.id, 11, level)
    local player, enemy = {actor}, opponents(1)
    if skill.effect == "shield_front" or skill.effect == "buff_front" then
        if skill.trigger == "start" then
            player = reserves(4)
            player[#player + 1] = actor
        else
            enemy = opponents(1, actor.health)
            for _, witness in ipairs(reserves(4)) do player[#player + 1] = witness end
        end
    elseif skill.effect == "shield_next" then
        player[2] = reserves(1)[1]
    elseif skill.effect == "hit_random" or skill.effect == "hit_back" or skill.effect == "hit_front" then
        enemy = opponents(5)
    elseif skill.effect == "splash" then
        enemy = opponents(2, actor.health)
    elseif skill.effect == "summon" then
        enemy = opponents(1, actor.health)
        player[2] = reserves(1)[1]
    elseif skill.effect == "rally_summon" then
        player = {unit("chick", 12), actor}
        enemy = opponents(1, player[1].health)
    end
    local result = battle.resolve(player, enemy, 97531, expanded)
    assert(result.status == "resolved" and equal(result, battle.resolve(player, enemy, 97531, expanded)), pet.id)
    local window = assert(trigger_window(result, "player:11"), pet.id)
    assert(window.event.trigger == skill.trigger and window.event.strike == (skill.trigger == "start" and 0 or 1), pet.id)
    if skill.effect == "shield_front" then
        local shields = first_events(window, "shield", skill.targets)
        for slot, event in ipairs(shields) do
            assert(event.uid == "player:" .. (20 + slot) and event.amount == power and event.shield == power, pet.id)
        end
    elseif skill.effect == "buff_front" then
        local buff = first_events(window, "buff", 1)[1]
        assert(buff.uid == "player:21" and buff.amount == power and buff.health == 30 + power, pet.id)
    elseif skill.effect == "shield_next" then
        local shield = first_events(window, "shield", 1)[1]
        assert(shield.uid == "player:21" and shield.amount == power and shield.shield == power, pet.id)
        local triggers = 0
        for _, event in ipairs(result.events) do
            if event.type == "skill" and event.uid == "player:11" then triggers = triggers + 1 end
        end
        assert(triggers == 1, pet.id)
    elseif skill.effect == "hit_random" or skill.effect == "hit_back" or skill.effect == "hit_front" or skill.effect == "splash" then
        local distinct = {}
        for _, damage in ipairs(first_events(window, "damage", skill.targets or 1)) do
            assert(damage.side == "enemy" and damage.source_uid == "player:11", pet.id)
            assert(damage.amount == power and damage.absorbed == 0 and not distinct[damage.slot], pet.id)
            if skill.effect == "hit_back" then assert(damage.slot == 5, pet.id) end
            if skill.effect == "hit_front" then assert(damage.slot == 1, pet.id) end
            if skill.effect == "splash" then assert(damage.slot == 2, pet.id) end
            distinct[damage.slot] = true
        end
    elseif skill.effect == "summon" then
        local expected_stats = token_stats[skill.token]
        local births = first_events(window, "summon", skill.power)
        for slot, birth in ipairs(births) do
            assert(birth.id == skill.token and birth.slot == slot, pet.id)
            assert(birth.attack == expected_stats[1] + level - 1 and birth.health == expected_stats[2], pet.id)
        end
    elseif skill.effect == "rally_summon" then
        local birth = result.events[window.index - 1]
        local buff = first_events(window, "buff", 1)[1]
        assert(birth.type == "summon" and birth.id == "nestling" and buff.uid == birth.uid, pet.id)
        assert(buff.amount == power and buff.attack_amount == power and buff.health == 1 + power, pet.id)
        assert(buff.board.player[1].attack == 1 + power, pet.id)
    else
        error("Missing trigger test " .. pet.id)
    end
    local title, text = describe(expanded, pet, level, true)
    assert(title:find(pet.name .. " · L" .. level, 1, true) and text ~= "", pet.id)
end

local checked = 0
for _, pet in ipairs(expanded.pets) do
    for level = 1, 3 do
        verify_behavior(pet, assert(skills[pet.id]), level)
        checked = checked + 1
    end
end
assert(checked == 180)

-- Two opening shields delay the defender's first surviving HP loss. Splash
-- still resolves in the lethal strike; a later summon cannot exceed five slots.
local shielded = battle.resolve({
    unit("hedgehog", 11, 2), unit("squirrel", 12), unit("reed_turtle", 13),
}, opponents(1), 23491, expanded)
local defended = assert(trigger_window(shielded, "player:11"))
assert(defended.event.strike == 3 and first_events(defended, "shield", 1)[1].uid == "player:12")
local splash = battle.resolve({unit("tiger", 11, 3, 20, 1), unit("frog", 12, 1, 1, 5)},
    {unit("tiger", 21, 3, 20, 1), unit("frog", 22, 1, 1, 5)}, 91817, expanded)
assert(splash.outcome == "draw")
for _, uid in ipairs({"player:11", "enemy:21"}) do
    assert(first_events(assert(trigger_window(splash, uid)), "damage", 1)[1].amount == 18)
end
local full = battle.resolve({
    unit("toucan", 11, 2, 2, 1), unit("flamingo", 12, 2),
    unit("penguin", 13, 3), unit("frog", 14), unit("frog", 15),
}, opponents(1), 23491, expanded)
local births, boosts = 0, 0
for _, event in ipairs(full.events) do
    if event.strike == 1 and event.type == "summon" then
        assert(event.slot == 1 and event.id == "fledgling" and event.attack == 3 and #event.board.player == 5)
        births = births + 1
    elseif event.strike == 1 and event.type == "buff" then
        assert(event.health == (boosts == 0 and 6 or 9))
        boosts = boosts + 1
    end
end
assert(births == 1 and boosts == 2)

-- Fixed dispersed seeds exercise equal selection over every unlocked tier.
-- Sampling includes both rounds of each tier and checks each individual ID.
local samples = 768
local picks = rng.new(184247)
local counts = {{}, {}, {}, {}, {}, {}}
for _ = 1, samples do
    -- Reserve disjoint spans of the generator for the 60 opening slot draws.
    for _ = 1, 64 do picks:next() end
    local store = shop.new(picks:next(), expanded)
    for round = 1, 12 do
        local state = store:snapshot()
        local tier = (round + 1) // 2
        assert(state.tier == tier and #state.pets == 3 and #state.foods == 2 and state.gold == 10)
        for _, offer in ipairs(state.pets) do
            assert(expanded.pet_by_id[offer.id].tier <= tier and not offer.frozen)
            local tally = counts[tier]
            tally[offer.id] = (tally[offer.id] or 0) + 1
        end
        for _, offer in ipairs(state.foods) do assert(expanded.food_by_id[offer.id].tier <= tier) end
        assert(store:skip_battle() and store:advance_round())
    end
end
for tier, tally in ipairs(counts) do
    local expected = samples * 6 / (tier * 10)
    for _, pet in ipairs(expanded.pets_for_tier(tier)) do
        local frequency = tally[pet.id] or 0
        assert(math.abs(frequency - expected) < 6 * math.sqrt(expected), "Unexpected shop probability for " .. pet.id)
    end
end

local store = shop.new(47, expanded)
local first = store:snapshot().pets[1]
assert(store:freeze("pet", 1, true) and store:reroll())
assert(store:snapshot().gold == 9 and store:snapshot().pets[1].id == first.id)
assert(store:skip_battle() and store:advance_round())
assert(store:snapshot().gold == 10 and store:snapshot().pets[1].id == first.id and store:snapshot().pets[1].frozen)
assert(store:buy(1))
local unit_uid = store:snapshot().team[1].uid
local rewarded = 0
for _ = 1, 18 do
    while store:snapshot().gold >= 3 and store:snapshot().team[1].level < 3 do
        for slot, offer in ipairs(store:snapshot().pets) do
            if offer and offer.id == first.id and store:snapshot().team[1].level < 3 and store:snapshot().gold >= 3 then
                assert(store:combine(slot, 1))
            end
        end
        local state = store:snapshot()
        if state.team[1].level == 3 or state.gold < 3 then break end
        assert(store:reroll())
    end
    local state = store:snapshot()
    for _, reward in ipairs(state.rewards) do
        assert(expanded.pet_by_id[reward.id].tier == math.min(6, state.tier + 1))
        rewarded = rewarded + 1
    end
    if state.team[1].level == 3 then
        assert(state.team[1].uid == unit_uid and state.team[1].xp == 5)
        assert(state.team[1].attack == expanded.pet_by_id[first.id].attack + 5)
        assert(state.team[1].health == expanded.pet_by_id[first.id].health + 5)
        break
    end
    assert(store:skip_battle() and store:advance_round())
end
assert(store:snapshot().team[1].level == 3 and rewarded == 2)

print("expanded content tests passed (60 animals, 180 level behaviors, 7 tokens, 27648 pet offers)")
