local battle = require("autopets.battle")
local bot = require("autopets.bot")
local data = require("autopets.data")
local rng = require("autopets.rng")
local shop = require("autopets.shop")

local opponent_turn_budget = 64
local run = {}
run.__index = run

local function copy(value)
    if type(value) ~= "table" then
        return value
    end
    local result = {}
    for key, field in pairs(value) do
        result[key] = copy(field)
    end
    return result
end

local function prepare(self)
    self.opponent = assert(bot.snapshot(self.opponents))
    self.battle = nil
    self.phase = "preparation"
end

local function reset(self, seed)
    self.seed = seed
    self.wins = 0
    self.lives = self.catalog.rules.start_lives
    self.final = nil
    -- Salt each RNG with its domain so shop activity cannot influence later battles.
    self.shop = shop.new(seed ~ 0x53484f50, self.catalog) -- SHOP
    local opponent_random = rng.new(seed ~ 0x424f54) -- BOT
    self.opponents = bot.new_pool(opponent_random:next(), nil, self.difficulty, self.catalog)
    self.battle_random = rng.new(seed ~ 0x4649474854) -- FIGHT
    assert(bot.advance_to_round(self.opponents, 1, opponent_turn_budget))
    prepare(self)
end

function run.new(seed, difficulty, catalog)
    assert(math.type(seed) == "integer", "seed must be a Lua integer")
    local self = setmetatable({difficulty = difficulty, catalog = catalog or data}, run)
    reset(self, seed)
    return self
end

function run:snapshot()
    return {
        seed = self.seed,
        round = self.shop.round,
        wins = self.wins,
        lives = self.lives,
        phase = self.phase,
        final = self.final,
        shop = self.shop:snapshot(),
        opponent = copy(self.opponent),
        battle = copy(self.battle),
    }
end

-- A diagnostic export of the opponent actually selected for this run.
function run:opponent_trace()
    return bot.trace(self.opponents)
end

function run:shop_action(name, ...)
    if self.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    return self.shop:apply_action(name, ...)
end

function run:submit()
    if self.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    if #self.shop:snapshot().team == 0 then
        return nil, "empty_team"
    end
    local player = assert(self.shop:finish_turn())
    local prior_rng = self.battle_random.state
    local seed = self.battle_random:next()
    local result = battle.resolve(player, self.opponent.team, seed, self.catalog)
    if result.status == "strike_limit" then
        assert(self.shop:abort_turn(result, "player"))
        self.battle_random.state = prior_rng
        return nil, result.status
    end
    result.round = self.shop.round
    self.battle = result
    self.phase = "battle"
    return true
end

function run:settle()
    if self.phase ~= "battle" then
        return nil, "wrong_phase"
    end
    local ok, error_code = self.shop:record_battle(self.battle, "player")
    if not ok then
        return nil, error_code
    end
    local outcome = self.battle.outcome
    if outcome == "win" then
        self.wins = self.wins + 1
    elseif outcome == "loss" then
        self.lives = self.lives - 1
    end
    if self.wins == self.catalog.rules.wins_to_win or self.lives == 0 then
        self.phase = "ended"
        self.final = outcome
    else
        self.phase = "settlement"
    end
    return true
end

function run:advance()
    if self.phase ~= "settlement" then
        return nil, "wrong_phase"
    end
    if not bot.advance_to_round(self.opponents, self.shop.round + 1, opponent_turn_budget) then
        return nil, "opponent_preparing"
    end
    local ok, error_code = self.shop:advance_round()
    if not ok then
        return nil, error_code
    end
    prepare(self)
    return true
end

function run:restart(seed)
    if self.phase ~= "ended" and self.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    if seed ~= nil and math.type(seed) ~= "integer" then
        return nil, "invalid_seed"
    end
    reset(self, seed or self.seed)
    return true
end

return run
