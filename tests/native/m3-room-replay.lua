package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local data = require("autopets.catalog")(arg[2] or "compatibility")
local outcomes = {win = 1, loss = 2, draw = 3}
local codes, tokens = {}, {}
for code, pet in ipairs(data.pets) do codes[pet.id] = code end
for id in pairs(data.token_by_id) do tokens[#tokens + 1] = id end
table.sort(tokens)
for code, id in ipairs(tokens) do codes[id] = #data.pets + code end

local function numbers(list)
    local unpacked = {}
    for value in list:gmatch("[^,]+") do unpacked[#unpacked + 1] = assert(math.tointeger(tonumber(value))) end
    return unpacked
end

local function formation(list)
    local raw, team = numbers(list), {}
    assert(#raw == 1 + raw[1] * 6)
    for at = 2, #raw, 6 do
        team[#team + 1] = {id = data.pets[raw[at]].id, uid = raw[at + 1], attack = raw[at + 2],
            health = raw[at + 3], level = raw[at + 4]}
    end
    return team
end

local checked = 0
for row in io.lines(assert(arg[1])) do
    local round, seed, outcome, first, second, packed = row:match("^([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)$")
    local result = battle.resolve(formation(first), formation(second), assert(math.tointeger(tonumber(seed))), data)
    local final, native = result.events[#result.events], numbers(packed)
    local description = "round " .. round .. ", seed " .. seed
    assert((result.status == "strike_limit" and 4 or outcomes[result.outcome]) == tonumber(outcome), description)
    assert(#native == 66 and native[66] == final.strike, description)
    assert(native[65] == (result.events[1].first_side == "player" and 0 or 1), description)
    for side, name in ipairs({"player", "enemy"}) do
        local team = final.board[name]
        assert(#team == native[60 + side], description)
        for slot, unit in ipairs(team) do
            local at = ((side - 1) * 5 + (native[62 + side] + slot - 1) % 5) * 6 + 1
            local fields = {codes[unit.id], unit.attack, unit.health, unit.max_health, unit.shield, unit.level}
            for offset, field in ipairs(fields) do assert(native[at + offset - 1] == field, description) end
        end
    end
    checked = checked + 1
end
assert(checked > 0)
print(checked .. " native receipts match authoritative Lua terminal boards and outcomes")

if arg[3] then
    local bot = require("autopets.bot")
    local weights = bot.style_weights()
    local moves = 0
    for row in io.lines(arg[3]) do
        if #row > 0 then
            local seat, from, to, packed = row:match("^(%d+)\t(%d+)\t(%d+)\t(.+)$")
            local style = weights[tonumber(seat) % #weights + 1].style
            local snapshot = {phase = "preparation", team = formation(packed), gold = 0, pets = {}, foods = {}, rewards = {}}
            local move = assert(bot.choose_action(snapshot, style, 0, "beginner", data))
            assert(move.action == "move" and move.from == tonumber(from) and move.to == tonumber(to), style)
            moves = moves + 1
        end
    end
    print(moves .. " native placements match shared Lua beginner front-slot decisions")
end
