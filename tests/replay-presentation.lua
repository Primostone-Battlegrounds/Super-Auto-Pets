package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local catalog = require("autopets.release_data")
local replay = require("autopets.replay_view")

local function pet(id, attack, health)
    return {id = id, attack = attack, health = health, level = 1}
end

local function play(events, speed)
    local function duration(position) return replay.duration(events[position]) end
    local position, elapsed, ticks = 1, 0, 0
    local visited = {events[1].type}
    while position < #events do
        local next_position
        next_position, elapsed = replay.advance_clock(position, elapsed, 1 / 60, speed, #events, duration)
        if next_position ~= position then visited[#visited + 1] = events[next_position].type end
        position, ticks = next_position, ticks + 1
        assert(ticks < 5000, "playback stalled")
    end
    return ticks, position, elapsed, table.concat(visited, ",")
end

local first = {pet("reed_turtle", 5, 8), pet("fern_quail", 3, 1)}
local second = {pet("ember_swift", 1, 4), pet("alder_marmot", 2, 6)}
local result = battle.resolve(first, second, 42, catalog)
local events = result.events
local normal, position, elapsed, trace = play(events, 1)
local faster, fast_position, fast_elapsed, fast_trace = play(events, 2)
assert(position == #events and fast_position == position and elapsed == 0 and fast_elapsed == 0)
assert(math.abs(normal - 2 * faster) <= 2, "x2 timing must be twice as fast")
assert(trace == fast_trace and events[#events].type == "result" and events[#events].outcome == result.outcome)
assert(replay.board(events, position) == replay.board(events, #events), "skip must reuse the canonical final board")
assert(replay.advance_clock(#events, 0, 5, 2, #events, error) == #events)
assert(replay.advance_clock(1, 0, 5, 2, #events, function(index)
    return replay.duration(events[index])
end) == 2, "a slow frame must still show the next event")
assert(replay.speed_caption(1) == "倍速 x1" and replay.speed_caption(2) == "倍速 x2")
assert(replay.next_speed(1) == 2 and replay.next_speed(2) == 1)
assert(replay.toggle_caption(true, false) == "暂停")
assert(replay.toggle_caption(false, false) == "继续")
assert(replay.toggle_caption(false, true) == "重看")

print("battle presentation: x1/x2, event order, pause captions and terminal board")
