local data = {}

data.rules = {
    team_size = 5,
    start_lives = 5,
    wins_to_win = 10,
    gold_per_round = 10,
    reroll_cost = 1,
    pet_cost = 3,
    food_cost = 3,
    max_level = 3,
    max_tier = 3,
    pet_shop_slots = 3,
    food_shop_slots = 2,
    tier_unlock_rounds = {1, 3, 5},
    level_xp = {0, 2, 5},
    merge_attack = 1,
    merge_health = 1,
    sell_gold_per_level = 1,
    level_reward_tier_offset = 1,
}

data.pets = {
    {
        id = "reed_turtle", name = "芦纹龟", tier = 1, attack = 1, health = 4, style = "guardian",
        ability = {trigger = "start", effect = "shield_front", power = 1, targets = 1, name = "芦盾"},
    },
    {
        id = "ember_swift", name = "烟尾雨燕", tier = 1, attack = 2, health = 2, style = "striker",
        ability = {trigger = "start", effect = "hit_random", power = 1, targets = 1, name = "烟羽"},
    },
    {
        id = "cottontail_rabbit", name = "棉尾兔", tier = 1, attack = 2, health = 1, style = "swarm",
        ability = {trigger = "faint", effect = "summon", power = 1, token = "rabbit_kit", name = "兔窝接力"},
    },
    {
        id = "alder_marmot", name = "赤桤旱獭", tier = 2, attack = 2, health = 5, style = "guardian",
        ability = {trigger = "faint", effect = "buff_front", power = 2, name = "筑垒"},
    },
    {
        id = "maple_fox", name = "枫耳小狐", tier = 2, attack = 4, health = 2, style = "striker",
        ability = {trigger = "start", effect = "hit_random", power = 2, targets = 1, name = "枫尾先声"},
    },
    {
        id = "river_otter", name = "河岸水獭", tier = 2, attack = 3, health = 3, style = "swarm",
        ability = {trigger = "faint", effect = "summon", power = 1, token = "otter_pup", name = "水獭结伴"},
    },
    {
        id = "slate_muskdeer", name = "岩釉麝", tier = 3, attack = 3, health = 7, style = "guardian",
        ability = {trigger = "start", effect = "shield_front", power = 2, targets = 2, name = "岩衣"},
    },
    {
        id = "sunset_cat", name = "暖霞猫", tier = 3, attack = 5, health = 3, style = "striker",
        ability = {trigger = "start", effect = "hit_random", power = 2, targets = 2, name = "猫步突袭"},
    },
    {
        id = "cloud_sheep", name = "卷云绵羊", tier = 3, attack = 4, health = 4, style = "swarm",
        ability = {trigger = "faint", effect = "summon", power = 2, token = "lambkin", name = "绵羊小队"},
    },
}

data.foods = {
    {id = "dew_berry", name = "朝露莓", tier = 1, attack = 1, health = 1},
    {id = "sun_seed", name = "向阳籽", tier = 1, attack = 2, health = 0},
    {id = "stone_jelly", name = "石乳冻", tier = 2, attack = 0, health = 3},
    {id = "glow_bun", name = "萤蜜团", tier = 2, attack = 2, health = 1},
    {id = "wind_rice", name = "风露饭", tier = 3, attack = 2, health = 2},
    {id = "golden_reed", name = "金穗羹", tier = 3, attack = 1, health = 3},
}

data.token_by_id = {
    rabbit_kit = {id = "rabbit_kit", name = "兔宝宝", attack = 1, health = 1},
    otter_pup = {id = "otter_pup", name = "水獭宝宝", attack = 2, health = 1},
    lambkin = {id = "lambkin", name = "卷毛小羊", attack = 1, health = 2},
}

local function by_id(catalog)
    local index = {}
    for _, definition in ipairs(catalog) do
        index[definition.id] = definition
    end
    return index
end

data.pet_by_id = by_id(data.pets)
data.food_by_id = by_id(data.foods)

local function filter_tiers(catalog, min_tier, max_tier)
    local result = {}
    for _, definition in ipairs(catalog) do
        if definition.tier >= min_tier and definition.tier <= max_tier then
            result[#result + 1] = definition
        end
    end
    return result
end

function data.pets_for_tier(max_tier)
    return filter_tiers(data.pets, 1, max_tier)
end

function data.foods_for_tier(max_tier)
    return filter_tiers(data.foods, 1, max_tier)
end

function data.pets_at_tier(tier)
    return filter_tiers(data.pets, tier, tier)
end

function data.tier_for_round(round)
    local tier = data.rules.max_tier
    while tier > 1 and round < data.rules.tier_unlock_rounds[tier] do
        tier = tier - 1
    end
    return tier
end

return data
