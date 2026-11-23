-- From the repository root, run: lua platform/m2_shop_data.lua
package.path = "src/?.lua;" .. package.path

local data = require("autopets.data")
local duel = require("autopets.duel")

local function positive_integer(value, label)
    -- The native builder carries these values through its signed integer nodes.
    assert(math.type(value) == "integer" and value >= 1 and value <= 2147483647,
        label .. " must be a positive 32-bit integer")
    return value
end

local function text_field(value, label)
    assert(type(value) == "string" and value ~= "" and not value:find("%c")
        and utf8.len(value), label .. " must be nonempty UTF-8 without control characters")
    return value
end

local rows = {}
local function row(...)
    rows[#rows + 1] = table.concat({...}, "\t")
end

local rules = data.rules
local gold = positive_integer(rules.gold_per_round, "round gold")
local pet_cost = positive_integer(rules.pet_cost, "pet cost")
local team_size = positive_integer(rules.team_size, "team size")
local pet_slots = positive_integer(rules.pet_shop_slots, "pet slots")
assert(pet_cost <= gold and pet_slots >= 3, "the opening fixture needs an affordable pet and at least three slots")
row("config", gold, pet_cost, team_size, pet_slots)

local codes = {}
for code, pet in ipairs(data.pets) do
    local id = text_field(pet.id, "pet ID")
    assert(not codes[id], "duplicate pet ID: " .. id)
    codes[id] = positive_integer(code, "pet code")
    row("pet", code, id, text_field(pet.name, "pet name"),
        positive_integer(pet.attack, "pet attack"), positive_integer(pet.health, "pet health"))
end

-- Seed 1 produces different shelves on both seats in the first two turns.
-- Time out an empty first turn so the domain advances without buying or freezing.
local match = duel.new(1, 1, 2)
local function export_offers(round, seat)
    local view = assert(match:snapshot(seat))
    local shelf = view.shop.pets
    assert(view.phase == "preparation" and view.round == round and view.shop.round == round
        and view.shop.gold == gold and #view.shop.team == 0 and #shelf == pet_slots,
        "expected a new shop for the fixture round")
    local offers = {}
    for slot = 1, pet_slots do
        local offer = assert(shelf[slot], "missing opening pet")
        assert(not offer.frozen, "unexpected frozen opening pet")
        offers[slot] = assert(codes[offer.id], "unknown opening pet")
    end
    local encoded = table.concat(offers, "\t")
    row("offers", seat, round, encoded)
    return encoded
end

local seen = {}
for round = 1, 2 do
    for seat = 1, 2 do
        local shelf = export_offers(round, seat)
        assert(not seen[shelf], "fixture shelves must differ across seats and rounds")
        seen[shelf] = true
    end
    if round == 1 then
        assert(match:tick(match:snapshot(1).deadline))
        local settlement = assert(match:snapshot(1))
        assert(settlement.phase == "settlement" and settlement.outcome == "draw")
        assert(match:tick(settlement.deadline))
    end
end

io.write(table.concat(rows, "\n"), "\n")
