package.path = "src/?.lua;" .. package.path

local profile = arg[1] or "compatibility"
assert(profile == "compatibility" or profile == "release", "unknown native battle profile")
local data = require(profile == "release" and "autopets.release_data" or "autopets.data")
local definitions, codes = {}, {}
for _, pet in ipairs(data.pets) do
    definitions[#definitions + 1] = pet
    codes[pet.id] = #definitions
end
local tokens = {}
for id in pairs(data.token_by_id) do tokens[#tokens + 1] = id end
table.sort(tokens)
for _, id in ipairs(tokens) do
    definitions[#definitions + 1] = data.token_by_id[id]
    codes[id] = #definitions
end

local starts = {shield_front = 1, hit_random = 2, hit_front = 3, hit_back = 4}
local faints = {buff_front = 1, summon = 2, shield_front = 3}
for _, pet in ipairs(definitions) do
    local ability = pet.ability
    local start = ability and ability.trigger == "start" and assert(starts[ability.effect]) or 0
    local faint = ability and ability.trigger == "faint" and assert(faints[ability.effect]) or 0
    local token = faint == 2 and assert(data.token_by_id[ability.token]) or nil
    print(pet.id, start, start > 0 and ability.power or 0, start > 0 and (ability.targets or 1) or 0,
        faint, faint > 0 and ability.power or 0, token and codes[token.id] or (faint == 3 and ability.targets or 0),
        token and token.attack or 0, token and token.health or 0)
end
