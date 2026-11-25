-- Shared catalog-driven wording for native animal inspection. No gameplay mutation.
local triggers = {start = "开场", faint = "退场", hurt = "首次受伤存活", attack = "出击", summon = "友方召唤"}
local function describe(catalog, pet, level, include_level)
    local skill = assert(pet.ability, "animal ability required")
    level = assert(math.tointeger(level))
    local heading = include_level and string.format("%s · L%d · %s", pet.name, level, skill.name)
        or (pet.name .. " · " .. skill.name)
    local trigger, power = assert(triggers[skill.trigger]), skill.power * level
    local effect
    if skill.effect == "shield_front" then effect = string.format("前排 %d 名队员各获得 %d 盾", skill.targets, power)
    elseif skill.effect == "hit_random" then effect = string.format("随机 %d 名对手各受 %d 伤", skill.targets, power)
    elseif skill.effect == "buff_front" then effect = string.format("前排队员获得 %d 命", power)
    elseif skill.effect == "shield_next" then effect = string.format("身后首位加 %d 盾", power)
    elseif skill.effect == "hit_front" then effect = string.format("对手前排受 %d 伤", power)
    elseif skill.effect == "hit_back" then effect = string.format("对手末位受 %d 伤", power)
    elseif skill.effect == "splash" then effect = string.format("对手第 2 位受 %d 伤", power)
    elseif skill.effect == "rally_summon" then effect = string.format("新单位加 %d 攻和 %d 命", power, power)
    elseif skill.effect == "summon" then
        local token = assert(catalog.token_by_id[skill.token])
        effect = string.format("最多召唤 %d 只%s，%d攻 %d命", skill.power, token.name, token.attack + level - 1, token.health)
    else error("unknown animal effect: " .. tostring(skill.effect)) end
    return heading, trigger .. " · " .. effect
end
return {describe = describe}
