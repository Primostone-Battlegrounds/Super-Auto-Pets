package.path = "./src/?.lua;" .. package.path

local bot = require("autopets.bot")
local room = require("autopets.room")

local seeds = math.tointeger(tonumber(arg[1] or 128))
local profile = arg[2] or "compatibility"
local transport = arg[3] or "model"
assert(seeds and seeds > 0, "seed count must be a positive integer")
assert(transport == "model" or transport == "host", "unknown transport")
local catalog = require("autopets.catalog")(profile)
local room_host = transport == "host" and require("autopets.room_host") or nil
local styles = {"guardian", "striker", "swarm"}

local function reachable_tables(value, seen)
    if type(value) ~= "table" or seen[value] then
        return 0
    end
    seen[value] = true
    local count = 1
    for key, child in pairs(value) do
        count = count + reachable_tables(key, seen) + reachable_tables(child, seen)
    end
    return count
end

local function digest_bytes(hash, bytes)
    for index = 1, #bytes do
        hash = (hash ~ bytes:byte(index)) * 0x100000001b3
    end
    return hash
end

local function digest(hash, value)
    local kind = type(value)
    if kind == "number" then
        return digest_bytes(hash, string.pack("<c1i8", "i", value))
    elseif kind == "string" then
        return digest_bytes(hash, string.pack("<c1s4", "s", value))
    elseif kind == "boolean" then
        return digest_bytes(hash, value and "t" or "f")
    end
    assert(kind == "table", "unexpected state value")
    local keys = {}
    for key in pairs(value) do
        keys[#keys + 1] = key
    end
    table.sort(keys)
    hash = digest_bytes(hash, string.pack("<c1I4", "o", #keys))
    for _, key in ipairs(keys) do
        hash = digest(digest(hash, key), value[key])
    end
    return hash
end

local function run_match(seed, humans, totals)
    local clock = 0
    local options = {wait_ms = 5000, catalog = catalog}
    local host = room_host and room_host.new(seed, options) or nil
    local matches = host and host.match or room.new(seed, options)
    local disconnected, simulated_snapshots, counted_eliminations = {}, {}, {}
    local handles = {}
    local revision = -1

    local function accept_frames(updates)
        totals.snapshots = totals.snapshots + #updates
        totals.peak_batch = math.max(totals.peak_batch, #updates)
        for _, update in ipairs(updates) do
            local state = update.state
            assert(handles[state.seat] == update.connection, "snapshot routed to the wrong connection")
            assert(not state.shop or not state.shop.rng_state, "private RNG escaped")
            simulated_snapshots[state.seat] = state
        end
    end

    -- Model a host which publishes at most one latest snapshot per connected
    -- player when the revision changes. The model makes no platform API calls.
    local function sample()
        local state = matches:public_snapshot()
        if host or state.revision == revision then
            return state
        end
        revision = state.revision
        local count = 0
        for player = 1, humans do
            local snapshot = not disconnected[player] and matches:snapshot(player)
            if snapshot then
                simulated_snapshots[player] = snapshot
                assert(not snapshot.shop or not snapshot.shop.rng_state, "private RNG escaped")
                assert(snapshot.revision == revision, "inconsistent revisions")
                count = count + 1
            end
        end
        totals.snapshots = totals.snapshots + count
        totals.peak_batch = math.max(totals.peak_batch, count)
        return state
    end

    local function send(player, payload)
        totals.requests = totals.requests + 1
        if host then
            local accepted, code, updates = host:request(handles[player], payload, clock)
            accept_frames(assert(updates))
            return accepted, code
        end
        return matches:request(player, payload, clock)
    end

    local function request(player, snapshot, action, command)
        return send(player, {
            round = snapshot.round,
            sequence = snapshot.next_sequence,
            action = action,
            command = command,
        })
    end

    local function tick(deadline)
        clock = assert(deadline)
        if host then
            local ok, updates = host:tick(clock)
            assert(ok, updates)
            accept_frames(updates)
        else
            assert(matches:tick(clock))
        end
    end

    for player = 1, humans do
        if host then
            local handle, updates = host:connect(player, clock)
            handles[player] = assert(handle, updates)
            accept_frames(updates)
            assert(simulated_snapshots[player].seat == player)
        else
            assert(matches:join(player, clock) == player)
            sample()
        end
    end
    local state = matches:public_snapshot()
    if state.phase == "lobby" then
        tick(state.deadline)
    end
    state = sample()
    assert(state.human_count == humans and state.bot_count == 8 - humans and state.alive_count == 8)
    local observed_battle_round = 0
    local exercised_replay = false
    while true do
        state = sample()
        if state.phase == "settlement" or state.phase == "ended" then
            local seen = {}
            local had_new_battle, byes, eliminated = false, 0, 0
            for _, seat in ipairs(state.seats) do
                -- Read stored replays for bot-to-bot pairs that cannot appear in
                -- a human snapshot. Count both participants' shared replay once.
                local stored_seat = matches.seats[seat.seat]
                local replay = stored_seat.battle
                if replay and replay.round > observed_battle_round and not seen[replay] then
                    assert(#replay.events > 0)
                    seen[replay] = true
                    had_new_battle = true
                    totals.battles = totals.battles + 1
                    totals.events = totals.events + #replay.events
                    totals.peak_events = math.max(totals.peak_events, #replay.events)
                    totals.hash = digest(totals.hash, replay)
                    local left, right = state.seats[replay.left], state.seats[replay.right]
                    if left.kind == "bot" and right.kind == "bot" then
                        totals.bot_battles = totals.bot_battles + 1
                    end
                    if left.kind == "human" then
                        assert(simulated_snapshots[replay.left].battle.round == replay.round)
                        exercised_replay = true
                    end
                    if right.kind == "human" then
                        assert(simulated_snapshots[replay.right].battle.round == replay.round)
                        exercised_replay = true
                    end
                end
                if seat.outcome == "bye" and stored_seat.shop.round == state.round then
                    byes = byes + 1
                end
                if seat.elimination_reason == "lives_depleted" and not counted_eliminations[seat.seat] then
                    counted_eliminations[seat.seat] = true
                    eliminated = eliminated + 1
                end
            end
            if had_new_battle then
                observed_battle_round = state.round
                totals.byes = totals.byes + byes
                if eliminated > 1 then
                    totals.multi_elimination = totals.multi_elimination + 1
                end
            end
        end

        totals.peak_tables = math.max(totals.peak_tables, reachable_tables(matches, {}))
        totals.peak_kib = math.max(totals.peak_kib, collectgarbage("count"))
        totals.hash = digest(totals.hash, state)
        if state.phase == "ended" then
            break
        elseif state.phase == "preparation" then
            for player = 1, humans do
                local snapshot = simulated_snapshots[player]
                if not disconnected[player] and snapshot.active and not snapshot.ready then
                    local actions = 0
                    while true do
                        local style = styles[(player - 1) % #styles + 1]
                        local command = bot.choose_action(snapshot.shop, style, actions, "standard", catalog)
                        if not command then
                            break
                        end
                        if actions == 0 then
                            local gap = {round = snapshot.round, sequence = snapshot.next_sequence + 1, action = "shop", command = command}
                            local accepted, error_code = send(player, gap)
                            assert(not accepted and error_code == "sequence_gap")
                        end
                        assert(request(player, snapshot, "shop", command))
                        if actions == 0 then
                            local accepted, error_code = request(player, snapshot, "shop", command)
                            assert(not accepted and error_code == "duplicate_request")
                        end
                        actions = actions + 1
                        sample()
                        snapshot = simulated_snapshots[player]
                    end
                    if (seed + state.round + player) % 5 ~= 0 then
                        assert(request(player, snapshot, "ready"))
                        sample()
                    end
                end
            end
            local current = matches:public_snapshot()
            if current.phase == "preparation" then
                if current.round == 2 and humans > 1 and seed % 5 == 0 and simulated_snapshots[humans].active then
                    if host then
                        local ok, updates = host:leave(handles[humans], clock)
                        assert(ok, updates)
                        handles[humans] = nil
                        accept_frames(updates)
                    else
                        assert(matches:leave(humans, clock))
                    end
                    disconnected[humans] = true
                    totals.exits = totals.exits + 1
                    current = matches:public_snapshot()
                end
                if current.phase == "preparation" then
                    if current.deadline < matches.match_deadline then
                        for _, seat in ipairs(current.seats) do
                            if seat.active and seat.kind == "human" and not seat.ready then
                                totals.timeouts = totals.timeouts + 1
                            end
                        end
                    end
                    tick(current.deadline)
                end
            end
        else
            assert(state.phase == "settlement")
            tick(state.deadline)
        end
    end

    local places = {}
    for _, seat in ipairs(state.seats) do
        assert(seat.place and seat.place >= 1 and seat.place <= 8 and not places[seat.place])
        places[seat.place] = seat.seat
    end
    assert(places[1] == state.winner and state.alive_count == 1 and exercised_replay)
    totals.rounds = totals.rounds + state.round
    totals.longest = math.max(totals.longest, state.round)
    totals.simulated_ms = totals.simulated_ms + clock
    totals.endings[state.reason] = (totals.endings[state.reason] or 0) + 1
end

local suffix = (profile == "compatibility" and transport == "model") and "" or (" | " .. profile .. " | " .. transport)
if profile == "expanded" then suffix = suffix .. " | " .. catalog.rules_hash end
print(("eight-seat Lua audit | %d seeds per human count%s"):format(seeds, suffix))
for humans = 1, 8 do
    collectgarbage("collect")
    local start_kib = collectgarbage("count")
    local started = os.clock()
    local totals = {
        rounds = 0, longest = 0, snapshots = 0, requests = 0, peak_batch = 0,
        battles = 0, bot_battles = 0, events = 0, peak_events = 0, byes = 0,
        timeouts = 0, exits = 0, multi_elimination = 0, simulated_ms = 0,
        peak_tables = 0, peak_kib = 0, hash = 0xcbf29ce484222325, endings = {},
    }
    for seed = 1, seeds do
        run_match(seed, humans, totals)
    end
    local message_key = transport == "host" and "host_frames" or "modeled_snapshots"
    print(("humans=%d bots=%d rounds=%d longest=%d battles=%d bot_battles=%d byes=%d timeouts=%d exits=%d multi_elimination=%d requests=%d %s=%d peak_batch=%d events=%d peak_events=%d peak_tables=%d simulated_ms=%d last_player=%d round_limit=%d match_timeout=%d digest=%016x")
        :format(humans, 8 - humans, totals.rounds, totals.longest, totals.battles, totals.bot_battles, totals.byes,
            totals.timeouts, totals.exits, totals.multi_elimination, totals.requests, message_key, totals.snapshots, totals.peak_batch,
            totals.events, totals.peak_events, totals.peak_tables, totals.simulated_ms, totals.endings.last_player or 0,
            totals.endings.round_limit or 0, totals.endings.match_timeout or 0, totals.hash))
    collectgarbage("collect")
    io.stderr:write(("humans=%d cpu_s=%.3f peak_sampled_lua_kib=%.1f retained_delta_kib=%.1f\n")
        :format(humans, os.clock() - started, totals.peak_kib, collectgarbage("count") - start_kib))
end
