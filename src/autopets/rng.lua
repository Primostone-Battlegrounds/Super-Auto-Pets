local rng = {}
rng.__index = rng

local modulus = 2147483647
local range = modulus - 1
local multiplier = 48271
local quotient, remainder = modulus // multiplier, modulus % multiplier

function rng.parameters()
    return modulus, multiplier
end

-- Any signed Lua integer is accepted. Multiples of the modulus map to state 1.
function rng.new(seed)
    assert(math.type(seed) == "integer", "seed must be a Lua integer")
    local state = seed % modulus
    if state == 0 then
        state = 1
    end
    return setmetatable({state = state}, rng)
end

-- Split the 64-bit salt into words for Lua runtimes with 32-bit integers.
function rng.salted(seed, high, low)
    assert(math.type(seed) == "integer", "seed must be a Lua integer")
    if math.maxinteger > modulus then return rng.new(seed ~ ((high << 32) | low)) end
    local lower = seed ~ low
    local upper = (seed < 0 and -1 or 0) ~ high
    -- 2^32 ≡ 2 (mod 2^31 − 1). Upper is signed, lower is unsigned.
    local residue = (lower + (lower < 0 and 2 or 0) + 2.0 * upper) % modulus
    return rng.new(assert(math.tointeger(residue)))
end

-- Schrage's form of Park–Miller keeps the products in signed 32-bit range.
function rng:next()
    local state = multiplier * (self.state % quotient) - remainder * (self.state // quotient)
    self.state = state > 0 and state or state + modulus
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
