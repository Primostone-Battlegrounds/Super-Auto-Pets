package.path = "src/?.lua;" .. package.path

local bot = require("autopets.bot")
local data = require("autopets.data")
local rules = data.rules
local styles = {"guardian", "striker", "swarm"}
local support_styles = {guardian = "striker", striker = "guardian", swarm = "striker"}

local function fingerprint(opponent)
    local entries = {opponent.round, opponent.style, opponent.tier}
    for _, unit in ipairs(opponent.team) do
        entries[#entries + 1] = table.concat({unit.id, unit.attack, unit.health, unit.level, unit.xp}, "/")
    end
    return table.concat(entries, ",")
end

local function verify(team, round, style)
    assert(team.round == round and team.tier == data.tier_for_round(round) and team.style == style)
    assert(#team.team >= 2 and #team.team <= rules.team_size)
    local signature = false
    local support = false
    local strength = 0
    for _, unit in ipairs(team.team) do
        local pet = assert(data.pet_by_id[unit.id])
        assert(pet.tier <= team.tier, "locked pet in bot team")
        assert(unit.attack >= pet.attack and unit.health >= pet.health)
        assert(math.type(unit.level) == "integer" and unit.level >= 1 and unit.level <= rules.max_level)
        assert(unit.xp == rules.level_xp[unit.level])
        if pet.style == style and pet.tier == team.tier then
            signature = true
        end
        if pet.style == support_styles[style] then
            support = true
        end
        strength = strength + unit.attack + unit.health + 2 * (unit.level - 1)
    end
    assert(signature, "bot missing a pet of its chosen style at the unlocked tier")
    assert(team.tier == 1 or support, "bot missing a complementary pet after the starting tier")
    return strength
end

local rounds = {1, 3, 5, 8, 12, 20}
for _, style in ipairs(styles) do
    local previous_total = 0
    for _, round in ipairs(rounds) do
        local total = 0
        local fingerprints = {}
        for seed = -15, 16 do
            local team = bot.generate(round, seed, style)
            total = total + verify(team, round, style)
            local key = fingerprint(team)
            assert(key == fingerprint(bot.generate(round, seed, style)), "seed does not reproduce bot team")
            fingerprints[key] = true
        end
        assert(total > previous_total, "mean sample strength did not increase for " .. style)
        local first = next(fingerprints)
        assert(first and next(fingerprints, first), "sampled seeds must vary the team")
        previous_total = total
    end
end

local seen = {}
for seed = 1, 20 do
    local team = bot.generate(1, seed)
    seen[team.style] = true
    assert(fingerprint(team) == fingerprint(bot.generate(1, seed)))
end
for _, style in ipairs(styles) do
    assert(seen[style], "default generation did not choose " .. style)
end
assert(#bot.generate(1, 17, "swarm").team > #bot.generate(1, 17, "guardian").team)
assert(#bot.generate(30, 17, "striker").team == rules.team_size)

local function style_bonus(style, round)
    local attack, health = 0, 0
    for _, unit in ipairs(bot.generate(round, 17, style).team) do
        local pet = data.pet_by_id[unit.id]
        attack = attack + unit.attack - pet.attack
        health = health + unit.health - pet.health
    end
    return attack, health
end

local guardian_attack, guardian_health = style_bonus("guardian", 10)
local striker_attack, striker_health = style_bonus("striker", 10)
assert(guardian_health > guardian_attack and striker_attack > striker_health)
for _, style in ipairs(styles) do
    local first_attack, first_health = style_bonus(style, 1)
    local early_attack, early_health = style_bonus(style, 2)
    local late_attack, late_health = style_bonus(style, 13)
    local capped_attack, capped_health = style_bonus(style, 30)
    assert(first_attack + first_health == 0 and early_attack + early_health == 1)
    assert(late_attack + late_health > 50, "late opponents must scale past early shop stats")
    assert(late_attack + late_health == capped_attack + capped_health, "late stat budget must remain bounded")
end
assert(not pcall(bot.generate, 0, 17))
assert(not pcall(bot.generate, 1, 17, "unknown"))
assert(not pcall(bot.generate, 1, "bad seed"))

print("bot tests passed")
