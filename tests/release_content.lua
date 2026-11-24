package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local compatibility = require("autopets.data")
local release = require("autopets.release_data")
local shop = require("autopets.shop")

local function equal(a, b)
    if type(a) ~= "table" or type(b) ~= "table" then
        return a == b
    end
    for key, value in pairs(a) do
        if not equal(value, b[key]) then return false end
    end
    for key in pairs(b) do
        if a[key] == nil then return false end
    end
    return true
end

local function unit(id, attack, health, level)
    return {id = id, attack = attack, health = health, level = level or 1}
end

local function resolve(player, enemy)
    return battle.resolve(player, enemy, 1, release)
end

local function events(result, kind, strike, id)
    local selected = {}
    for index, event in ipairs(result.events) do
        if event.type == kind and (not strike or event.strike == strike) and (not id or event.id == id) then
            selected[#selected + 1] = {index = index, event = event}
        end
    end
    return selected
end

local function advance(store, catalog)
    local team = assert(store:finish_turn())
    assert(store:record_battle(battle.resolve(team, {}, 1, catalog), "player"))
    assert(store:advance_round())
end

assert(#release.pets == 18 and #release.foods == 12)
assert(release.rules_hash:match("^sha256:%x+$") and #release.rules_hash == 71)
assert(release.rules_hash ~= compatibility.rules_hash and compatibility.rules.max_tier == 3)
local ids = {}
local function check_entry(entry)
    assert(entry.id:match("^[a-z][a-z_]+$") and not ids[entry.id], entry.id)
    ids[entry.id] = true
    assert(entry.name ~= "" and math.type(entry.attack) == "integer" and entry.attack >= 0)
    assert(math.type(entry.health) == "integer" and entry.health >= 0)
end
for _, pet in ipairs(release.pets) do
    check_entry(pet)
    assert(release.pet_by_id[pet.id] == pet and pet.attack > 0 and pet.health > 0)
    if pet.ability.token then assert(release.token_by_id[pet.ability.token]) end
end
for _, food in ipairs(release.foods) do
    check_entry(food)
    assert(release.food_by_id[food.id] == food and food.attack + food.health > 0)
end
for id, token in pairs(release.token_by_id) do
    check_entry(token)
    assert(token.id == id and not release.pet_by_id[id])
end
for tier, round in ipairs({1, 3, 5, 7, 9, 11}) do
    assert(release.tier_for_round(round) == tier and release.tier_for_round(round + 1) == tier)
    assert(#release.pets_for_tier(tier) == tier * 3 and #release.foods_for_tier(tier) == tier * 2)
    local styles = {}
    for _, pet in ipairs(release.pets_at_tier(tier)) do
        assert(pet.tier == tier and not styles[pet.style])
        styles[pet.style] = true
    end
    assert(styles.swarm and styles.guardian and styles.striker)
end

local observed = {}
for seed = 1, 64 do
    local release_store, legacy_store = shop.new(seed, release), shop.new(seed)
    for round = 1, 14 do
        local state = release_store:snapshot()
        if round < 7 then assert(equal(state, legacy_store:snapshot())) end
        assert(state.round == round and state.tier == release.tier_for_round(round))
        for index, shelf in ipairs({state.pets, state.foods}) do
            local by_id = index == 1 and release.pet_by_id or release.food_by_id
            for _, offer in ipairs(shelf) do
                assert(by_id[offer.id].tier <= state.tier)
                observed[offer.id] = true
            end
        end
        advance(release_store, release)
        if round < 7 then advance(legacy_store) end
    end
end
for _, entry in ipairs(release.pets) do assert(observed[entry.id], entry.id) end
for _, entry in ipairs(release.foods) do assert(observed[entry.id], entry.id) end

-- A frozen first-tier copy can deliver a next-tier reward before that tier opens.
for round, reward_tier in pairs({[5] = 4, [7] = 5, [9] = 6, [11] = 6}) do
    local store = shop.new(6, release)
    assert(store:buy(1) and store:combine(2, 1) and store:freeze("pet", 3, true))
    local uid = store:snapshot().team[1].uid
    for _ = 2, round do advance(store, release) end
    assert(store:combine(3, 1))
    local state = store:snapshot()
    assert(state.team[1].level == 2 and state.team[1].uid == uid and #state.rewards == 1)
    assert(release.pet_by_id[state.rewards[1].id].tier == reward_tier)
    assert(store:buy(1, 2, true) and #store:snapshot().rewards == 0)
    advance(store, release)
end

local function food_shop()
    local store = shop.new(17, release)
    for slot = 1, 3 do assert(store:buy(slot)) end
    advance(store, release)
    assert(store:buy(1))
    for _ = 3, 11 do advance(store, release) end
    assert(store:snapshot().foods[1].id == "night_orchard")
    return store
end

for _, target in ipairs({2, 4}) do
    local store = food_shop()
    assert(store:move(4, 2))
    local before = store:snapshot()
    local ok, reason = store:feed(1, 5)
    assert(not ok and reason == "invalid_position" and equal(store:snapshot(), before))
    assert(store:feed(1, target))
    local after = store:snapshot()
    assert(not after.foods[1] and after.gold == before.gold - release.rules.food_cost)
    for slot, original in ipairs(before.team) do
        local distance = math.abs(slot - target)
        assert(after.team[slot].uid == original.uid)
        assert(after.team[slot].attack == original.attack + (distance == 0 and 2 or distance == 1 and 1 or 0))
        assert(after.team[slot].health == original.health + (distance == 0 and 3 or distance == 1 and 1 or 0))
    end
end

for level = 1, 3 do
    local front, back = unit("alder_marmot", 1, 30), unit("moon_yak", 1, 30)
    local flank = {unit("cinder_caracal", 2, 20, level), unit("night_pangolin", 2, 20, level)}
    local aim = resolve(flank, {front, back})
    local hits = events(aim, "damage", 0)
    assert(#hits == 2 and hits[1].event.id == front.id and hits[1].event.amount == 3 * level)
    assert(hits[2].event.id == back.id and hits[2].event.amount == 5 * level)
    assert(equal(aim, resolve(flank, {front, back})))
    assert(not pcall(battle.resolve, flank, {front, back}, 1))

    local witness = unit("mist_crane", 1, 30, level)
    local attack = {unit("alder_marmot", 1, 40)}
    local hurt = resolve({unit("dawn_tapir", 1, 12, level), witness}, attack)
    local uses = events(hurt, "skill", nil, "dawn_tapir")
    assert(#uses == 1 and uses[1].event.trigger == "hurt" and uses[1].event.strike == 1)
    local shield = events(hurt, "shield", 1)[1].event
    assert(shield.id == witness.id and shield.amount == 3 * level)
    local killed = resolve({unit("dawn_tapir", 1, 1, level), witness}, attack)
    assert(#events(killed, "skill", nil, "dawn_tapir") == 0)

    local frost = unit("frost_muskox", 1, 30, level)
    local covered = resolve({unit("dawn_tapir", 1, 12), frost, witness, front}, attack)
    assert(#events(covered, "shield", 0) == 3)
    local damage = events(covered, "damage", 1, "dawn_tapir")[1].event
    assert(damage.amount == 0 and damage.absorbed == 1)
    assert(events(covered, "skill", nil, "dawn_tapir")[1].event.strike == 3 * level + 1)

    local bird = unit("storm_kestrel", 8, 1, level)
    local splash = resolve({bird, unit("dawn_tapir", 1, 3)}, {bird, unit("dawn_tapir", 1, 3)})
    local batch, faints = events(splash, "damage", 1), events(splash, "faint", 1)
    assert(splash.outcome == "draw" and #batch == 4 and #faints == 4)
    assert(batch[3].event.amount == 3 * level and batch[4].event.amount == 3 * level)
    assert(faints[1].index > batch[4].index and #events(splash, "skill", 1, "dawn_tapir") == 0)

    local yak = unit("moon_yak", 1, 1, level)
    local memorial = resolve({yak, witness, front, back}, attack)
    local shields = events(memorial, "shield", 1)
    assert(#shields == 2 and shields[1].event.slot == 1 and shields[1].event.id == witness.id)
    assert(shields[2].event.slot == 2 and shields[2].event.amount == 3 * level)

    for source, token in pairs({fern_quail = "fern_chick", tidal_narwhal = "tidal_calf"}) do
        local summon = resolve({unit(source, 1, 1, level), witness}, attack)
        local births, buffs = events(summon, "summon", 1), events(summon, "buff", 1)
        assert(#births == 2 and #buffs == 2)
        for index, birth in ipairs(births) do
            local buff = buffs[index]
            assert(birth.event.slot == index and birth.event.id == token and birth.index < buff.index)
            assert(birth.event.attack == release.token_by_id[token].attack + level - 1)
            assert(buff.event.uid == birth.event.uid and buff.event.attack_amount == level)
            assert(buff.event.board.player[index].health == release.token_by_id[token].health + level)
        end
        assert(events(summon, "skill", 1, witness.id)[2].event.slot == 3)
        assert(witness.attack == 1 and witness.health == 30)
        local full = resolve({unit(source, 1, 1, level), witness, front, back, front}, attack)
        assert(#events(full, "summon", 1) == 1 and #events(full, "buff", 1) == 1)
    end
end

print("release content tests passed (18 pets, 12 foods, 6 tiers, levels, timing and adjacency)")
