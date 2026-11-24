package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local profile = arg[1] or "compatibility"
assert(profile == "compatibility" or profile == "release")
local data = require(profile == "release" and "autopets.release_data" or "autopets.data")

local function team(line)
    local fields, result = {}, {}
    for value in line:gmatch("-?%d+") do fields[#fields + 1] = assert(tonumber(value)) end
    assert(#fields % 5 == 0)
    for offset = 1, #fields, 5 do
        result[#result + 1] = {id = data.pets[fields[offset]].id, uid = fields[offset + 1], attack = fields[offset + 2],
            health = fields[offset + 3], level = fields[offset + 4]}
    end
    return result
end

local seed = assert(tonumber(io.read("*l")))
local left, right = team(io.read("*l")), team(io.read("*l"))
local result = battle.resolve(left, right, seed, data)
local outcomes = {win = 1, loss = 2, draw = 3}
assert(result.status == "resolved")
print(assert(outcomes[result.outcome]))
local codes, tokens = {}, {}
for code, definition in ipairs(data.pets) do codes[definition.id] = code end
for id in pairs(data.token_by_id) do tokens[#tokens + 1] = id end
table.sort(tokens)
for code, id in ipairs(tokens) do codes[id] = #data.pets + code end
local board = result.events[#result.events].board
for _, side in ipairs({"player", "enemy"}) do
    local fields = {}
    for _, unit in ipairs(board[side]) do
        for _, field in ipairs({codes[unit.id], unit.attack, unit.health, unit.max_health, unit.shield, unit.level}) do
            fields[#fields + 1] = field
        end
    end
    print(table.concat(fields, " "))
end
local advanced_skills = {}
for _, event in ipairs(result.events) do
    local definition = data.pet_by_id[event.id]
    if event.type == "skill" and definition and definition.tier >= 4 then
        advanced_skills[#advanced_skills + 1] = event.id
    end
end
print(table.concat(advanced_skills, " "))
