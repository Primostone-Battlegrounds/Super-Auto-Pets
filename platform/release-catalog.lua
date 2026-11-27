package.path = "src/?.lua;" .. package.path

local catalog = arg[1] and assert(loadfile(arg[1]))() or require("autopets.release_data")
for _, kind in ipairs({"pets", "foods"}) do
    local entries = catalog[kind]
    local lookup = catalog[kind == "pets" and "pet_by_id" or "food_by_id"]
    local count = 0
    for id, entry in pairs(lookup) do
        assert(id == entry.id)
        count = count + 1
    end
    assert(count == #entries)
    for _, entry in ipairs(entries) do
        assert(lookup[entry.id] == entry)
        if entry.ability and entry.ability.token then
            assert(catalog.token_by_id[entry.ability.token])
        end
        print(kind, entry.id)
    end
end
local tokens = {}
for id, entry in pairs(catalog.token_by_id) do
    assert(id == entry.id)
    tokens[#tokens + 1] = id
end
table.sort(tokens)
for _, id in ipairs(tokens) do print("tokens", id) end
