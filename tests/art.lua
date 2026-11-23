package.path = "src/?.lua;" .. package.path

local art = require("autopets.art")
local data = require("autopets.data")

local function assert_dense(list)
    assert(type(list) == "table")
    local size = #list
    local count = 0
    for key in pairs(list) do
        assert(math.type(key) == "integer" and key >= 1 and key <= size)
        count = count + 1
    end
    assert(count == size)
    return size
end

local silhouettes, catalogue_ids = {}, {}
local count = 0
for _, catalogue in ipairs({data.pet_by_id, data.food_by_id, data.token_by_id}) do
    for id in pairs(catalogue) do
        assert(not catalogue_ids[id], id .. " duplicated in catalogue")
        catalogue_ids[id] = true
        count = count + 1

        local layers = assert(art[id], id .. " missing artwork")
        local size = assert_dense(layers)
        assert(size >= 8 and size <= 16, id .. " layer count outside supported range")
        local geometry, colours = {}, {}
        for index, layer in ipairs(layers) do
            assert(assert_dense(layer) == 8, id .. " malformed layer")
            for _, value in ipairs(layer) do
                assert(math.type(value) == "integer", id .. " non-integer layer value")
            end

            local image, x, y, width, height, red, green, blue = table.unpack(layer)
            assert(image == 100001 or image == 106025, id .. " unsupported image")
            assert(width > 0 and height > 0, id .. " empty shape")
            assert(2 * math.abs(x) + width <= 44 and 2 * math.abs(y) + height <= 44,
                id .. " artwork exceeds the 44×44 region")
            for _, channel in ipairs({red, green, blue}) do
                assert(channel >= 0 and channel <= 255, id .. " invalid RGB channel")
            end
            colours[table.concat({red, green, blue}, ",")] = true
            geometry[index] = table.concat(layer, ",", 1, 5)
        end
        local colour_count = 0
        for _ in pairs(colours) do
            colour_count = colour_count + 1
        end
        assert(colour_count >= 5, id .. " lacks a varied palette")
        local signature = table.concat(geometry, "/")
        local other = silhouettes[signature]
        assert(not other, id .. " duplicates the geometry of " .. tostring(other))
        silhouettes[signature] = id
    end
end
for id in pairs(art) do
    assert(catalogue_ids[id], id .. " does not belong to the catalogue")
end

print(string.format("art tests passed (%d original icons)", count))
