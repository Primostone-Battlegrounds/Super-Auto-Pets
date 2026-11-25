-- Read-only presentation of the validated canonical event stream.
local M = {}
local function who(side, name, sides)
    return (sides[side] or "双方") .. (name and " " .. name or "")
end
function M.duration(event)
    return event.type == "damage" and 0.55 or 0.4
end
function M.board(events, position)
    for index = position, 1, -1 do
        if events[index].board then return events[index].board end
    end
end
function M.stats(name, attack, health, shield)
    return string.format("%s\n%d攻 %d命%s", name, attack, health, (shield or 0) > 0 and ("\n盾 " .. shield) or "")
end
function M.describe(event, catalog, sides)
    sides = sides or {player = "席1", enemy = "席2"}
    local actor = who(event.side, event.name, sides)
    if event.type == "attack" then
        return actor .. " 出击 → " .. who(event.target_side, event.target_name, sides)
    elseif event.type == "damage" then
        local source = catalog.pet_by_id[event.source_id] or catalog.token_by_id[event.source_id]
        local shield = (event.absorbed or 0) > 0 and " · 盾挡 " .. event.absorbed or ""
        return who(event.source_side, source and source.name, sides) .. " → " .. actor
            .. string.format(" -%d命 · 余%d命%s", event.amount, event.health, shield)
    elseif event.type == "skill" then
        return actor .. " 发动「" .. (event.ability or "技能") .. "」"
    elseif event.type == "faint" then
        return actor .. " 退场"
    elseif event.type == "summon" then
        return actor .. string.format(" 入场 · %d攻 %d命", event.attack, event.health)
    elseif event.type == "shield" then
        return actor .. string.format(" 获得 %d盾", event.amount)
    elseif event.type == "buff" then
        return actor .. string.format(" +%d攻 +%d命", event.attack_amount or 0, event.amount)
    elseif event.type == "result" then
        local winner = event.outcome == "win" and sides.player or event.outcome == "loss" and sides.enemy
        return "战斗结束 · " .. (event.reason == "strike_limit" and "步数上限" or winner and (winner .. "获胜") or "平局")
    end
    return "双方入场"
end
function M.mark(event, unit, side)
    if not unit then return "" end
    if event.uid == unit.uid and event.side == side then
        if event.type == "attack" then return "出击 → " end
        if event.type == "damage" then return event.amount == 0 and "格挡 · " or "-" .. event.amount .. "命 · " end
        if event.type == "skill" then return "技能 · " end
        if event.type == "faint" then return "退场 · " end
        if event.type == "summon" then return "入场 · " end
        if event.type == "shield" then return "+盾 · " end
        if event.type == "buff" then return "强化 · " end
    end
    if event.type == "attack" and event.target_uid == unit.uid and event.target_side == side then return "← 目标 · " end
    return ""
end
return M
