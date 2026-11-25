package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local bot = require("autopets.bot")
local data = require("autopets.data")
local release = require("autopets.release_data")
local shop = require("autopets.shop")

local function same(expected, actual)
    if type(expected) ~= "table" then
        return expected == actual
    end
    if type(actual) ~= "table" then return false end
    for key, value in pairs(expected) do
        if not same(value, actual[key]) then return false end
    end
    for key in pairs(actual) do
        if expected[key] == nil then return false end
    end
    return true
end

-- The simulator's Lua VM lacks string.pack. Its trace must still replay on the native Lua path.
local pack = string.pack
string.pack = nil
local portable_bot = assert(loadfile("src/autopets/bot.lua"))()
string.pack = pack
local native_pool = bot.new_pool(8, "guardian", "beginner", release)
local portable_pool = portable_bot.new_pool(8, "guardian", "beginner", release)
assert(bot.advance_to_round(native_pool, 5, math.maxinteger))
assert(portable_bot.advance_to_round(portable_pool, 5, math.maxinteger))
assert(same(bot.trace(native_pool), portable_bot.trace(portable_pool)), "portable training changed the canonical trace")

local styles = {"guardian", "striker", "swarm"}
local actions_seen = {}
local styles_seen = {}
local rosters_seen = {}
local function inspect(trace, snapshot, round, catalog)
    catalog = catalog or data
    local rules = catalog.rules
    assert(trace.rules_hash == catalog.rules_hash and #trace.rounds == round)
    assert(#trace.sessions == 2 and trace.sessions[1].shop_seed ~= trace.sessions[2].shop_seed)
    assert(snapshot.round == round and snapshot.tier == catalog.tier_for_round(round))
    assert(snapshot.style == trace.sessions[trace.selected].style)
    assert(same(snapshot.team, trace.rounds[round].sessions[trace.selected].finished.team))
    local opponent, err, detail = bot.replay(trace, catalog)
    assert(opponent, tostring(err) .. ": " .. tostring(detail))
    assert(same(opponent, snapshot))

    for index, frame in ipairs(trace.rounds) do
        assert(frame.round == index)
        for side, entry in ipairs(frame.sessions) do
            local opened = entry.opened
            assert(opened.phase == "preparation" and opened.round == index and opened.gold == rules.gold_per_round)
            assert(math.type(opened.rng_state) == "integer")
            if index == 1 then
                assert(#opened.team == 0 and opened.last_outcome == nil)
            else
                local previous = trace.rounds[index - 1].training.settled[side]
                assert(opened.last_outcome == previous.last_outcome and same(opened.team, previous.team))
            end
            local gold = opened.gold
            for _, transition in ipairs(entry.commands) do
                local name = transition.command.action
                actions_seen[name] = true
                assert(transition.gold_before == gold and transition.gold_after >= 0)
                gold = transition.gold_after
                if name == "buy" or name == "combine" then
                    assert(gold == transition.gold_before - rules.pet_cost)
                elseif name == "feed" then
                    assert(gold == transition.gold_before - rules.food_cost)
                elseif name == "reroll" then
                    assert(gold == transition.gold_before - rules.reroll_cost)
                elseif name == "sell" then
                    assert(gold > transition.gold_before)
                else
                    assert(gold == transition.gold_before)
                end
            end
            local finished, known_uid = entry.finished, {}
            assert(finished.phase == "battle" and finished.gold == gold and #finished.team > 0)
            assert(#finished.team <= rules.team_size and math.type(finished.rng_state) == "integer")
            for _, unit in ipairs(finished.team) do
                local pet = assert(catalog.pet_by_id[unit.id])
                assert(math.type(unit.uid) == "integer" and not known_uid[unit.uid])
                known_uid[unit.uid] = true
                assert(pet.tier <= math.min(rules.max_tier, finished.tier + rules.level_reward_tier_offset))
                assert(unit.attack >= pet.attack and unit.health >= pet.health)
                assert(unit.xp >= rules.level_xp[unit.level])
                assert(unit.level == rules.max_level or unit.xp < rules.level_xp[unit.level + 1])
            end
        end
        if index < round then
            local left, right = frame.sessions[1].finished.team, frame.sessions[2].finished.team
            local verified = battle.resolve(left, right, frame.training.result.seed, catalog)
            for _, field in ipairs({"seed", "status", "outcome", "rng_state"}) do
                assert(verified[field] == frame.training.result[field])
            end
            assert(frame.training.result.event_count == #verified.events)
            assert(frame.training.result.reason == verified.events[#verified.events].reason)
            assert(frame.training.result.event_digest:match("^%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x$"))
            assert(frame.training.result.events == nil)
            local player, enemy = frame.training.settled[1], frame.training.settled[2]
            assert(player.phase == "settlement" and enemy.phase == "settlement")
            local mirror = {win = "loss", loss = "win", draw = "draw"}
            assert(player.last_outcome == verified.outcome and enemy.last_outcome == mirror[verified.outcome])
            assert(same(player.team, left) and same(enemy.team, right))
        else
            assert(frame.training == nil)
        end
    end
end

for seed = 1, 24 do
    local style = styles[seed % #styles + 1]
    local pool = bot.new_pool(seed)
    assert(bot.advance_to_round(pool, 12, 512))
    local snapshot = bot.snapshot(pool)
    inspect(bot.trace(pool), snapshot, 12)
    styles_seen[snapshot.style] = true
    local lineup = {}
    for slot, unit in ipairs(snapshot.team) do lineup[slot] = unit.id end
    rosters_seen[table.concat(lineup, "/")] = true
    assert(bot.generate(12, seed, style).style == style)
end
for _, action in ipairs({"buy", "sell", "combine", "merge", "move", "feed", "freeze", "reroll"}) do
    assert(actions_seen[action], "sample did not exercise " .. action)
end
for _, style in ipairs(styles) do
    assert(styles_seen[style], "default seeds did not use " .. style)
end
local distinct = 0
for _ in pairs(rosters_seen) do distinct = distinct + 1 end
assert(distinct >= 12, "sampled lineup variety has regressed")

local single, sliced = bot.new_pool(-17, "swarm"), bot.new_pool(-17, "swarm")
assert(bot.snapshot(sliced) == nil and bot.trace(sliced) == nil)
assert(not bot.advance_to_round(sliced, 1, 0))
while not bot.advance_to_round(sliced, 1, 1) do end
local before_advance = bot.trace(sliced)
assert(not bot.advance_to_round(sliced, 7, 1))
assert(same(bot.trace(sliced), before_advance), "preparation must keep prior ready checkpoint stable")
assert(bot.advance_to_round(single, 7, 512))
while not bot.advance_to_round(sliced, 7, 1) do end
assert(same(bot.trace(single), bot.trace(sliced)), "budget slicing changed training")
assert(same(bot.snapshot(single), bot.generate(7, -17, "swarm")))
local exposed = bot.snapshot(sliced)
exposed.team[1].attack = exposed.team[1].attack + 1
assert(not same(exposed, bot.snapshot(sliced)), "snapshot aliases the pooled ready state")

local function reject(mutator)
    local trace = bot.trace(single)
    mutator(trace)
    local result, reason = bot.replay(trace)
    assert(result == nil and reason == "invalid_trace", tostring(reason))
end

reject(function(trace) trace.selected = 3 end)
reject(function(trace) trace.rounds[1].sessions[1].commands[1].command.offer = 99 end)
reject(function(trace) table.remove(trace.rounds[1].sessions[1].commands, 1) end)
reject(function(trace) trace.rounds[1].sessions[1].commands[1].gold_after = 99 end)
reject(function(trace) trace.rounds[2].sessions[2].opened.rng_state = 0 end)
reject(function(trace) trace.rounds[2].training.result.outcome = "fake" end)
reject(function(trace) trace.rounds[3].training.result.rng_state = 0 end)
reject(function(trace) trace.rounds[4].training.result.event_count = 999 end)
reject(function(trace) trace.rounds[4].training.result.event_digest = "0000000000000000" end)
reject(function(trace) trace.rounds[7].sessions[trace.selected].finished.team[1].attack = 999 end)
local digest_fixture = bot.new_pool(1, "swarm")
assert(bot.advance_to_round(digest_fixture, 2, 64))
local first_training = bot.trace(digest_fixture).rounds[1].training.result
assert(first_training.event_count == 48 and first_training.event_digest == "e6b2ec74c3ad5ef5")

local standard = bot.new_pool(-17, "swarm", "standard")
assert(bot.advance_to_round(standard, 7, 512))
assert(same(bot.trace(standard), bot.trace(single)), "explicit standard changed the default trace")
for _, style in ipairs(styles) do
    local beginner = bot.new_pool(-17, style, "beginner")
    assert(bot.advance_to_round(beginner, 7, 512))
    local beginner_trace = assert(bot.trace(beginner))
    local snapshot = assert(bot.snapshot(beginner))
    assert(beginner_trace.difficulty == "beginner")
    inspect(beginner_trace, snapshot, 7)
    assert(same(snapshot, bot.generate(7, -17, style, "beginner")))
    assert(not same(snapshot, bot.generate(7, -17, style, "standard")))
    beginner_trace.difficulty = nil
    local result, reason = bot.replay(beginner_trace)
    assert(result == nil and reason == "invalid_trace", tostring(reason))
end

local different_rules = bot.trace(single)
different_rules.rules_hash = "different"
local _, version_error = bot.replay(different_rules)
assert(version_error == "trace_version_mismatch")
assert(not pcall(bot.generate, 0, 17))
assert(not pcall(bot.generate, 1, 17, "unknown"))
assert(not pcall(bot.generate, 1, 17, "guardian", "unknown"))
assert(not pcall(bot.generate, 1, "bad seed"))

-- An eight-seat host can execute decisions against its own shop without a training pool.
local store = shop.new(31, release)
local baseline = store:snapshot()
assert(#baseline.team == 0)
local state = store:snapshot()
local opening_command = assert(bot.choose_action(state, "swarm", 0, "standard", release))
assert(same(state, baseline), "choosing a command writes to the supplied snapshot")
assert(same(opening_command, bot.choose_action(state, "swarm", 0, "standard", release)))
assert(store:apply(opening_command))
assert(#store:finish_turn() == 1)
local finished_command, finished_reason = bot.choose_action(store:snapshot(), "swarm", 1, "standard", release)
assert(finished_command == nil and finished_reason == "wrong_phase")

local function unit(id)
    local pet = release.pet_by_id[id]
    return {id = id, attack = pet.attack, health = pet.health, level = 1, xp = 0}
end
local synergistic = {
    phase = "preparation", round = 12, tier = 6, gold = release.rules.food_cost,
    team = {unit("mist_crane"), unit("tidal_narwhal"), unit("fern_quail")},
    pets = {false, false, false}, rewards = {},
    foods = {{id = "night_orchard", frozen = false}, false},
}
local feed = assert(bot.choose_action(synergistic, "swarm", 0, "standard", release))
assert(feed.action == "feed" and feed.offer == 1 and feed.target == 2, "adjacent food reaches two neighbors")
synergistic.gold = 0
local moves = 0
while true do
    local move, stop = bot.choose_action(synergistic, "swarm", moves, "standard", release)
    if not move then
        assert(stop == "priorities_exhausted")
        break
    end
    assert(move.action == "move")
    local pet = table.remove(synergistic.team, move.from)
    table.insert(synergistic.team, move.to, pet)
    moves = moves + 1
end
assert(moves > 0 and synergistic.team[3].id == "mist_crane", "summon supporter stays behind both summoners")

local reached_high_tier = false
for _, style in ipairs(styles) do
    for _, difficulty in ipairs({"standard", "beginner"}) do
        local pool = bot.new_pool(31, style, difficulty, release)
        while not bot.advance_to_round(pool, 12, 13) do end
        local trace, snapshot = assert(bot.trace(pool)), assert(bot.snapshot(pool))
        inspect(trace, snapshot, 12, release)
        assert(same(snapshot, bot.generate(12, 31, style, difficulty, release)))
        local wrong_catalog, mismatch = bot.replay(trace)
        assert(wrong_catalog == nil and mismatch == "trace_version_mismatch")
        for _, unit in ipairs(snapshot.team) do
            reached_high_tier = reached_high_tier or release.pet_by_id[unit.id].tier == release.rules.max_tier
        end
    end
end
assert(reached_high_tier, "release sample did not reach tier 6")

print("bot tests passed")
