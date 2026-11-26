package.path = "src/?.lua;" .. package.path

local catalog = require("autopets.release_data")
local presentation = require("autopets.pet_presentation")
local run = require("autopets.run")
local wire_input = dofile("platform/shop-input.lua")
local rules = catalog.rules
local game = run.new(8, "standard", catalog)

local function action(name, ...)
    assert(game:shop_action(name, ...))
    return game:snapshot().shop
end

local function next_round()
    assert(game:submit())
    assert(game:settle())
    assert(game:advance())
end

local function turtle(position, level, experience, gold)
    local shop = game:snapshot().shop
    local unit = assert(shop.team[position])
    assert(unit.id == "reed_turtle" and unit.level == level and unit.xp == experience)
    assert(shop.gold == gold)
    return unit, shop
end

local opening = game:snapshot().shop
assert(opening.pets[1].id == "reed_turtle" and opening.pets[2].id == "reed_turtle")
action("buy", 1)
local base = turtle(1, 1, 0, 7)
action("buy", 2)
local before = turtle(2, 1, 0, 4)
assert(base.uid ~= before.uid)
action("merge", 2, 1)
local merged, combined = turtle(1, 1, 1, 4)
assert(#combined.team == 1 and merged.uid == base.uid)
assert(merged.attack == base.attack + rules.merge_attack and merged.health == base.health + rules.merge_health)
assert(presentation.level(merged, rules.level_xp) == "Lv.1 ▰▱")

next_round()
action("reroll")
local previous = game:snapshot().shop
assert(previous.pets[1].id == "reed_turtle")
action("combine", 1, 1)
local level_two, upgraded = turtle(1, 2, 2, 6)
assert(presentation.level(level_two, rules.level_xp) == "Lv.2 ▱▱▱")
assert(#upgraded.rewards == 1 and presentation.tier(catalog.pet_by_id[upgraded.rewards[1].id]) == "⚁ 2阶")
assert(presentation.level_up(previous, upgraded, catalog) == "芦纹龟 升至 Lv.2 · 有升级奖励")
action("reroll")
action("combine", 1, 1)
assert(presentation.level(turtle(1, 2, 3, 2), rules.level_xp) == "Lv.2 ▰▱▱")

next_round()
action("reroll")
action("reroll")
action("combine", 2, 1)
assert(presentation.level(turtle(1, 2, 4, 5), rules.level_xp) == "Lv.2 ▰▰▱")
action("reroll")
action("reroll")
action("combine", 3, 1)
local full, final = turtle(1, 3, 5, 0)
assert(full.attack == base.attack + 5 * rules.merge_attack and full.health == base.health + 5 * rules.merge_health)
assert(presentation.level(full, rules.level_xp) == "Lv.3 满级")
assert(#final.rewards == 1 and presentation.tier(catalog.pet_by_id[final.rewards[1].id]) == "⚂ 3阶")
assert(presentation.level({level = 2}, rules.level_xp) == "Lv.2")

local heading, effect = presentation.animal(catalog, catalog.pet_by_id.reed_turtle, level_two)
assert(heading:find("Lv.2", 1, true) and heading:find("⚀ 1阶", 1, true))
assert(effect:find("战斗开始时", 1, true) and effect:find("2 盾", 1, true))
for tier = 1, rules.max_tier do
    assert(presentation.tier(tier):find(" " .. tier .. "阶", 1, true))
    assert(presentation.tier(catalog.pets_at_tier(tier)[1]) == presentation.tier(tier))
end
for _, food in ipairs(catalog.foods) do
    local title, description = presentation.food(food)
    assert(title:find(presentation.tier(food), 1, true) and description:find("喂食时", 1, true))
end

local native_rules = {team_size = 5, max_level = rules.max_level, pet_cost = rules.pet_cost, food_cost = rules.food_cost}
local market = {gold = 3, pets = {1, 2, 0}, foods = {1, 0}, rewards = {},
    team = {{code = 1, level = 1}, {code = 1, level = 2}, {code = 2, level = 1}, {code = 3, level = 1}, {code = 2, level = 1}}}
assert(wire_input.plan(market, native_rules, "pet", 1, 1)[1] == 12, "a full team can still combine")
assert(wire_input.plan(market, native_rules, "team", 1, 2)[1] == 15, "matching teammates combine without a mode toggle")
assert(wire_input.plan(market, native_rules, "team", 1, 3)[1] == 14, "different species move without a merge")
assert(not wire_input.plan(market, native_rules, "team", 1, 3, true), "explicit different-species merge must fail")
assert(not wire_input.plan(market, native_rules, "pet", 2, 1), "different species cannot be bought into a full team")
market.team[1].level = rules.max_level
assert(not wire_input.plan(market, native_rules, "pet", 1, 1), "a maxed target cannot combine")
market.team[1].level, market.gold = 1, 2
assert(not wire_input.plan(market, native_rules, "pet", 1, 1), "an unaffordable combine cannot be sent")
assert(market.gold == 2 and #market.team == 5 and market.pets[1] == 1, "planning cannot modify the shop")

print("Release pet presentation and seed 8 turtle progression: two merges, XP transitions, rewards, tiers and rejected plans verified.")
