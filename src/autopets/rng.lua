local rng = {}
rng.__index = rng

local modulus = 2147483647
local range = modulus - 1

-- Any signed Lua integer is accepted. Multiples of the modulus map to state 1.
function rng.new(seed)
    assert(math.type(seed) == "integer", "seed must be a Lua integer")
    local state = seed % modulus
    if state == 0 then
        state = 1
    end
    return setmetatable({state = state}, rng)
end

-- Park–Miller with multiplier 48271. The intermediate product fits a Lua 5.4 integer.
function rng:next()
    self.state = self.state * 48271 % modulus
    return self.state
end

-- Both endpoints are inclusive, with a maximum span of 2147483646 values.
function rng:int(low, high)
    assert(math.type(low) == "integer" and math.type(high) == "integer" and low <= high
        and low >= -range and high <= range, "invalid random integer bounds")
    local span = high - low + 1
    assert(span <= range, "random integer span exceeds generator range")

    local limit = range - range % span
    local value
    repeat
        value = self:next() - 1
    until value < limit
    return low + value % span
end

return rng
