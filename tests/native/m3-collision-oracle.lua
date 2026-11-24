package.path = "./src/?.lua;" .. package.path
local battle = require("autopets.battle")
local pairs = {
    {4, 7, 3, 2, 9, 1, 117},
    {2, 6, 1, 2, 6, 1, 15},
    {1, 4, 1, 9, 8, 2, 35},
    {7, 4, 1, 2, 4, 2, 50},
}
if arg[1] == "limit" then
    pairs[#pairs] = {1, 1000, 1, 1, 1000, 1, 50}
end
local function unit(attack, health, level)
    return {id = "reed_turtle", attack = attack, health = health, level = level}
end
local code = {win = 1, loss = 2, draw = 3}
for index, pair in ipairs(pairs) do
    local a, b, c, d, e, f, seed = table.unpack(pair)
    local result = battle.resolve({unit(a, b, c)}, {unit(d, e, f)}, seed)
    local opening, steps, max_strike = nil, {}, 0
    for _, event in ipairs(result.events) do
        if event.strike == 0 then
            opening = event.board or opening
        elseif event.type == "damage" then
            local step = steps[event.strike] or {}
            local target = event.board[event.side][1]
            step[event.side] = {target.health, target.shield, event.amount}
            steps[event.strike] = step
            max_strike = event.strike
        end
    end
    local left, right = opening.player[1], opening.enemy[1]
    local status = result.status == "strike_limit" and 4 or code[result.outcome]
    print("pair", index, left.attack, left.health, left.shield, right.attack, right.health, right.shield, status, max_strike)
    for strike, step in ipairs(steps) do
        local l, r = step.player, step.enemy
        print("step", index, strike, l[1], l[2], l[3], r[1], r[2], r[3])
    end
end
