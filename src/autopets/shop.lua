local battle_receipt = require("autopets.battle_receipt")
local data = require("autopets.data")
local rng = require("autopets.rng")

local rules = data.rules
local shop = {}
shop.__index = shop

local function valid_position(position, count)
    return type(position) == "number" and position % 1 == 0 and position >= 1 and position <= count
end

local function copy_items(items)
    local copy = {}
    for index, item in ipairs(items) do
        if item then
            local fields = {}
            for key, value in pairs(item) do
                fields[key] = value
            end
            copy[index] = fields
        else
            copy[index] = false
        end
    end
    return copy
end

local function random_offer(pool, random)
    return {id = pool[random:int(1, #pool)].id, frozen = false}
end

local function refresh(shelf, slots, pool, random)
    for index = 1, slots do
        if not shelf[index] or not shelf[index].frozen then
            shelf[index] = random_offer(pool, random)
        end
    end
end

local function refresh_shop(self)
    refresh(self.pets, rules.pet_shop_slots, data.pets_for_tier(self.tier), self.random)
    refresh(self.foods, rules.food_shop_slots, data.foods_for_tier(self.tier), self.random)
end

local function open_round(self)
    self.round = self.round + 1
    self.tier = data.tier_for_round(self.round)
    self.gold = rules.gold_per_round
    self.rewards = {}
    refresh_shop(self)
    self.phase = "preparation"
end

function shop.new(seed)
    local self = setmetatable({
        round = 0, team = {}, pets = {}, foods = {}, random = rng.new(seed), next_uid = 1,
    }, shop)
    open_round(self)
    return self
end

function shop:snapshot()
    return {
        round = self.round,
        tier = self.tier,
        gold = self.gold,
        team = copy_items(self.team),
        pets = copy_items(self.pets),
        foods = copy_items(self.foods),
        rewards = copy_items(self.rewards),
        phase = self.phase,
        last_outcome = self.last_outcome,
        rng_state = self.random.state,
        next_uid = self.next_uid,
    }
end

function shop:finish_turn()
    if self.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    self.closed_team = copy_items(self.team)
    self.phase = "battle"
    return self.closed_team
end

local function check_battle(self, result, side)
    if self.phase ~= "battle" then
        return nil, "wrong_phase"
    end
    return battle_receipt.check(result, side, self.closed_team, self.team)
end

function shop:record_battle(result, side)
    local receipt, error_code = check_battle(self, result, side)
    if not receipt then
        return nil, error_code
    end
    if receipt.status ~= "resolved" then
        return nil, receipt.status
    end
    local outcome = receipt.outcome
    if side == "enemy" and outcome ~= "draw" then
        outcome = outcome == "win" and "loss" or "win"
    end
    self.last_outcome = outcome
    self.closed_team = nil
    self.phase = "settlement"
    return true
end

function shop:abort_turn(result, side)
    local receipt, error_code = check_battle(self, result, side)
    if not receipt then
        return nil, error_code
    end
    if receipt.status ~= "strike_limit" then
        return nil, "resolved_battle"
    end
    self.closed_team = nil
    self.phase = "preparation"
    return true
end

-- A vacant pairing settles the economy without a battle receipt or outcome.
function shop:skip_battle()
    if self.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    self.last_outcome = nil
    self.phase = "settlement"
    return true
end

function shop:advance_round()
    if self.phase ~= "settlement" then
        return nil, "wrong_phase"
    end
    open_round(self)
    return true
end

local function has_open_slot(shelf)
    for _, offer in ipairs(shelf) do
        if not offer or not offer.frozen then
            return true
        end
    end
    return false
end

local function reroll(self)
    if self.gold < rules.reroll_cost then
        return nil, "insufficient_gold"
    end
    if not has_open_slot(self.pets) and not has_open_slot(self.foods) then
        return nil, "all_frozen"
    end
    self.gold = self.gold - rules.reroll_cost
    refresh_shop(self)
    return true
end

local function freeze(self, kind, position, frozen)
    local shelves = {pet = self.pets, food = self.foods}
    local shelf = shelves[kind]
    if not shelf then
        return nil, "invalid_offer_type"
    end
    if not valid_position(position, #shelf) or not shelf[position] then
        return nil, "missing_offer"
    end
    if frozen == nil then
        frozen = not shelf[position].frozen
    end
    shelf[position].frozen = frozen
    return true
end

local function remove_offer(shelf, position, reward)
    if reward then
        table.remove(shelf, position)
    else
        shelf[position] = false
    end
end

local function buy(self, offer_position, team_position, reward)
    local shelf = reward and self.rewards or self.pets
    if not valid_position(offer_position, #shelf) or not shelf[offer_position] then
        return nil, "missing_offer"
    end
    if #self.team == rules.team_size then
        return nil, "team_full"
    end
    if self.gold < rules.pet_cost then
        return nil, "insufficient_gold"
    end
    local position = team_position
    if position == nil then
        position = #self.team + 1
    end
    if not valid_position(position, #self.team + 1) then
        return nil, "invalid_position"
    end
    local definition = data.pet_by_id[shelf[offer_position].id]
    table.insert(self.team, position, {
        id = definition.id, uid = self.next_uid,
        attack = definition.attack, health = definition.health, level = 1, xp = 0,
    })
    self.next_uid = self.next_uid + 1
    remove_offer(shelf, offer_position, reward)
    self.gold = self.gold - rules.pet_cost
    return true
end

local function sell(self, position)
    if not valid_position(position, #self.team) then
        return nil, "invalid_position"
    end
    local unit = table.remove(self.team, position)
    self.gold = self.gold + unit.level * rules.sell_gold_per_level
    return true
end

local function move(self, from, to)
    if not valid_position(from, #self.team) or not valid_position(to, #self.team) then
        return nil, "invalid_position"
    end
    local unit = table.remove(self.team, from)
    table.insert(self.team, to, unit)
    return true
end

local function merge_error(source, target)
    if source.id ~= target.id then
        return "different_pet"
    end
    if target.level == rules.max_level then
        return "max_level"
    end
end

local function grow(self, source, target)
    target.attack = math.max(target.attack, source.attack) + rules.merge_attack
    target.health = math.max(target.health, source.health) + rules.merge_health
    target.xp = math.min(rules.level_xp[rules.max_level], target.xp + (source.xp or 0) + 1)
    while target.level < rules.max_level and target.xp >= rules.level_xp[target.level + 1] do
        target.level = target.level + 1
        local tier = math.min(rules.max_tier, self.tier + rules.level_reward_tier_offset)
        local rewards = self.rewards
        rewards[#rewards + 1] = random_offer(data.pets_at_tier(tier), self.random)
    end
end

local function merge(self, from, to)
    if not valid_position(from, #self.team) or not valid_position(to, #self.team) then
        return nil, "invalid_position"
    end
    if from == to then
        return nil, "same_position"
    end
    local source, target = self.team[from], self.team[to]
    local error_code = merge_error(source, target)
    if error_code then
        return nil, error_code
    end
    grow(self, source, target)
    table.remove(self.team, from)
    return true
end

local function combine(self, offer_position, target_position, reward)
    local shelf = reward and self.rewards or self.pets
    if not valid_position(offer_position, #shelf) or not shelf[offer_position] then
        return nil, "missing_offer"
    end
    if not valid_position(target_position, #self.team) then
        return nil, "invalid_position"
    end
    if self.gold < rules.pet_cost then
        return nil, "insufficient_gold"
    end
    local definition = data.pet_by_id[shelf[offer_position].id]
    local target = self.team[target_position]
    local error_code = merge_error(definition, target)
    if error_code then
        return nil, error_code
    end
    remove_offer(shelf, offer_position, reward)
    self.gold = self.gold - rules.pet_cost
    grow(self, definition, target)
    return true
end

local function feed(self, offer_position, target_position)
    if not valid_position(offer_position, #self.foods) or not self.foods[offer_position] then
        return nil, "missing_offer"
    end
    if not valid_position(target_position, #self.team) then
        return nil, "invalid_position"
    end
    if self.gold < rules.food_cost then
        return nil, "insufficient_gold"
    end
    local food = data.food_by_id[self.foods[offer_position].id]
    local target = self.team[target_position]
    target.attack = target.attack + food.attack
    target.health = target.health + food.health
    self.foods[offer_position] = false
    self.gold = self.gold - rules.food_cost
    return true
end

local commands = {
    buy = {execute = buy, fields = {"offer", "target", "reward"}},
    combine = {execute = combine, fields = {"offer", "target", "reward"}},
    sell = {execute = sell, fields = {"target"}},
    move = {execute = move, fields = {"from", "to"}},
    merge = {execute = merge, fields = {"from", "to"}},
    feed = {execute = feed, fields = {"offer", "target"}},
    freeze = {execute = freeze, fields = {"kind", "offer", "frozen"}},
    reroll = {execute = reroll, fields = {}},
}

function shop:apply(command)
    if self.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    if type(command) ~= "table" then
        return nil, "invalid_command"
    end
    local spec = commands[command.action]
    if not spec then
        return nil, "unknown_action"
    end
    if command.reward ~= nil and type(command.reward) ~= "boolean"
        or command.frozen ~= nil and type(command.frozen) ~= "boolean" then
        return nil, "invalid_command"
    end

    local args = {}
    for index, field in ipairs(spec.fields) do
        args[index] = command[field]
    end
    return spec.execute(self, table.unpack(args, 1, #spec.fields))
end

function shop:apply_action(action, ...)
    local spec = commands[action]
    if not spec then
        return nil, "unknown_action"
    end
    local values = {...}
    local command = {action = action}
    for index, field in ipairs(spec.fields) do
        command[field] = values[index]
    end
    return self:apply(command)
end

for action in pairs(commands) do
    shop[action] = function(self, ...)
        return self:apply_action(action, ...)
    end
end

return shop
