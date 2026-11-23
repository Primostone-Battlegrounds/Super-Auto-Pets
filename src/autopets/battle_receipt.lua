local battle_receipt = {}
local receipts = setmetatable({}, {__mode = "k"})

local team_fields = {"id", "uid", "attack", "health", "level", "xp"}

local function participant(team)
    local snapshot = {}
    for slot, unit in ipairs(team) do
        local fields = {}
        for _, field in ipairs(team_fields) do
            fields[field] = unit[field]
        end
        snapshot[slot] = fields
    end
    return {team = team, snapshot = snapshot}
end

function battle_receipt.register(result, player, enemy)
    receipts[result] = {
        player = participant(player),
        enemy = participant(enemy),
        outcome = result.outcome,
        status = result.status,
    }
end

function battle_receipt.check(result, side, issued_team, persistent_team)
    if side ~= "player" and side ~= "enemy" then
        return nil, "invalid_side"
    end
    local receipt = receipts[result]
    if not receipt or result.outcome ~= receipt.outcome or result.status ~= receipt.status then
        return nil, "invalid_battle_result"
    end
    local member = receipt[side]
    if member.team ~= issued_team or #member.snapshot ~= #persistent_team then
        return nil, "wrong_battle_team"
    end
    for slot, unit in ipairs(persistent_team) do
        for _, field in ipairs(team_fields) do
            if unit[field] ~= member.snapshot[slot][field] then
                return nil, "wrong_battle_team"
            end
        end
    end
    return receipt
end

return battle_receipt
