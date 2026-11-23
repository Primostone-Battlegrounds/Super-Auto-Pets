package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local bot = require("autopets.bot")
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
    assert(before.opponent.round == before.round and #before.opponent.team > 0)
    assert(before.opponent.tier == data.tier_for_round(before.round))
    assert(game:submit())
    local replay = game:snapshot()
    assert(replay.phase == "battle" and replay.battle.outcome == outcome)
    assert(replay.battle.round == before.round)
    assert(replay.battle.events[1].type == "start")
    assert(replay.battle.events[#replay.battle.events].outcome == outcome)
    local expected = battle.resolve(before.shop.team, before.opponent.team, replay.battle.seed)
    assert(replay.battle.outcome == expected.outcome)
    assert_same(replay.battle.events, expected.events, "submitted battle against the prepared local opponent")
    assert(replay.wins == before.wins and replay.lives == before.lives)
    assert(before.shop.phase == "preparation" and replay.shop.phase == "battle")
    before.shop.phase = "battle"
    assert_same(replay.shop, before.shop)
    before.shop.phase = "preparation"
    assert_same(replay.opponent, before.opponent)
    reject(game, "wrong_phase", "submit")
    reject(game, "wrong_phase", "advance")
    reject(game, "wrong_phase", "restart", 7)
    reject(game, "wrong_phase", "shop_action", "reroll")

    assert(game:settle())
    local settled = game:snapshot()
    assert(settled.wins == before.wins + (outcome == "win" and 1 or 0))
    assert(settled.lives == before.lives - (outcome == "loss" and 1 or 0))
    assert(settled.round == before.round)
    assert_same(settled.battle, replay.battle)
    assert(settled.shop.phase == "settlement" and settled.shop.last_outcome == outcome)
    assert_same(settled.shop.team, before.shop.team, "settlement retains persistent stats")
    reject(game, "wrong_phase", "settle")
    if settled.phase == "settlement" then
        reject(game, "wrong_phase", "restart", 7)
        assert(game:advance())
        local prepared = game:snapshot()
        assert(prepared.phase == "preparation" and prepared.round == settled.round + 1)
        assert(prepared.shop.gold == rules.gold_per_round)
        assert(prepared.shop.phase == "preparation" and prepared.shop.last_outcome == outcome)
        assert(prepared.wins == settled.wins and prepared.lives == settled.lives and not prepared.battle)
        assert_same(prepared.shop.team, settled.shop.team)
    else
        assert(settled.phase == "ended" and settled.final == outcome)
        reject(game, "wrong_phase", "advance")
        reject(game, "wrong_phase", "submit")
    end
    return {before = before, replay = replay, settled = settled}
end

local seed = 1
local opening = run.new(seed):snapshot()
assert(opening.phase == "preparation" and opening.round == 1)
assert(opening.wins == 0 and opening.lives == rules.start_lives and opening.shop.gold == rules.gold_per_round)
assert(#opening.shop.team == 0 and not opening.final and not opening.battle)

local function feed_all(first, after_roll)
    return {{"feed", first, 1}, {"feed", 3 - first, 1}, {"reroll"}, {"feed", after_roll, 1}}
end

local playbook = {
    {{"buy", 3}, {"buy", 2}, {"buy", 1}},
    {{"buy", 1}, {"buy", 2}, {"feed", 1, 1}},
    feed_all(1, 1),
    feed_all(1, 1),
    feed_all(2, 2),
    feed_all(2, 1),
    feed_all(1, 1),
    feed_all(1, 2),
    feed_all(1, 2),
    feed_all(2, 1),
    feed_all(1, 2),
    feed_all(1, 1),
}
local other_outcomes = {[1] = "draw", [11] = "loss"}

local function play_shop(game, actions)
    for _, action in ipairs(actions) do
        assert(game:shop_action(table.unpack(action)))
    end
end

local function win_game()
    local game = run.new(seed)
    reject(game, "empty_team", "submit")
    reject(game, "wrong_phase", "settle")
    reject(game, "wrong_phase", "advance")
    reject(game, "invalid_seed", "restart", "7")
    reject(game, "unknown_action", "shop_action", "advance_round")
    local rounds = {}
    for round, actions in ipairs(playbook) do
        play_shop(game, actions)
        local trace = assert(game:opponent_trace())
        assert(#trace.rounds == round)
        assert_same(assert(bot.replay(trace)), game:snapshot().opponent, "played opponent's full trajectory")
        rounds[round] = finish_round(game, other_outcomes[round] or "win")
    end
    local finished = game:snapshot()
    assert(finished.phase == "ended" and finished.final == "win")
    assert(finished.wins == rules.wins_to_win and finished.lives == rules.start_lives - 1)
    reject(game, "invalid_seed", "restart", "7")
    assert(game:restart())
    assert_same(game:snapshot(), opening)
    play_shop(game, playbook[1])
    assert_same(finish_round(game, "draw"), rounds[1], "first battle after same-seed restart")
    assert_same(game:snapshot().opponent, rounds[2].before.opponent, "second opponent after same-seed restart")
    return rounds
end

local won_rounds = win_game()
assert_same(won_rounds, win_game(), "same-seed full-game replay")

local drawn = run.new(seed)
play_shop(drawn, {{"buy", 2}, {"buy", 1}, {"buy", 3}})
finish_round(drawn, "draw")

local lost = run.new(seed)
assert(lost:shop_action("buy", 1))
for round = 1, rules.start_lives do
    local transcript = finish_round(lost, "loss")
    assert(transcript.settled.lives == rules.start_lives - round)
    local won = won_rounds[round]
    assert(#transcript.before.shop.team < #won.before.shop.team)
    assert_same(transcript.before.opponent, won.before.opponent,
        "round " .. round .. " local opponent independent of purchases and rerolls")
    assert(transcript.replay.battle.seed == won.replay.battle.seed)
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

local empty_shop = run.new(seed)
for _ = 1, 8 do
    assert(empty_shop:shop_action("reroll"))
end
assert(empty_shop:snapshot().shop.gold == 2)
reject(empty_shop, "insufficient_gold", "shop_action", "buy", 1)
reject(empty_shop, "empty_team", "submit")
assert(empty_shop:restart(-19))
assert_same(empty_shop:snapshot(), run.new(-19):snapshot(), "new attempt after rerolling away buying gold")
assert(empty_shop:shop_action("buy", 1))

local sold_last = run.new(seed)
assert(sold_last:shop_action("buy", 1))
for _ = 1, 6 do
    assert(sold_last:shop_action("reroll"))
end
assert(sold_last:shop_action("sell", 1))
assert(sold_last:snapshot().shop.gold == 2)
reject(sold_last, "insufficient_gold", "shop_action", "buy", 1)
reject(sold_last, "empty_team", "submit")
assert(sold_last:restart())
assert_same(sold_last:snapshot(), opening, "new attempt after selling the last pet")
assert(sold_last:shop_action("buy", 1))

local exhausted = run.new(seed)
assert(exhausted:shop_action("buy", 1))
exhausted.shop.team[1].health = math.maxinteger
exhausted.opponent.team[1].health = math.maxinteger
local prior_rng = exhausted.battle_random.state
reject(exhausted, "strike_limit", "submit")
assert(exhausted.battle_random.state == prior_rng)
assert(exhausted:shop_action("reroll"), "an exhausted battle must reopen the shop without scoring")

print("run tests passed (10 wins, 0 lives, draw, local AI, restart, stalled prep recovery, deterministic replay)")
