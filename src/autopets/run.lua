local battle = require("autopets.battle")
local bot = require("autopets.bot")
local data = require("autopets.data")
local rng = require("autopets.rng")
local shop = require("autopets.shop")

local rules = data.rules
local run = {}
run.__index = run

local shop_actions = {
    buy = shop.buy,
    combine = shop.combine,
    sell = shop.sell,
    move = shop.move,
    merge = shop.merge,
    feed = shop.feed,
    freeze = shop.freeze,
    reroll = shop.reroll,
}

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
    self.opponent = bot.generate(self.shop.round, self.opponent_random:next())
    self.battle = nil
    self.phase = "preparation"
end

local function reset(self, seed)
    self.seed = seed
    self.wins = 0
    self.lives = rules.start_lives
    self.final = nil
    -- Salt each RNG with its domain so shop activity cannot influence later battles.
    self.shop = shop.new(seed ~ 0x53484f50) -- SHOP
    self.opponent_random = rng.new(seed ~ 0x424f54) -- BOT
    self.battle_random = rng.new(seed ~ 0x4649474854) -- FIGHT
    prepare(self)
end

function run.new(seed)
    assert(math.type(seed) == "integer", "seed must be a Lua integer")
    local self = setmetatable({}, run)
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

function run:shop_action(name, ...)
    if self.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    local action = shop_actions[name]
    if not action then
        return nil, "unknown_action"
    end
    return action(self.shop, ...)
end

function run:submit()
    if self.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    local player = self.shop:snapshot().team
    if #player == 0 then
        return nil, "empty_team"
    end
    local seed = self.battle_random:next()
    local result = battle.resolve(player, self.opponent.team, seed)
    result.seed = seed
    result.round = self.shop.round
    self.battle = result
    self.phase = "battle"
    return true
end

function run:settle()
    if self.phase ~= "battle" then
        return nil, "wrong_phase"
    end
    local outcome = self.battle.outcome
    if outcome == "win" then
        self.wins = self.wins + 1
    elseif outcome == "loss" then
        self.lives = self.lives - 1
    end
    if self.wins == rules.wins_to_win or self.lives == 0 then
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
    self.shop:advance_round()
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
