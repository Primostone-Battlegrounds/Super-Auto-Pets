local animal_ability = require("autopets.animal_ability")

local presentation = {}
-- The default native CJK face lacks dedicated dice glyphs. Compose the
-- visible pips from supported characters and keep the number on every badge.
local dice = {"·", ":", "∴", "∷", "∷·", "∷:"}

function presentation.tier(item)
    local tier = type(item) == "table" and item.tier or item
    return dice[tier] and (dice[tier] .. " " .. tier .. "阶") or nil
end

function presentation.level(unit, thresholds)
    local level = unit.level
    local caption = "Lv." .. level
    if not thresholds or unit.xp == nil then return caption end
    local next_level = thresholds[level + 1]
    if not next_level then return caption .. " 满级" end
    local current_level = thresholds[level]
    local filled = math.max(0, math.min(next_level - current_level, unit.xp - current_level))
    return caption .. " " .. string.rep("■", filled) .. string.rep("□", next_level - current_level - filled)
end

function presentation.animal(catalog, item, unit)
    local level = unit and unit.level or 1
    local heading, body = animal_ability.describe(catalog, item, level, true, true)
    return heading .. " · " .. presentation.tier(item), body
end

function presentation.food(item)
    local heading = item.name .. " · " .. presentation.tier(item)
    local effect = string.format("目标获得 +%d攻 +%d命", item.attack, item.health)
    if item.adjacent_attack or item.adjacent_health then
        effect = effect .. string.format("，相邻队员 +%d攻 +%d命", item.adjacent_attack or 0, item.adjacent_health or 0)
    end
    return heading, "喂食时 · " .. effect
end

function presentation.level_up(before, after, catalog)
    if not before or before.round ~= after.round then return end
    for _, unit in ipairs(after.team) do
        for _, previous in ipairs(before.team) do
            if unit.uid == previous.uid and unit.level > previous.level then
                local item = unit.code and catalog.pets[unit.code] or catalog.pet_by_id[unit.id]
                local reward = #after.rewards > #before.rewards and " · 有升级奖励" or ""
                return item.name .. " 升至 Lv." .. unit.level .. reward
            end
        end
    end
end

return presentation
