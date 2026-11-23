-- Original portraits drawn with the Miliastra rectangle and ellipse primitives.
-- Layers go back to front around the centre of a 44×44 region, with Y up.
local rectangle, ellipse = 100001, 106025
local ink = 0x142934
local cream = 0xffe9bc

local function layer(image, x, y, width, height, colour)
    return {image, x, y, width, height, colour >> 16, (colour >> 8) & 255, colour & 255}
end

local function dot(x, y, w, h, colour)
    return layer(ellipse, x, y, w, h, colour)
end

local function block(x, y, w, h, colour)
    return layer(rectangle, x, y, w, h, colour)
end

return {
    reed_turtle = {
        dot(-16, -7, 10, 5, ink), dot(-8, -12, 10, 8, ink), dot(8, -12, 10, 8, ink),
        dot(-8, -12, 7, 5, 0x5b9e79), dot(8, -12, 7, 5, 0x5b9e79),
        dot(-5, -2, 31, 23, ink), dot(-5, -2, 27, 19, 0x386b60),
        dot(-9, 1, 18, 12, 0x8daa69), dot(-9, 2, 11, 7, 0xc4c87a),
        dot(1, -3, 7, 10, 0x5f9767), dot(13, 1, 16, 17, ink),
        dot(13, 1, 12, 13, 0x78bf94), dot(16, -1, 6, 5, 0xaaddaa),
        dot(15, 4, 5, 5, ink), dot(16, 5, 2, 2, cream),
    },
    ember_swift = {
        dot(-15, -5, 13, 5, ink), dot(-14, -11, 12, 4, ink),
        dot(-6, 4, 12, 28, ink), dot(-6, 5, 7, 23, 0x507b87),
        dot(-1, -4, 30, 20, ink), dot(-1, -4, 26, 16, 0x426c7c),
        dot(2, -7, 20, 10, 0xcf723f), dot(4, -6, 14, 6, 0xec9c58),
        dot(-6, -4, 17, 8, 0x284951), dot(11, 3, 16, 16, ink),
        dot(11, 3, 12, 12, 0x6598a1), dot(15, 0, 6, 4, cream),
        dot(17, 1, 9, 4, 0xec9c58), dot(13, 5, 5, 5, ink), dot(14, 6, 2, 2, cream),
    },
    lantern_moth = {
        dot(-5, 14, 3, 11, ink), dot(5, 14, 3, 11, ink),
        dot(-6, 18, 5, 5, 0xe7aa6d), dot(6, 18, 5, 5, 0xe7aa6d),
        dot(-10, 3, 23, 24, ink), dot(10, 3, 23, 24, ink),
        dot(-10, 3, 18, 20, 0x956180), dot(10, 3, 18, 20, 0x956180),
        dot(-11, 5, 10, 11, 0xe09b78), dot(11, 5, 10, 11, 0xe09b78),
        dot(0, -4, 14, 26, ink), dot(0, -5, 10, 21, 0xe2ae61),
        dot(0, -8, 6, 8, cream), dot(0, 6, 11, 10, 0xf6c98e),
        dot(-2, 7, 3, 4, ink), dot(2, 7, 3, 4, ink),
    },
    alder_marmot = {
        dot(-12, 10, 14, 15, ink), dot(12, 10, 14, 15, ink),
        dot(-12, 10, 9, 10, 0xd38863), dot(12, 10, 9, 10, 0xd38863),
        dot(0, -1, 40, 32, ink), dot(0, -1, 35, 28, 0xac6245),
        dot(-9, -2, 14, 15, 0xcc7f55), dot(9, -2, 14, 15, 0xcc7f55),
        dot(0, -7, 25, 14, 0xe4ab72), dot(0, -11, 11, 7, ink),
        block(-2, -11, 3, 4, cream), block(2, -11, 3, 4, cream),
        dot(0, -3, 8, 5, ink), dot(-8, 4, 5, 6, ink),
        dot(8, 4, 5, 6, ink), dot(0, 9, 11, 4, 0xe5a471),
    },
    copper_kestrel = {
        dot(9, -9, 18, 24, ink), dot(7, -8, 16, 20, 0x714a4b),
        dot(3, -7, 21, 23, ink), dot(2, -7, 17, 20, 0xa86247),
        dot(2, -8, 10, 15, 0xe1ab67), dot(10, -7, 7, 17, 0x87583e),
        dot(0, 6, 30, 27, ink), dot(0, 6, 25, 23, 0xc67c55),
        dot(-6, 3, 15, 16, 0xe6c293), dot(2, 13, 18, 6, 0xe69e62),
        dot(-6, 5, 8, 10, 0x8e674e), dot(-7, 6, 6, 7, ink),
        dot(-6, 7, 2, 2, cream), block(-15, 2, 8, 5, 0xe6ab51),
        dot(-16, 0, 7, 7, 0xe6ab51), dot(-16, -2, 4, 4, 0xc27948),
    },
    drift_crayfish = {
        dot(0, -9, 19, 23, ink), dot(0, -10, 15, 19, 0xcc745d),
        dot(0, -15, 22, 10, ink), dot(0, -15, 17, 7, 0xaf5951),
        dot(-13, 7, 17, 21, ink), dot(13, 7, 17, 21, ink),
        dot(-13, 7, 13, 17, 0xdd896e), dot(13, 7, 13, 17, 0xdd896e),
        dot(-16, 13, 6, 7, ink), dot(16, 13, 6, 7, ink),
        dot(0, -2, 21, 15, ink), dot(0, -2, 17, 12, 0xef9c7a),
        dot(-5, 5, 6, 7, ink), dot(5, 5, 6, 7, ink),
        dot(-5, 6, 2, 2, cream), dot(5, 6, 2, 2, cream),
    },
    slate_muskdeer = {
        dot(-11, 10, 12, 23, ink), dot(11, 10, 12, 23, ink),
        dot(-11, 11, 7, 17, 0x957f84), dot(11, 11, 7, 17, 0x957f84),
        dot(0, -1, 32, 34, ink), dot(0, -1, 27, 30, 0x697e91),
        dot(0, 6, 15, 15, 0xa1aab0), dot(0, -9, 19, 15, 0xd4c4a9),
        dot(-8, -2, 7, 7, 0xb1b7b4), dot(8, -2, 7, 7, 0xb1b7b4),
        dot(-8, -1, 5, 6, ink), dot(8, -1, 5, 6, ink),
        dot(0, -7, 9, 5, ink), block(-4, -14, 3, 6, cream),
        block(4, -14, 3, 6, cream), dot(0, -11, 6, 2, 0x896b65),
    },
    aurora_tern = {
        dot(12, -11, 19, 7, ink), dot(13, -11, 15, 4, 0x6aa6a5),
        dot(8, -4, 24, 21, ink), dot(8, -4, 20, 17, 0xc9d8cc),
        dot(8, -3, 15, 12, 0x56838f), dot(9, -1, 12, 5, 0x9abcb4),
        dot(-4, 5, 23, 29, ink), dot(-4, 5, 19, 25, 0xf5dfb9),
        dot(-5, 12, 17, 10, 0x4c526e), dot(-4, 9, 13, 6, 0x777a98),
        dot(-15, 2, 13, 6, 0xec9765), dot(-17, 2, 9, 3, 0xf8b784),
        dot(-9, 6, 6, 6, ink), dot(-10, 7, 2, 2, cream),
        dot(0, -5, 8, 6, 0xd7bcb0),
    },
    cloud_ostrich = {
        dot(-7, -9, 30, 20, ink), dot(-7, -9, 26, 16, 0x4e536d),
        dot(-14, -6, 14, 13, 0xe4d4ba), dot(-15, -5, 8, 7, cream),
        dot(-7, -12, 11, 5, 0x7f8299), dot(6, 0, 14, 28, ink),
        dot(6, 0, 10, 24, 0xc5a6a7), dot(6, 1, 5, 16, 0xe9cbbc),
        dot(9, 12, 19, 18, ink), dot(9, 12, 15, 14, 0xe8cfb8),
        dot(6, 17, 13, 8, 0xf1e3cc), dot(0, 16, 8, 6, 0xf1e3cc),
        dot(16, 9, 11, 5, 0xe4a073), dot(11, 13, 6, 7, ink),
        dot(12, 14, 2, 2, cream), dot(13, 9, 3, 3, 0xdb9b95),
    },
    mothling = {
        dot(-14, -3, 13, 14, ink), dot(-7, -8, 14, 14, ink),
        dot(2, -8, 16, 13, ink), dot(10, -4, 20, 19, ink),
        dot(-14, -3, 9, 10, 0x798e68), dot(-7, -8, 11, 10, 0xa6a765),
        dot(2, -8, 12, 9, 0xd3ad65), dot(10, -4, 16, 15, 0xe3b665),
        dot(7, 4, 4, 9, 0xd6be80), dot(15, 4, 4, 9, 0xd6be80),
        dot(8, -3, 3, 5, ink), dot(14, -3, 3, 5, ink),
        dot(11, -7, 6, 3, 0xf7d693), dot(-8, -6, 5, 4, cream),
    },
    crayling = {
        dot(7, -10, 20, 14, ink), dot(9, -10, 15, 10, 0xca765d),
        dot(15, -11, 12, 9, 0xf3a485), dot(-10, 3, 20, 20, ink),
        dot(-10, 3, 16, 16, 0xf3a485), dot(-16, 8, 6, 6, ink),
        dot(4, 3, 28, 22, ink), dot(3, 3, 24, 18, 0xd98967),
        dot(6, -4, 14, 7, 0xf3a485), dot(-2, 9, 7, 9, cream),
        dot(9, 9, 7, 9, cream), dot(-2, 9, 4, 6, ink), dot(9, 9, 4, 6, ink),
        dot(3, 0, 6, 3, 0xa95554),
    },
    cloud_chick = {
        dot(-1, 3, 34, 31, ink), dot(-1, 3, 30, 27, 0xe9bd76),
        dot(-7, 15, 14, 7, cream), dot(-1, 17, 8, 7, cream),
        dot(6, 2, 11, 8, 0xe2a492), dot(-7, 7, 5, 7, ink),
        dot(5, 7, 5, 7, ink), dot(-6, 8, 2, 2, cream), dot(6, 8, 2, 2, cream),
        dot(-1, 2, 8, 5, 0xe89c57), dot(-1, -10, 35, 19, ink),
        dot(-1, -10, 31, 15, 0xc1c6d0), block(-8, -3, 8, 6, 0xc1c6d0),
        block(5, -2, 9, 7, 0xc1c6d0), dot(-4, -7, 17, 6, 0xe6ded2),
    },
    dew_berry = {
        dot(-4, 10, 12, 18, ink), dot(8, 12, 17, 11, ink),
        dot(-4, 10, 8, 14, 0x7eac74), dot(8, 12, 13, 7, 0x9cbb79),
        dot(-10, -3, 22, 22, ink), dot(10, -3, 22, 22, ink),
        dot(-10, -3, 18, 18, 0x557991), dot(10, -3, 18, 18, 0x616c9b),
        dot(0, -8, 23, 21, ink), dot(0, -8, 19, 17, 0x728bb7),
        dot(-12, 0, 6, 5, 0xabbdce), dot(11, 0, 6, 5, 0xb3b9d0),
        dot(-3, -5, 7, 6, 0xcad8e0), dot(-4, -4, 3, 3, 0xf5ead1),
    },
    sun_seed = {
        dot(-15, 0, 12, 5, 0xe5914e), dot(15, 0, 12, 5, 0xe5914e),
        dot(0, 16, 5, 10, 0xe5914e), dot(0, -16, 5, 10, 0xe5914e),
        dot(-12, 12, 5, 5, 0xeab269), dot(12, 12, 5, 5, 0xeab269),
        dot(-12, -12, 5, 5, 0xeab269), dot(12, -12, 5, 5, 0xeab269),
        dot(0, 0, 24, 31, ink), dot(0, 0, 20, 27, 0xc67547),
        dot(0, 1, 15, 23, 0xf3bd6b), dot(-3, 3, 5, 16, cream),
        dot(3, -4, 3, 11, 0xd5884b), dot(1, 8, 4, 5, 0xffd88f),
    },
    stone_jelly = {
        dot(0, -12, 40, 12, ink), dot(0, -12, 35, 8, 0x4e707c),
        block(0, -2, 34, 19, ink), dot(0, 5, 34, 22, ink),
        block(0, -3, 29, 17, 0x6b9eaa), dot(0, 5, 29, 18, 0x89bbba),
        dot(0, 6, 25, 12, 0xa5ccbc), dot(-7, 9, 10, 5, 0xd0e3ca),
        dot(8, 3, 5, 7, 0xc7dfcd), block(-11, -3, 3, 8, 0xa5ccbc),
        dot(0, -9, 24, 5, 0x84b0b9), dot(4, -5, 4, 4, 0xc7dfcd),
    },
    glow_bun = {
        dot(0, -7, 42, 23, ink), dot(0, -6, 38, 20, 0x9c6250),
        dot(-10, -2, 21, 23, ink), dot(10, -2, 21, 23, ink),
        dot(-10, -2, 18, 19, 0xe4a163), dot(10, -2, 18, 19, 0xe4a163),
        dot(0, 0, 24, 24, 0xc48557), dot(0, 1, 18, 22, 0xf0b975),
        dot(-10, 2, 12, 9, 0xf4c589), dot(10, 2, 12, 9, 0xf4c589),
        dot(0, 4, 12, 9, 0xffd89c), dot(-8, -7, 4, 2, 0xbd6b4e),
        dot(8, -7, 4, 2, 0xbd6b4e), block(12, 15, 3, 9, cream),
        block(12, 15, 9, 3, cream), dot(-12, 13, 4, 4, 0xf7d59e),
    },
    wind_rice = {
        dot(0, -15, 23, 7, ink), dot(0, -10, 36, 17, ink), dot(0, -9, 31, 13, 0x5c8c9d),
        dot(0, -6, 42, 12, ink), dot(0, -5, 37, 8, 0x9fc3c7),
        dot(-10, -2, 15, 8, cream), dot(2, -2, 20, 10, 0xf4d9a5), dot(11, -1, 12, 8, cream),
        dot(0, -5, 36, 4, 0x537a94), dot(0, -11, 21, 3, 0xa8c5c7),
        dot(-5, 6, 23, 3, 0x83b9bd), dot(3, 11, 25, 3, 0xb9d8c9),
        dot(0, 16, 14, 3, 0xa7c9c2), dot(-13, 5, 7, 3, 0xace0d0),
    },
    golden_reed = {
        dot(-1, -15, 28, 8, ink), dot(14, -6, 15, 16, ink),
        dot(14, -6, 10, 11, 0xce985f), dot(14, -6, 6, 7, ink),
        block(-3, -8, 28, 16, ink), dot(-3, -14, 27, 8, ink),
        block(-3, -7, 24, 13, 0xb17551), dot(-3, -12, 23, 8, 0xb17551),
        dot(-3, 0, 35, 11, ink), dot(-3, 0, 30, 8, 0xe5b568),
        dot(-3, 1, 21, 5, 0xf5cb87), block(-5, 8, 2, 16, 0x9fae71),
        block(3, 9, 2, 16, 0x9fae71), dot(-7, 13, 7, 4, 0xe5b568),
        dot(-3, 16, 7, 4, cream), dot(5, 14, 7, 4, 0xf5cb87),
    },
}
