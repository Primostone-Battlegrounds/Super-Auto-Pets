local mode, extracted = arg[1], arg[2]
local profile = arg[mode == "source" and 2 or 3] or "compatibility"
local names = {compatibility = "autopets.data", release = "autopets.release_data", expanded = "autopets.expanded_data"}
local release = profile ~= "compatibility"
local load_module
if mode == "source" then
    package.path = "src/?.lua;" .. package.path
    load_module = require
else
    assert(mode == "bundle" and extracted, "use source or bundle <GIL readback Lua>")
    local file = assert(io.open(extracted, "rb"))
    local source = assert(file:read("*a"))
    assert(file:close())
    -- Retain every byte of the extracted client. This test-only suffix exposes
    -- the private loader without invoking a UI callback or changing the GIL.
    local env = setmetatable({
        script = {object = {}},
        Enum = {CursorEventType = {CursorClick = 1}},
    }, {__index = _G})
    load_module = assert(load(source .. "\nreturn loadAutoPetsModule", "@" .. extracted, "t", env))()
end

local data = load_module(assert(names[profile], "unknown catalog profile"))
local art = load_module("autopets.art")
if profile == "expanded" and mode == "source" then
    for id, layers in pairs(require("autopets.expanded_art")) do
        assert(not art[id], id)
        art[id] = layers
    end
end
local bot = load_module("autopets.bot")
local run = load_module("autopets.run")

local function encode(value, out)
    local kind = type(value)
    if kind == "table" then
        local keys = {}
        for key in pairs(value) do
            assert(type(key) == "string" or math.type(key) == "integer", "unsupported replay key")
            keys[#keys + 1] = key
        end
        table.sort(keys, function(a, b)
            if type(a) == type(b) then return a < b end
            return type(a) < type(b)
        end)
        out[#out + 1] = "{"
        for _, key in ipairs(keys) do
            out[#out + 1] = "["
            encode(key, out)
            out[#out + 1] = "]="
            encode(value[key], out)
            out[#out + 1] = ","
        end
        out[#out + 1] = "}"
    elseif kind == "string" then
        out[#out + 1] = string.format("%q", value)
    elseif kind == "boolean" or math.type(value) == "integer" then
        out[#out + 1] = tostring(value)
    else
        error("unsupported replay value " .. kind)
    end
end

local function canonical(value)
    local out = {}
    encode(value, out)
    return table.concat(out)
end

local function record(name, value)
    io.write(name, " ", canonical(value), "\n")
end

assert(type(data.rules_hash) == "string", "runtime catalog has no rules hash")
io.write("rules_hash ", data.rules_hash, "\n")
local asset_count, definitions_layers, max_layers = 0, 0, 0
local function inspect_assets(catalog)
    for _, item in pairs(catalog) do
        local layers = assert(art[item.id], "unbound asset " .. item.id)
        assert(#layers > 0)
        asset_count, definitions_layers = asset_count + 1, definitions_layers + #layers
        max_layers = math.max(max_layers, #layers)
    end
end
inspect_assets(data.pets)
inspect_assets(data.foods)
inspect_assets(data.token_by_id)
io.write("assets ", asset_count, " ", definitions_layers, " ", max_layers, "\n")

if release then
    local counts, seen = {}, {}
    for tier = 1, data.rules.max_tier do
        local pets = data.pets_at_tier(tier)
        for _, pet in ipairs(pets) do
            assert(pet.tier == tier and data.pet_by_id[pet.id] == pet, "invalid tier entry " .. pet.id)
            assert(not seen[pet.id] and not data.token_by_id[pet.id], "duplicate or summon in shop " .. pet.id)
            seen[pet.id] = true
        end
        counts[tier] = #pets
    end
    for _, pet in ipairs(data.pets) do
        assert(seen[pet.id], "missing shop pet " .. pet.id)
    end
    io.write("pet_tier_counts ", table.concat(counts, " "), "\n")
end

for _, fixture in ipairs({{seed = 7, style = "guardian"}, {seed = -12, style = "swarm"}}) do
    local pool = bot.new_pool(fixture.seed, fixture.style, nil, data)
    local attempts = 0
    while not bot.advance_to_round(pool, release and 12 or 6, 3) do
        attempts = attempts + 1
        assert(attempts < 1000, "training progress exhausted its call budget")
    end
    local trace = bot.trace(pool)
    local expected = bot.snapshot(pool)
    local replayed = assert(bot.replay(trace, data))
    assert(canonical(replayed) == canonical(expected), "training replay diverged")
    record("training", {fixture = fixture, opponent = expected, trace = trace})
end

if profile == "expanded" then
    local highest_tier = 0
    for _, seed in ipairs({7, 8, 11}) do
        local game = run.new(seed, nil, data)
        local opening = game:snapshot()
        local completed
        for round = 1, 80 do
            assert(game:snapshot().round == round)
            for used = 0, 20 do
                local state = game:snapshot().shop
                local command = bot.choose_action(state, "guardian", used, "standard", data)
                if not command then break end
                assert(game.shop:apply(command))
            end
            local team = game:snapshot().shop.team
            assert(#team > 0 and #team <= data.rules.team_size)
            assert(game:submit())
            assert(game:settle())
            local state = game:snapshot()
            highest_tier = math.max(highest_tier, state.shop.tier)
            record("expanded_round", {seed = seed, round = round, team = team,
                outcome = state.battle.outcome, wins = state.wins, lives = state.lives})
            if state.phase == "ended" then
                assert(state.wins == data.rules.wins_to_win or state.lives == 0)
                io.write("expanded_complete ", seed, " ", round, " ", state.wins, " ", state.lives, "\n")
                completed = true
                break
            end
            for _ = 1, 10 do
                local advanced, reason = game:advance()
                if advanced then break end
                assert(reason == "opponent_preparing", reason)
            end
            assert(game:snapshot().round == round + 1)
        end
        assert(completed, "expanded practice did not reach a terminal result")
        assert(game:restart(seed))
        assert(canonical(game:snapshot()) == canonical(opening), "expanded practice restart diverged")
    end
    assert(highest_tier == data.rules.max_tier, "expanded practice did not reach the highest tier")
    return
end

local game = run.new(7, nil, data)
record("player_start", game:snapshot())
local function action(name, ...)
    assert(game:shop_action(name, ...))
    record("player_action", {name = name, args = table.pack(...), snapshot = game:snapshot()})
end
action("freeze", "pet", 3)
action("buy", 1)
action("buy", 2, 1)
action("move", 2, 1)
action("feed", 1, 2)
action("reroll")
local before = canonical(game:snapshot())
local ok, reason = game:shop_action("buy", 1)
assert(not ok and reason == "insufficient_gold")
assert(canonical(game:snapshot()) == before, "invalid action changed state")
for round = 1, 6 do
    if round > 1 then
        local snapshot = game:snapshot()
        if #snapshot.shop.team < data.rules.team_size then action("buy", 1) end
        action("feed", 1, 1)
    end
    assert(game:submit())
    record("player_battle", game:snapshot())
    assert(game:settle())
    local settled = game:snapshot()
    record("player_settle", settled)
    if settled.phase == "ended" then break end
    assert(game:advance())
    record("player_round", game:snapshot())
end
