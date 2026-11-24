-- The native multiplayer graphs send the same packed private shop state.
local function decode(raw, rules)
    local team_start = 7 + rules.pet_slots + rules.food_slots
    local reward_start = team_start + rules.team_size * 6
    if #raw < reward_start - 1 then return nil end
    local view = {round = raw[1], tier = raw[2], gold = raw[3], pets = {}, foods = {}, team = {}, rewards = {}}
    local at = 7
    for slot = 1, rules.pet_slots do
        view.pets[slot] = raw[at]
        at = at + 1
    end
    for slot = 1, rules.food_slots do
        view.foods[slot] = raw[at]
        at = at + 1
    end
    for slot = 1, math.min(raw[6], rules.team_size) do
        view.team[slot] = {code = raw[at], uid = raw[at + 1], attack = raw[at + 2], health = raw[at + 3],
            level = raw[at + 4], xp = raw[at + 5]}
        at = at + 6
    end
    for index = reward_start, #raw do view.rewards[#view.rewards + 1] = raw[index] end
    return view
end

return decode
