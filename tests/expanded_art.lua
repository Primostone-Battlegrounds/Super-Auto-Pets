package.path = "src/?.lua;" .. package.path

local art = require("autopets.expanded_art")
local base = require("autopets.art")
local purchasable = {
    {"hamster", "chick", "hedgehog", "sparrow", "frog", "mouse", "gecko"},
    {"squirrel", "badger", "beaver", "raccoon", "robin", "duckling", "chameleon"},
    {"red_panda", "donkey", "penguin", "alpaca", "platypus", "lemur", "barn_owl"},
    {"boar", "porcupine", "sea_lion", "toucan", "koala", "flamingo", "giraffe"},
    {"elephant", "snow_leopard", "crocodile", "kangaroo", "brown_bear", "bison", "octopus"},
    {"rhinoceros", "hippo", "tiger", "orca", "gorilla", "giant_panda", "blue_whale"},
}
local summons = {"nestling", "fledgling"}
local expected, silhouettes = {}, {}
local function register(ids, kind)
    for _, id in ipairs(ids) do
        assert(not expected[id], id .. " appears in multiple catalogue categories")
        assert(art[id], id .. " has no native portrait")
        expected[id] = kind
    end
end

for tier, ids in ipairs(purchasable) do
    assert(#ids == 7, "wrong expansion in tier " .. tier)
    register(ids, "purchasable")
end
register(summons, "summon")

local function silhouette(layers)
    local rows = {}
    for index, row in ipairs(layers) do
        rows[index] = table.concat(row, ",", 1, 5)
    end
    return table.concat(rows, "/")
end

for id, layers in pairs(base) do
    if not expected[id] then silhouettes[silhouette(layers)] = id end
end

local function assert_dense(list, id)
    local entries = 0
    for index in pairs(list) do
        assert(math.type(index) == "integer" and index >= 1 and index <= #list, id .. " has invalid slots")
        entries = entries + 1
    end
    assert(entries == #list, id .. " has missing slots")
end

local minimum, maximum = 16, 0
for id, layers in pairs(art) do
    assert(expected[id], id .. " does not belong to the expanded art catalogue")
    assert_dense(layers, id)
    assert(#layers >= 8 and #layers <= 16, id .. " exceeds the native portrait layer budget")
    minimum, maximum = math.min(minimum, #layers), math.max(maximum, #layers)
    local palette, colours = {}, 0
    for _, row in ipairs(layers) do
        assert_dense(row, id)
        assert(#row == 8, id .. " has an invalid layer")
        for _, value in ipairs(row) do
            assert(math.type(value) == "integer", id .. " has a noninteger layer value")
        end
        local image, x, y, width, height, r, g, b = table.unpack(row)
        assert(image == 100001 or image == 106025, id .. " uses an unsupported native image")
        assert(width > 0 and height > 0, id .. " has an empty native layer")
        assert(2 * math.abs(x) + width <= 44 and 2 * math.abs(y) + height <= 44,
            id .. " exceeds the 44×44 portrait region")
        for _, component in ipairs({r, g, b}) do
            assert(component >= 0 and component <= 255, id .. " has an invalid colour component")
        end
        local packed = (r << 16) | (g << 8) | b
        if not palette[packed] then
            palette[packed], colours = true, colours + 1
        end
    end
    assert(colours >= 5, id .. " lacks a varied palette")
    local signature = silhouette(layers)
    assert(not silhouettes[signature], id .. " duplicates the geometry of " .. tostring(silhouettes[signature]))
    silhouettes[signature] = id
end

print(string.format("expanded art tests passed (42 purchasable, 2 summons, %d–%d native layers)", minimum, maximum))
