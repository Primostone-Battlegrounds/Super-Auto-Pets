local release = require("autopets.release_data")

local data = {}
data.rules_hash = "sha256:b0f023c4aac68429b2199b10c00d8d3635b1e9a0cf7c6ed57583dbf9ad2fb0d9"

local pet_names = {
    reed_turtle = "乌龟", ember_swift = "雨燕", cottontail_rabbit = "兔子",
    alder_marmot = "旱獭", maple_fox = "狐狸", river_otter = "水獭",
    slate_muskdeer = "麝", sunset_cat = "猫咪", cloud_sheep = "绵羊",
    dawn_tapir = "貘", cinder_caracal = "狞猫", fern_quail = "鹌鹑",
    moon_yak = "牦牛", storm_kestrel = "红隼", mist_crane = "白鹤",
    frost_muskox = "麝牛", night_pangolin = "穿山甲", tidal_narwhal = "独角鲸",
}
local food_names = {
    dew_berry = "浆果", sun_seed = "葵花籽", stone_jelly = "果冻", glow_bun = "蜂蜜点心",
    wind_rice = "米饭", golden_reed = "谷物汤", clear_plum = "青梅", fennel_twist = "茴香卷",
    honeyed_taro = "芋块", pearl_broth = "甜汤", winter_roselle = "洛神花", night_orchard = "水果拼盘",
}
local token_names = {lambkin = "小羊", fern_chick = "小鹌鹑", tidal_calf = "小独角鲸"}

local function pet(id, name, attack, health, style, trigger, effect, power, ability_name, options)
    local ability = options or {}
    ability.trigger, ability.effect, ability.power, ability.name = trigger, effect, power, ability_name
    return {id = id, name = name, attack = attack, health = health, style = style, ability = ability}
end

local additions = {
    {
        pet("hamster", "仓鼠", 1, 3, "guardian", "faint", "buff_front", 2, "余粮"),
        pet("chick", "小鸡", 1, 2, "swarm", "faint", "summon", 1, "结窝", {token = "nestling"}),
        pet("hedgehog", "刺猬", 2, 2, "guardian", "hurt", "shield_next", 2, "刺壳掩护"),
        pet("sparrow", "麻雀", 2, 2, "swarm", "summon", "rally_summon", 1, "振翅应援"),
        pet("frog", "青蛙", 2, 3, "striker", "attack", "splash", 1, "跳水"),
        pet("mouse", "小鼠", 1, 4, "striker", "start", "hit_back", 1, "绕路偷袭"),
        pet("gecko", "壁虎", 3, 1, "striker", "start", "hit_front", 1, "伏击"),
    },
    {
        pet("squirrel", "松鼠", 2, 4, "guardian", "start", "shield_front", 1, "备冬", {targets = 2}),
        pet("badger", "獾", 3, 4, "striker", "attack", "splash", 2, "刨地"),
        pet("beaver", "河狸", 2, 5, "guardian", "hurt", "shield_next", 3, "护堤"),
        pet("raccoon", "浣熊", 4, 3, "striker", "start", "hit_back", 2, "趁隙"),
        pet("robin", "知更鸟", 2, 4, "swarm", "faint", "summon", 1, "旧巢", {token = "fledgling"}),
        pet("duckling", "小鸭", 2, 3, "swarm", "summon", "rally_summon", 1, "列队"),
        pet("chameleon", "变色龙", 2, 4, "guardian", "faint", "buff_front", 3, "断尾掩护"),
    },
    {
        pet("red_panda", "小熊猫", 3, 5, "guardian", "faint", "shield_front", 2, "竹林退守", {targets = 2}),
        pet("donkey", "驴", 4, 5, "guardian", "hurt", "shield_next", 4, "挡路"),
        pet("penguin", "企鹅", 3, 6, "swarm", "summon", "rally_summon", 1, "抱团保暖"),
        pet("alpaca", "羊驼", 4, 4, "guardian", "start", "shield_front", 2, "厚绒", {targets = 3}),
        pet("platypus", "鸭嘴兽", 5, 4, "striker", "attack", "splash", 2, "拨水"),
        pet("lemur", "狐猴", 5, 3, "striker", "start", "hit_back", 3, "纵枝"),
        pet("barn_owl", "仓鸮", 3, 5, "swarm", "faint", "summon", 2, "巢群接力", {token = "nestling"}),
    },
    {
        pet("boar", "野猪", 6, 5, "striker", "attack", "splash", 3, "冲林"),
        pet("porcupine", "豪猪", 4, 7, "guardian", "hurt", "shield_next", 5, "立刺护卫"),
        pet("sea_lion", "海狮", 5, 6, "guardian", "faint", "buff_front", 5, "潮岸接应"),
        pet("toucan", "巨嘴鸟", 4, 5, "swarm", "faint", "summon", 2, "树洞留巢", {token = "fledgling"}),
        pet("koala", "考拉", 3, 8, "guardian", "start", "shield_front", 2, "桉叶屏障", {targets = 4}),
        pet("flamingo", "火烈鸟", 4, 5, "swarm", "summon", "rally_summon", 2, "浅滩育雏"),
        pet("giraffe", "长颈鹿", 5, 5, "striker", "start", "hit_back", 4, "越阵挥颈"),
    },
    {
        pet("elephant", "大象", 5, 10, "guardian", "faint", "buff_front", 7, "象群接替"),
        pet("snow_leopard", "雪豹", 8, 4, "striker", "start", "hit_random", 3, "雪岩扑击", {targets = 2}),
        pet("crocodile", "鳄鱼", 6, 6, "striker", "attack", "splash", 4, "翻身摆尾"),
        pet("kangaroo", "袋鼠", 6, 6, "guardian", "faint", "shield_front", 4, "落地挡护", {targets = 2}),
        pet("brown_bear", "棕熊", 6, 9, "guardian", "hurt", "shield_next", 6, "背身护卫"),
        pet("bison", "野牛", 6, 9, "striker", "start", "hit_front", 5, "领群冲锋"),
        pet("octopus", "章鱼", 4, 7, "swarm", "summon", "rally_summon", 2, "护卵"),
    },
    {
        pet("rhinoceros", "犀牛", 8, 9, "guardian", "faint", "buff_front", 10, "守住缺口"),
        pet("hippo", "河马", 7, 12, "guardian", "hurt", "shield_next", 8, "浅滩掩护"),
        pet("tiger", "老虎", 10, 6, "striker", "attack", "splash", 6, "横扫"),
        pet("orca", "虎鲸", 9, 8, "striker", "start", "hit_front", 7, "破浪突袭"),
        pet("gorilla", "大猩猩", 6, 11, "guardian", "start", "shield_front", 3, "群体戒备", {targets = 4}),
        pet("giant_panda", "大熊猫", 6, 11, "guardian", "faint", "shield_front", 4, "竹丛守势", {targets = 3}),
        pet("blue_whale", "蓝鲸", 8, 11, "striker", "start", "hit_random", 3, "鲸鸣震荡", {targets = 3}),
    },
}

local function copy(entry)
    local result = {}
    for key, value in pairs(entry) do result[key] = value end
    return result
end

data.rules = copy(release.rules)
data.rules.tier_unlock_rounds = {table.unpack(release.rules.tier_unlock_rounds)}
data.rules.level_xp = {table.unpack(release.rules.level_xp)}

data.pets, data.pet_by_id = {}, {}
local pets_by_tier = {}
for tier, added in ipairs(additions) do
    local existing = release.pets_at_tier(tier)
    local entries = {}
    for _, base in ipairs(existing) do
        local definition = copy(base)
        definition.name = assert(pet_names[base.id], base.id)
        definition.ability = copy(base.ability)
        entries[#entries + 1] = definition
    end
    for _, definition in ipairs(added) do entries[#entries + 1] = definition end
    for _, definition in ipairs(entries) do
        definition.tier = tier
        data.pets[#data.pets + 1] = definition
        data.pet_by_id[definition.id] = definition
    end
    pets_by_tier[tier] = entries
end

data.foods, data.food_by_id = {}, {}
for index, base in ipairs(release.foods) do
    local definition = copy(base)
    definition.name = assert(food_names[base.id], base.id)
    data.foods[index], data.food_by_id[definition.id] = definition, definition
end

data.token_by_id = {
    nestling = {id = "nestling", name = "雏鸟", attack = 1, health = 1},
    fledgling = {id = "fledgling", name = "幼鸟", attack = 2, health = 2},
}
for id, base in pairs(release.token_by_id) do
    local definition = copy(base)
    definition.name = token_names[id] or definition.name
    data.token_by_id[id] = definition
end

function data.pets_for_tier(max_tier)
    local list = {}
    for _, definition in ipairs(data.pets) do
        if definition.tier > max_tier then break end
        list[#list + 1] = definition
    end
    return list
end

function data.pets_at_tier(tier)
    return {table.unpack(pets_by_tier[tier] or {})}
end

function data.foods_for_tier(max_tier)
    local list = {}
    for _, definition in ipairs(data.foods) do
        if definition.tier <= max_tier then list[#list + 1] = definition end
    end
    return list
end

data.tier_for_round = release.tier_for_round

return data
