package.path = "src/?.lua;" .. package.path

-- Expand only the isolated exporter process. Reuse existing skill definitions
-- so the fixture tests native catalog indexing rather than new game content.
local catalog = require("autopets.release_data")
local originals = catalog.pets
catalog.pets, catalog.pet_by_id = {}, {}
for tier = 1, catalog.rules.max_tier do
    local template
    local count = 0
    for _, pet in ipairs(originals) do
        if pet.tier == tier then
            template = pet
            count = count + 1
            catalog.pets[#catalog.pets + 1] = pet
            catalog.pet_by_id[pet.id] = pet
        end
    end
    for slot = count + 1, 10 do
        local pet = {}
        for key, value in pairs(assert(template)) do pet[key] = value end
        pet.id = "tier_fixture_" .. tier .. "_" .. slot
        catalog.pets[#catalog.pets + 1] = pet
        catalog.pet_by_id[pet.id] = pet
    end
end
assert(#catalog.pets == 60)

assert(table.remove(arg, 1) == "-E")
arg[0] = table.remove(arg, 1)
assert(loadfile(arg[0]))()
