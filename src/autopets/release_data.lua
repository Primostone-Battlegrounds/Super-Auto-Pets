local compatibility = require("autopets.data")

local data = {}
data.rules_hash = "sha256:2e93dc19535f9247920974acd4d84816fa4dbace3a92a10e8a3fc0ebecf3f567"

data.rules = {}
for key, value in pairs(compatibility.rules) do
    data.rules[key] = value
end
data.rules.max_tier = 6
data.rules.tier_unlock_rounds = {1, 3, 5, 7, 9, 11}

local released_pets = {
    {
        id = "dawn_tapir", name = "晨斑貘", tier = 4, attack = 4, health = 8, style = "guardian",
        ability = {trigger = "hurt", effect = "shield_next", power = 3, name = "晨雾掩护"},
    },
    {
        id = "cinder_caracal", name = "烬耳狞猫", tier = 4, attack = 7, health = 4, style = "striker",
        ability = {trigger = "start", effect = "hit_front", power = 3, name = "烬影踏"},
    },
    {
        id = "fern_quail", name = "卷蕨鹌鹑", tier = 4, attack = 4, health = 5, style = "swarm",
        ability = {trigger = "faint", effect = "summon", power = 2, token = "fern_chick", name = "蕨丛藏雏"},
    },
    {
        id = "moon_yak", name = "月鬃牦牛", tier = 5, attack = 5, health = 11, style = "guardian",
        ability = {trigger = "faint", effect = "shield_front", power = 3, targets = 2, name = "月鬃留影"},
    },
    {
        id = "storm_kestrel", name = "雨锋红隼", tier = 5, attack = 8, health = 5, style = "striker",
        ability = {trigger = "attack", effect = "splash", power = 3, name = "掠雨剪"},
    },
    {
        id = "mist_crane", name = "雾翎白鹤", tier = 5, attack = 5, health = 7, style = "swarm",
        ability = {trigger = "summon", effect = "rally_summon", power = 1, name = "引翎"},
    },
    {
        id = "frost_muskox", name = "霜环麝牛", tier = 6, attack = 7, health = 12, style = "guardian",
        ability = {trigger = "start", effect = "shield_front", power = 3, targets = 3, name = "结霜列阵"},
    },
    {
        id = "night_pangolin", name = "夜鳞穿山甲", tier = 6, attack = 9, health = 7, style = "striker",
        ability = {trigger = "start", effect = "hit_back", power = 5, name = "夜潜尾击"},
    },
    {
        id = "tidal_narwhal", name = "汐角鲸", tier = 6, attack = 7, health = 9, style = "swarm",
        ability = {trigger = "faint", effect = "summon", power = 2, token = "tidal_calf", name = "随潮破水"},
    },
}

local released_foods = {
    {id = "clear_plum", name = "清露梅", tier = 4, attack = 2, health = 3},
    {id = "fennel_twist", name = "茴香卷", tier = 4, attack = 2, health = 1, adjacent_attack = 1},
    {id = "honeyed_taro", name = "蜜芋块", tier = 5, attack = 3, health = 3},
    {id = "pearl_broth", name = "珠穗汤", tier = 5, attack = 1, health = 3, adjacent_health = 1},
    {id = "winter_roselle", name = "霜洛神", tier = 6, attack = 4, health = 3},
    {id = "night_orchard", name = "星果盘", tier = 6, attack = 2, health = 3, adjacent_attack = 1, adjacent_health = 1},
}

data.token_by_id = {
    fern_chick = {id = "fern_chick", name = "蕨羽雏", attack = 2, health = 2},
    tidal_calf = {id = "tidal_calf", name = "潮角幼鲸", attack = 4, health = 3},
}
for id, token in pairs(compatibility.token_by_id) do
    data.token_by_id[id] = token
end

local function extend(base, extra)
    local list, by_id = {}, {}
    for _, entries in ipairs({base, extra}) do
        for _, entry in ipairs(entries) do
            list[#list + 1] = entry
            by_id[entry.id] = entry
        end
    end
    return list, by_id
end

data.pets, data.pet_by_id = extend(compatibility.pets, released_pets)
data.foods, data.food_by_id = extend(compatibility.foods, released_foods)

local function filter(entries, first_tier, last_tier)
    local list = {}
    for _, entry in ipairs(entries) do
        if entry.tier >= first_tier and entry.tier <= last_tier then
            list[#list + 1] = entry
        end
    end
    return list
end

function data.pets_for_tier(max_tier)
    return filter(data.pets, 1, max_tier)
end

function data.foods_for_tier(max_tier)
    return filter(data.foods, 1, max_tier)
end

function data.pets_at_tier(tier)
    return filter(data.pets, tier, tier)
end

function data.tier_for_round(round)
    local tier = data.rules.max_tier
    while tier > 1 and round < data.rules.tier_unlock_rounds[tier] do
        tier = tier - 1
    end
    return tier
end

return data
