package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local catalog = require("autopets.release_data")
local replay = require("autopets.replay_view")

local function pet(id, attack, health)
    return {id = id, attack = attack, health = health, level = 1}
end

local function run(name, player, enemy, seed, outcome)
    local result = battle.resolve(player, enemy, seed, catalog)
    assert(result.outcome == outcome and result.events[#result.events].outcome == outcome)
    local stream = {}
    for index, original in ipairs(result.events) do
        local event = replay.event(result.events, index, catalog)
        assert(original.health_loss == nil and original.source_ability == nil and original.shifts == nil)
        local board = assert(replay.board(result.events, index))
        local primary, target = replay.cues(event, board)
        local description = replay.describe(event, catalog)
        for _, point in pairs({primary, target}) do
            assert(board[point.side][point.slot] and point.label ~= "")
        end
        stream[#stream + 1] = {event = event, board = board, description = description, primary = primary, target = target}
        if arg[1] == "--trace" then
            print(name, seed, index, event.type, description, primary and primary.label, target and target.label)
        end
    end
    return stream
end

local function find(stream, kind, predicate)
    for index, frame in ipairs(stream) do
        if frame.event.type == kind and (not predicate or predicate(frame.event)) then return frame, index end
    end
    error("missing " .. kind .. " event")
end

local turtle, swift = pet("reed_turtle", 5, 8), pet("ember_swift", 1, 4)
local victory = run("victory", {turtle}, {swift}, 42, "win")
local grant = find(victory, "shield")
local strike = find(victory, "attack")
assert(grant.event.source_uid == grant.event.uid and grant.event.source_ability == "芦盾")
assert(grant.primary.kind == "shield" and grant.board.player[1].shield == 1)
assert(strike.primary.kind == "attack" and strike.target.kind == "target")
assert(strike.primary.side ~= strike.target.side)
local knockout = find(victory, "damage", function(event) return event.health == 0 end)
assert(knockout.event.amount == 5 and knockout.event.health_loss == 4)
assert(knockout.primary.label == "-4" and knockout.description:find("-4命", 1, true))
assert(knockout.board[knockout.event.side][knockout.event.slot].health == 0)

local draw = run("draw", {pet("reed_turtle", 1, 1)}, {pet("ember_swift", 1, 1)}, 1, "draw")
local block = find(draw, "damage", function(event) return event.amount == 0 end)
assert(block.event.absorbed == 1 and block.event.health_loss == 0 and block.event.shield == 0)
assert(block.primary.kind == "guard" and block.description:find("护盾抵消1，余0盾", 1, true))
assert(not block.description:find("-0", 1, true))
local defeat = run("defeat", {pet("reed_turtle", 1, 1)}, {pet("ember_swift", 1, 1)}, 2, "loss")
local skill_damage = find(defeat, "damage")
assert(skill_damage.event.source_ability == "烟羽" and skill_damage.description:find("烟尾雨燕「烟羽」", 1, true))

local partial = battle.resolve({pet("reed_turtle", 5, 8)}, {pet("maple_fox", 1, 4)}, 1, catalog)
local found_partial
for index in ipairs(partial.events) do
    local event = replay.event(partial.events, index, catalog)
    if event.type == "damage" and event.absorbed > 0 and event.health_loss > 0 then
        assert(event.health_loss == 1 and event.shield == 0)
        assert(replay.describe(event, catalog):find("盾抵消1，余0盾", 1, true))
        found_partial = true
    end
end
assert(found_partial)

local replacement = run("replacement",
    {pet("fern_quail", 3, 1), pet("mist_crane", 5, 7)}, {pet("alder_marmot", 3, 2)}, 1, "win")
local compacted, compact_index = find(replacement, "faint", function(event) return event.shifts ~= nil end)
local summoned, summon_index = find(replacement, "summon")
local empowered, buff_index = find(replacement, "buff")
assert(compact_index < summon_index and summon_index < buff_index)
assert(compacted.primary.kind == "shift" and compacted.board.player[1].id == "mist_crane")
assert(summoned.primary.kind == "summon" and summoned.event.source_id == "fern_quail")
assert(empowered.event.source_id == "mist_crane" and empowered.event.uid == summoned.event.uid)
assert(empowered.description:find("+1攻 +1命", 1, true) and empowered.primary.kind == "buff")
assert(empowered.board.player[1].attack == 3 and empowered.board.player[1].health == 3)

print("battle feedback: actual life loss, shield use, causality, compaction and terminal outcomes")
