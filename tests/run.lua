package.path = "src/?.lua;" .. package.path

local data = require("autopets.data")
local run = require("autopets.run")
local rules = data.rules

local function assert_same(left, right, field)
    field = field or "snapshot"
    if type(left) ~= "table" or type(right) ~= "table" then
        assert(left == right, field .. " changed")
        return
    end
    for key, value in pairs(left) do
        assert_same(value, right[key], field .. "." .. key)
    end
    for key in pairs(right) do
        assert(left[key] ~= nil, field .. " gained " .. key)
    end
end

local function reject(game, expected, action, ...)
    local initial = game:snapshot()
    local ok, detail = game[action](game, ...)
    assert(not ok and detail == expected, action .. " should reject with " .. expected)
    assert_same(game:snapshot(), initial)
end

local function finish_round(game, outcome)
    local before = game:snapshot()
    assert(before.phase == "preparation" and not before.battle)
    assert(game:submit())
    local replay = game:snapshot()
    assert(replay.phase == "battle" and replay.battle.outcome == outcome)
    assert(replay.battle.round == before.round)
    assert(replay.battle.events[1].type == "start")
    assert(replay.battle.events[#replay.battle.events].outcome == outcome)
    assert(replay.wins == before.wins and replay.lives == before.lives)
    assert_same(replay.shop, before.shop)
    assert_same(replay.opponent, before.opponent)
    reject(game, "wrong_phase", "submit")
    reject(game, "wrong_phase", "advance")
    reject(game, "wrong_phase", "shop_action", "reroll")

    assert(game:settle())
    local settled = game:snapshot()
    assert(settled.wins == before.wins + (outcome == "win" and 1 or 0))
    assert(settled.lives == before.lives - (outcome == "loss" and 1 or 0))
    assert(settled.round == before.round)
    assert_same(settled.battle, replay.battle)
    reject(game, "wrong_phase", "settle")
    if settled.phase == "settlement" then
        assert(game:advance())
        local prepared = game:snapshot()
        assert(prepared.phase == "preparation" and prepared.round == settled.round + 1)
        assert(prepared.shop.gold == rules.gold_per_round)
        assert(prepared.wins == settled.wins and prepared.lives == settled.lives and not prepared.battle)
        assert_same(prepared.shop.team, settled.shop.team)
    else
        assert(settled.phase == "ended" and settled.final == outcome)
        reject(game, "wrong_phase", "advance")
        reject(game, "wrong_phase", "submit")
    end
    return {before = before, replay = replay, settled = settled}
end

local seed = 7
local opening = run.new(seed):snapshot()
assert(opening.phase == "preparation" and opening.round == 1)
assert(opening.wins == 0 and opening.lives == rules.start_lives and opening.shop.gold == rules.gold_per_round)
assert(#opening.shop.team == 0 and not opening.final and not opening.battle)

local feed_all = {{"feed", 1, 1}, {"feed", 2, 1}, {"reroll"}, {"feed", 1, 1}}
local function combine_and_feed(offer)
    return {{"combine", offer, 1}, {"feed", 1, 1}, {"feed", 2, 1}}
end

local playbook = {
    {{"buy", 1}, {"buy", 2, 1}, {"move", 2, 1}, {"feed", 1, 2}, {"freeze", "pet", 3}, {"reroll"}},
    {{"buy", 1}, {"buy", 2}, {"buy", 3}, {"move", 2, 1}},
    feed_all,
    combine_and_feed(1),
    feed_all,
    combine_and_feed(3),
    feed_all,
    feed_all,
    combine_and_feed(3),
    feed_all,
    feed_all,
}

local function win_game()
    local game = run.new(seed)
    reject(game, "empty_team", "submit")
    reject(game, "wrong_phase", "settle")
    reject(game, "wrong_phase", "advance")
    reject(game, "wrong_phase", "restart")
    reject(game, "unknown_action", "shop_action", "advance_round")
    local rounds = {}
    for round, actions in ipairs(playbook) do
        for _, action in ipairs(actions) do
            assert(game:shop_action(table.unpack(action)))
        end
        rounds[round] = finish_round(game, round == 7 and "draw" or "win")
        if round == 1 then
            local held = game:snapshot().shop.pets[3]
            assert(held.frozen and held.id == opening.shop.pets[3].id)
        end
    end
    local finished = game:snapshot()
    assert(finished.phase == "ended" and finished.final == "win")
    assert(finished.wins == rules.wins_to_win and finished.lives == rules.start_lives)
    reject(game, "invalid_seed", "restart", "7")
    assert(game:restart())
    assert_same(game:snapshot(), opening)
    return rounds
end

assert_same(win_game(), win_game(), "same-seed full-game replay")

local lost = run.new(seed)
assert(lost:shop_action("buy", 1))
for round = 1, rules.start_lives do
    local transcript = finish_round(lost, "loss")
    assert(transcript.settled.lives == rules.start_lives - round)
end
local defeated = lost:snapshot()
assert(defeated.phase == "ended" and defeated.final == "loss" and defeated.lives == 0 and defeated.wins == 0)
assert(lost:restart(-19))
assert_same(lost:snapshot(), run.new(-19):snapshot())
assert(lost:snapshot().seed ~= seed)

local first, second = run.new(seed), run.new(seed)
assert(first:shop_action("buy", 1) and second:shop_action("buy", 1))
assert(first:shop_action("reroll"))
assert(first:submit() and second:submit())
assert_same(first:snapshot().battle, second:snapshot().battle, "battle independent of shop RNG draws")
local detached = first:snapshot()
detached.opponent.team[1].health = 0
detached.battle.events[1].type = "edited"
assert_same(first:snapshot().opponent, second:snapshot().opponent)
assert_same(first:snapshot().battle, second:snapshot().battle)
assert(first:settle() and second:settle())
assert(first:advance() and second:advance())
assert_same(first:snapshot().opponent, second:snapshot().opponent, "bot independent of shop RNG draws")

print("run tests passed (10 wins, 0 lives, draw, restart, deterministic replay)")
