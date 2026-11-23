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
    -- Every animal leads with the face on the right.
    reed_turtle = {
        dot(-16, -9, 11, 6, ink), dot(-9, -13, 10, 9, ink), dot(8, -13, 10, 9, ink),
        dot(-9, -13, 7, 5, 0x5b9e79), dot(8, -13, 7, 5, 0x5b9e79),
        dot(-5, -2, 31, 25, ink), dot(-5, -2, 27, 21, 0x386b60),
        dot(-9, 1, 18, 13, 0x8daa69), dot(-9, 2, 11, 7, 0xc4c87a),
        dot(2, -3, 7, 11, 0x5f9767), dot(13, 0, 17, 17, ink),
        dot(13, 0, 13, 13, 0x78bf94), dot(17, -2, 7, 6, 0xb0d9a4),
        dot(14, 2, 6, 7, ink), dot(15, 3, 2, 2, cream),
    },
    ember_swift = {
        dot(-15, -6, 13, 5, ink), dot(-14, -13, 13, 5, ink),
        dot(-6, 3, 13, 30, ink), dot(-6, 5, 8, 23, 0x507b87),
        dot(-1, -6, 30, 20, ink), dot(-1, -6, 26, 16, 0x426c7c),
        dot(2, -9, 20, 10, 0xcf723f), dot(4, -8, 14, 6, 0xec9c58),
        dot(-7, -5, 18, 8, 0x284951), dot(11, 0, 16, 16, ink),
        dot(11, 0, 12, 12, 0x6598a1), dot(15, -3, 6, 5, cream),
        dot(17, -2, 9, 4, 0xec9c58), dot(13, 2, 6, 7, ink), dot(14, 3, 2, 2, cream),
    },
    cottontail_rabbit = {
        dot(-15, -7, 13, 13, ink), dot(-16, -6, 9, 9, cream),
        dot(-6, -10, 28, 19, ink), dot(-6, -10, 24, 15, 0xd1b08f),
        dot(-1, -14, 16, 8, 0xe0bc97),
        dot(3, 10, 10, 21, ink), dot(3, 11, 6, 15, 0xe0ae9c),
        dot(-5, 10, 12, 23, ink), dot(-5, 11, 7, 17, 0xeab4ad),
        dot(7, 0, 28, 25, ink), dot(7, 0, 24, 21, 0xf6dfb6),
        dot(13, -5, 14, 11, 0xffebd2), dot(18, -1, 5, 4, 0x936269),
        dot(10, 3, 6, 8, ink), dot(11, 4, 2, 2, cream),
        dot(12, -3, 6, 4, 0xeba99b),
    },
    alder_marmot = {
        dot(-6, -10, 31, 21, ink), dot(-6, -10, 26, 17, 0x854e40),
        dot(-11, -5, 16, 16, 0xa86049), dot(-9, 10, 15, 16, ink),
        dot(-9, 10, 10, 11, 0xd38863), dot(2, 0, 32, 29, ink),
        dot(2, 1, 28, 25, 0xbc704e), dot(3, 8, 17, 9, 0xde9b6d),
        dot(10, -4, 20, 16, 0x9b5b48), dot(11, -4, 16, 12, 0xe4ab72),
        dot(16, -6, 10, 5, ink), block(16, -8, 4, 5, cream),
        dot(17, -1, 8, 5, ink), dot(9, 4, 6, 7, ink), dot(10, 5, 2, 2, cream),
    },
    maple_fox = {
        dot(-12, -10, 20, 18, ink), dot(-12, -10, 16, 14, 0xce744b),
        dot(-17, -7, 9, 9, 0xf6d59c), dot(-3, -11, 24, 18, ink),
        dot(-3, -10, 20, 16, 0xa9573d),
        dot(4, 9, 11, 17, ink), dot(4, 10, 6, 12, 0xc78263),
        dot(-6, 8, 14, 21, ink), dot(-6, 10, 8, 15, 0xeb9b7d),
        dot(3, 0, 28, 24, ink), dot(3, 0, 24, 20, 0xe8985c),
        dot(6, -5, 21, 11, 0xf8d49d), dot(14, -3, 13, 9, 0xf5cb96),
        dot(19, -1, 6, 5, ink), dot(9, 3, 6, 7, ink), dot(10, 4, 2, 2, cream),
    },
    river_otter = {
        dot(-1, -16, 40, 8, 0x488c89),
        dot(-15, -11, 13, 9, ink), dot(-15, -11, 9, 5, 0x806353),
        dot(-6, -8, 28, 21, ink), dot(-6, -8, 24, 17, 0xa57555),
        dot(1, -11, 14, 10, 0xdaa879), dot(-1, 8, 12, 13, ink),
        dot(0, 8, 7, 8, 0xc28e75),
        dot(8, 0, 27, 24, ink), dot(8, 0, 23, 20, 0xb9835c),
        dot(12, -5, 18, 12, 0xead1a5), dot(18, -1, 5, 4, ink),
        dot(11, 3, 6, 7, ink), dot(12, 4, 2, 2, cream),
        dot(14, -3, 2, 2, 0x986950), dot(15, -6, 2, 2, 0x986950),
    },
    slate_muskdeer = {
        dot(-7, -10, 26, 22, ink), dot(-7, -10, 22, 18, 0x536877),
        dot(1, 11, 8, 20, ink), dot(2, 12, 5, 14, 0x788393),
        dot(-8, 10, 10, 24, ink), dot(-8, 11, 5, 18, 0xa2858e),
        dot(0, 0, 27, 29, ink), dot(0, 0, 23, 25, 0x697e91),
        dot(2, 5, 17, 15, 0xacb5b4), dot(11, -1, 18, 12, ink),
        dot(11, -1, 15, 9, 0xd4c4a9), dot(13, -1, 9, 5, 0xe2d3b7),
        block(13, -7, 3, 7, cream), dot(18, 0, 5, 4, ink),
        dot(7, 3, 6, 7, ink), dot(8, 4, 2, 2, cream),
    },
    sunset_cat = {
        dot(-16, -5, 11, 26, 0x76536f),
        dot(-7, -10, 28, 21, ink), dot(-7, -10, 24, 17, 0xa07699),
        dot(-5, 9, 16, 12, ink), block(-8, 12, 9, 8, ink), dot(-10, 15, 5, 6, ink),
        dot(6, 9, 15, 12, ink), block(9, 12, 8, 7, ink), dot(11, 15, 5, 5, ink),
        dot(-8, 11, 6, 8, 0xe5a5ae),
        dot(4, -1, 31, 25, ink), dot(4, -1, 27, 21, 0xbd8eaa),
        dot(12, -5, 16, 11, 0xf6c4aa), dot(18, -1, 5, 4, 0x985d76),
        dot(10, 3, 7, 8, ink), dot(11, 4, 2, 2, cream),
    },
    cloud_sheep = {
        dot(-9, -15, 7, 11, 0x58657c), dot(2, -15, 7, 11, 0x58657c),
        dot(-5, -5, 33, 27, ink), dot(-5, -5, 29, 23, 0xd7c0b1),
        dot(-13, 0, 14, 18, 0xd4b39c), dot(-4, 5, 17, 21, 0xe1c3ad),
        dot(4, 5, 17, 20, 0xe6cab8), dot(-5, -1, 21, 17, 0xfce3c9),
        dot(8, -2, 26, 21, ink), dot(9, -2, 22, 17, 0x85839b),
        dot(4, 5, 14, 7, 0x5d6379), dot(5, 5, 10, 4, 0xbd9ea9),
        dot(15, -6, 11, 8, 0xc0a9ae), dot(18, -4, 4, 3, 0x665971),
        dot(12, 1, 6, 7, ink), dot(13, 2, 2, 2, cream),
    },
    rabbit_kit = {
        dot(-13, -6, 13, 13, ink), dot(-13, -5, 9, 9, cream),
        dot(-5, -10, 26, 18, ink), dot(-5, -10, 22, 14, 0xd7af91),
        dot(0, -14, 15, 8, 0xecc7a5),
        dot(5, 9, 9, 18, ink), dot(5, 10, 5, 13, 0xe6a2a5),
        dot(-4, 9, 12, 21, ink), dot(-4, 10, 7, 15, 0xf2b9b7),
        dot(6, -1, 30, 26, ink), dot(6, -1, 26, 22, 0xffddaa),
        dot(13, -6, 15, 12, 0xffeacc), dot(17, -3, 5, 4, 0xa96b75),
        dot(10, 2, 7, 9, ink), dot(11, 3, 2, 2, cream),
        dot(11, -4, 6, 4, 0xef9e9f),
    },
    otter_pup = {
        dot(1, -16, 39, 8, 0x488c89),
        dot(-13, -10, 14, 10, ink), dot(-13, -10, 10, 6, 0xac7c68),
        dot(-5, -9, 29, 20, ink), dot(-5, -9, 25, 16, 0xbc8a6b),
        dot(-2, 7, 13, 13, ink), dot(-2, 7, 8, 8, 0xd49e89),
        dot(6, -1, 30, 26, ink), dot(6, -1, 26, 22, 0xcf9a74),
        dot(12, -6, 17, 11, 0xf4d4ac), dot(17, -2, 5, 4, 0x6c525b),
        dot(8, 2, 7, 9, ink), dot(9, 3, 2, 2, cream),
        dot(8, -5, 6, 4, 0xebac98), dot(0, -11, 12, 9, 0xac7860),
        dot(1, -10, 8, 6, 0xdfab87),
    },
    lambkin = {
        dot(-9, -15, 7, 10, ink), dot(2, -15, 7, 10, ink),
        dot(-5, -6, 32, 26, ink), dot(-5, -6, 28, 22, 0xddbbad),
        dot(-13, -1, 13, 17, 0xe9c0aa), dot(-5, 5, 16, 17, 0xf2c7b2),
        dot(3, 4, 17, 18, 0xf8d2b8),
        dot(7, -2, 27, 23, ink), dot(7, -2, 23, 19, 0xa58da1),
        dot(3, 5, 14, 8, 0x786b8b), dot(2, 5, 9, 5, 0xe0b1bc),
        dot(13, -5, 14, 10, 0xe1b7b7), dot(17, -3, 4, 4, 0x825e7a),
        dot(10, 1, 7, 8, ink), dot(11, 2, 2, 2, cream),
        dot(10, -4, 5, 3, 0xe3a2b4),
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
