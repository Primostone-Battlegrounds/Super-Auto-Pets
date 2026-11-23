local data = require("autopets.data")
local rng = require("autopets.rng")

local bot = {}
local styles = {"guardian", "striker", "swarm"}
local support_style = {guardian = "striker", striker = "guardian", swarm = "striker"}

local function style_pool(pool, style)
    local matches = {}
    for _, pet in ipairs(pool) do
        if pet.style == style then
            matches[#matches + 1] = pet
        end
    end
    return #matches > 0 and matches or pool
end

local function priority(pet, style)
    if style == "guardian" then
        return pet.health * 2 + pet.attack
    elseif style == "striker" then
        return pet.attack * 2 + pet.health
    end
    return pet.attack + pet.health
end

local function attack_bonus(bonus, style)
    if style == "guardian" then
        return bonus // 3
    elseif style == "striker" then
        return bonus - bonus // 3
    end
    return bonus // 2
end

function bot.generate(round, seed, requested_style)
    assert(math.type(round) == "integer" and round > 0, "round must be a positive integer")
    local random = rng.new(seed)
    local style = requested_style
    if style == nil then
        style = styles[random:int(1, #styles)]
    end
    assert(style == "guardian" or style == "striker" or style == "swarm", "unknown bot style")

    local rules = data.rules
    local tier = data.tier_for_round(round)
    local size = math.min(rules.team_size, 2 + round // 2 + (style == "swarm" and 1 or 0))
    local available = data.pets_for_tier(tier)
    local preferred = style_pool(available, style)
    local signature = style_pool(data.pets_at_tier(tier), style)
    local lineup = {}
    for index = 1, size do
        local pool = preferred
        if index == 1 then
            pool = signature
        elseif index == 2 and tier > 1 then
            pool = style_pool(available, support_style[style])
        elseif random:int(1, 4) == 1 then
            pool = available
        end
        lineup[index] = {pet = pool[random:int(1, #pool)], order = index}
    end
    table.sort(lineup, function(left, right)
        if style == "swarm" then
            local left_summons, right_summons = left.pet.style == "swarm", right.pet.style == "swarm"
            if left_summons ~= right_summons then
                return left_summons
            end
        end
        local a, b = priority(left.pet, style), priority(right.pet, style)
        if a == b then
            return left.order < right.order
        end
        return a > b
    end)

    -- Early rounds mostly recruit. Higher shop tiers let complete teams invest in more permanent stats.
    local high_tier_round = rules.tier_unlock_rounds[rules.max_tier]
    local early_growth = math.max(0, math.min(round, high_tier_round) - 2) * 3 + math.min(1, round - 1)
    local late_growth = math.min(8, math.max(0, round - high_tier_round)) * 7
    local bonus_budget = early_growth + late_growth
    local front_bonus = style ~= "swarm" and bonus_budget // 3 or 0
    local shared_budget = bonus_budget - front_bonus
    local team = {}
    for index, slot in ipairs(lineup) do
        local pet = slot.pet
        local bonus = (shared_budget + size - index) // size
        if index == 1 then
            bonus = bonus + front_bonus
        end
        local attack = attack_bonus(bonus, style)
        local level = 1
        if round >= 10 + (index - 1) * 3 then
            level = 3
        elseif round >= 4 + (index - 1) * 2 then
            level = 2
        end
        team[index] = {
            id = pet.id,
            attack = pet.attack + attack,
            health = pet.health + bonus - attack,
            level = level,
            xp = rules.level_xp[level],
        }
    end
    return {round = round, style = style, tier = tier, team = team}
end

return bot
