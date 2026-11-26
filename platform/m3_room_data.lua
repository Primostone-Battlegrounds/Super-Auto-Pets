package.path = "src/?.lua;" .. package.path
local profile = arg[2] or "compatibility"
local compatibility = require("autopets.data")
local data = require("autopets.catalog")(profile)
local bot = require("autopets.bot")
local rng = require("autopets.rng")
local room = require("autopets.room")
local versus = require("autopets.versus")

local seed = assert(math.tointeger(tonumber(arg[1])), "seed must be an integer")
local match = room.new(seed, {wait_ms = 0, catalog = data})
local settings = room.new(seed, {catalog = data})
print("config", "WAIT", settings.wait_ms // 1000)
print("config", "PREPARE", settings.preparation_ms // 1000)
print("config", "SETTLE", settings.settlement_ms // 1000)
print("config", "MAX_TIME", settings.match_ms // 1000)
print("config", "MAX_ROUNDS", settings.max_rounds)
print("config", "STARTING_LIVES", settings.starting_lives)
print("config", "RECOVERY", 15)
print("config", "COMPATIBILITY_TIER", compatibility.rules.max_tier)
print("config", "EARLY_PET_LIMIT", #data.pets_for_tier(compatibility.rules.max_tier))
for index, weight in ipairs(bot.style_weights()) do print("weight", index, weight.attack, weight.health) end
if profile == "expanded" then
    local affinities = {}
    for index, pet in ipairs(data.pets) do affinities[index] = bot.native_front_affinity(pet.ability) end
    print("front", table.unpack(affinities))
end
print("random", match.pairing_random.state, match.battle_random.state)
assert(match:join("fixture", 0))
for seat = 1, #match.seats do
    local shop_seed = rng.new(versus.stream_seed(seed, 0x53484f50 + seat)).state
    print("seat", seat, shop_seed, match.seats[seat].tie_break - 1)
end

for _, pet in ipairs(data.pets) do print("pet", pet.id, pet.name) end
local tokens = {}
for id in pairs(data.token_by_id) do tokens[#tokens + 1] = id end
table.sort(tokens)
for _, id in ipairs(tokens) do print("pet", id, data.token_by_id[id].name) end
