package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local rng = require("autopets.rng")
local profile = arg[1] or "compatibility"
local data = require(profile == "release" and "autopets.release_data" or "autopets.data")

local definitions, codes = {}, {}
local function add(definition)
    definitions[#definitions + 1] = definition
    codes[definition.id] = #definitions
end
for _, pet in ipairs(data.pets) do add(pet) end
local tokens = {}
for id in pairs(data.token_by_id) do tokens[#tokens + 1] = id end
table.sort(tokens)
for _, id in ipairs(tokens) do add(data.token_by_id[id]) end

local start_effect = {shield_front = 1, hit_random = 2, hit_front = 3, hit_back = 4}
local faint_effect = {buff_front = 1, summon = 2, shield_front = 3}
for _, definition in ipairs(definitions) do
    local ability = definition.ability
    local effect = ability and ability.trigger == "faint" and assert(faint_effect[ability.effect]) or 0
    local token = effect == 2 and assert(data.token_by_id[ability.token]) or nil
    print("def", effect, effect > 0 and ability.power or 0,
        token and codes[token.id] or (effect == 3 and ability.targets or 0),
        token and token.attack or 0, token and token.health or 0)
end

local function unit(id, health, level)
    return {id = id, attack = data.pet_by_id[id].attack, health = health, level = level or 1}
end

local function encode(board, first, strike)
    local fields = {}
    for _, team in ipairs({board.player, board.enemy}) do
        for slot = 1, data.rules.team_size do
            local pet = team[slot]
            local values = pet and {codes[pet.id], pet.attack, pet.health, pet.max_health, pet.shield, pet.level}
                or {0, 0, 0, 0, 0, 0}
            for _, value in ipairs(values) do fields[#fields + 1] = value end
        end
    end
    for _, value in ipairs({#board.player, #board.enemy, 0, 0, first, strike or 0}) do fields[#fields + 1] = value end
    return table.unpack(fields)
end

local side = {player = 0, enemy = 1}
local function test(seed, left, right, record_strikes)
    local resolved = battle.resolve(left, right, seed, data)
    local start = resolved.events[1]
    local first = side[start.first_side]
    local final = start.board
    print("case", seed)
    print("input", encode(start.board, first))
    for _, event in ipairs(resolved.events) do
        if event.strike > 0 then break end
        final = event.board or final
        local amount
        if event.type == "skill" and event.trigger == "start" then
            amount = assert(start_effect[data.pet_by_id[event.id].ability.effect])
        elseif event.type == "damage" or event.type == "shield" or event.type == "buff" then
            amount = event.amount
        elseif event.type == "faint" then
            amount = 0
        elseif event.type == "summon" then
            amount = event.attack
        end
        if amount then
            print("event", event.type, side[event.side], event.slot - 1, codes[event.id], amount)
        end
    end
    print("board", encode(final, first))
    if record_strikes then
        local strikes = {}
        for _, event in ipairs(resolved.events) do
            if event.strike > 0 and event.board then strikes[event.strike] = event.board end
        end
        for strike, board in ipairs(strikes) do print("strike", encode(board, first, strike)) end
        local outcomes = {win = 1, loss = 2, draw = 3}
        print("outcome", resolved.status == "strike_limit" and 4 or outcomes[resolved.outcome])
    end
end

local sweep = {unit("sunset_cat", 4, 3), unit("reed_turtle", 4, 2), unit("ember_swift", 1, 3)}
local opponents = {
    unit("alder_marmot", 1, 3), unit("cloud_sheep", 1, 2), unit("cottontail_rabbit", 1),
    unit("river_otter", 1), unit("maple_fox", 1, 3),
}
test(1922112213, sweep, opponents) -- First target draw rejects the high Park–Miller state.
test(1922112213, opponents, sweep)
test(1, sweep, {})
test(-58, {}, sweep)
test(0, {}, {})
test(-2147483647, {unit("sunset_cat", 3, 2)}, {unit("ember_swift", 1)})
test(2147483647, {unit("sunset_cat", 3, 2)}, {unit("reed_turtle", 1), unit("ember_swift", 2)})
test(math.mininteger, sweep, opponents)
test(math.maxinteger, opponents, sweep)

if profile == "release" then
    local frontline = {unit("cinder_caracal", 10, 3), unit("frost_muskox", 10, 2), unit("night_pangolin", 5, 3)}
    local flank = {unit("moon_yak", 2, 3), unit("fern_quail", 3, 2), unit("tidal_narwhal", 4, 3)}
    test(13, frontline, flank, true)
    test(13, flank, frontline, true)
    test(91, {unit("moon_yak", 2, 3), unit("tidal_narwhal", 2, 2)}, {unit("cloud_sheep", 19, 2)}, true)
end

local fixtures = rng.new(117)
local supported = {}
for _, definition in ipairs(data.pets) do
    local trigger = definition.ability.trigger
    if trigger == "start" or trigger == "faint" then supported[#supported + 1] = definition end
end
local function team()
    local lineup = {}
    for _ = 1, fixtures:int(0, 5) do
        local definition = supported[fixtures:int(1, #supported)]
        lineup[#lineup + 1] = unit(definition.id, fixtures:int(1, 8), fixtures:int(1, 3))
    end
    return lineup
end
for seed = 1, 160 do
    local left, right = team(), team()
    test(seed, left, right)
    test(seed, right, left)
end
