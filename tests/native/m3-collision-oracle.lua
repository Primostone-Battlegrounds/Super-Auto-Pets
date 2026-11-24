package.path = "./src/?.lua;" .. package.path
local battle = require("autopets.battle")
local data = require("autopets.data")

local function unit(id, attack, health, level)
    return {id = id, attack = attack, health = health, level = level or 1}
end

local turtle = "reed_turtle"
local rabbit = "cottontail_rabbit"
local marmot = "alder_marmot"
local otter = "river_otter"
local sheep = "cloud_sheep"
local teams = {
    {
        {unit(sheep, 5, 2, 3), unit(marmot, 3, 4, 2), unit(turtle, 4, 6), unit(otter, 5, 3, 2), unit(rabbit, 4, 2, 2)},
        {unit(otter, 3, 6, 3), unit("slate_muskdeer", 2, 3, 2), unit(rabbit, 4, 4, 2), unit(turtle, 3, 3), unit(marmot, 2, 3, 3)},
        117,
    },
    {
        {unit(otter, 3, 3, 2), unit(sheep, 4, 4), unit(turtle, 2, 3)},
        {unit(otter, 3, 3, 2), unit(sheep, 4, 4), unit(turtle, 2, 3)},
        15,
    },
    {
        {unit(marmot, 1, 3, 3), unit(turtle, 2, 3), unit(otter, 3, 3)},
        {unit("maple_fox", 6, 7), unit(otter, 5, 6)},
        35,
    },
    {
        {unit(turtle, 8, 4, 2), unit(turtle, 4, 7, 3), unit(turtle, 6, 4)},
        {unit(turtle, 3, 4, 2), unit(turtle, 2, 6, 2)},
        50,
    },
}
if arg[1] == "limit" then
    teams[#teams] = {{unit(turtle, 1, 1000)}, {unit(turtle, 1, 1000)}, 50}
end

local definitions, codes = {}, {}
local function add(definition)
    definitions[#definitions + 1] = definition
    codes[definition.id] = #definitions
end
for _, definition in ipairs(data.pets) do add(definition) end
local tokens = {}
for id in pairs(data.token_by_id) do tokens[#tokens + 1] = id end
table.sort(tokens)
for _, id in ipairs(tokens) do add(data.token_by_id[id]) end

local effects = {buff_front = 1, summon = 2}
for code, definition in ipairs(definitions) do
    local ability = definition.ability
    local effect = ability and ability.trigger == "faint" and assert(effects[ability.effect]) or 0
    local token = effect == 2 and assert(data.token_by_id[ability.token]) or nil
    print("definition", code, definition.id, effect, effect > 0 and ability.power or 0,
        token and codes[token.id] or 0, token and token.attack or 0, token and token.health or 0)
end

local function board_row(board)
    local fields = {}
    for _, team in ipairs({board.player, board.enemy}) do
        fields[#fields + 1] = #team
        for _, pet in ipairs(team) do
            for _, value in ipairs({codes[pet.id], pet.attack, pet.health, pet.max_health, pet.shield, pet.level}) do
                fields[#fields + 1] = value
            end
        end
    end
    return table.unpack(fields)
end

local side = {player = 0, enemy = 1}
local outcome_code = {win = 1, loss = 2, draw = 3}
for index, pair in ipairs(teams) do
    local result = battle.resolve(table.unpack(pair))
    local opening, steps = nil, {}
    for _, event in ipairs(result.events) do
        if event.strike == 0 then
            opening = event.board or opening
        else
            local step = steps[event.strike] or {events = {}}
            step.board = event.board or step.board
            steps[event.strike] = step
            local code = codes[event.id]
            local tracked
            if event.type == "damage" then
                local target = event.board[event.side][event.slot]
                tracked = {event.type, side[event.side], event.amount, target.health, target.shield}
            elseif event.type == "faint" then
                tracked = {event.type, side[event.side], code}
            elseif event.type == "buff" then
                tracked = {event.type, side[event.side], event.amount}
            elseif event.type == "summon" then
                tracked = {event.type, side[event.side], code, event.attack, event.health}
            end
            if tracked then step.events[#step.events + 1] = tracked end
        end
    end
    assert(opening and #opening.player > 0 and #opening.enemy > 0)
    local outcome = result.status == "strike_limit" and 4 or outcome_code[result.outcome]
    print("pair", index, outcome, #steps, side[result.events[1].first_side], board_row(opening))
    for strike, step in ipairs(steps) do
        for _, action in ipairs(step.events) do
            print("event", index, strike, table.unpack(action))
        end
        print("board", index, strike, board_row(step.board))
    end
end
