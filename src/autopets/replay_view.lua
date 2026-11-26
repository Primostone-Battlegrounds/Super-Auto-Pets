-- Read-only presentation of the validated canonical event stream.
local M = {}
local default_sides = {player = "席1", enemy = "席2"}
local event_seconds = {attack = 0.4, damage = 0.55, shield = 0.55, buff = 0.55, summon = 0.55, faint = 0.55}
local cue_paints = {
    attack = {face = 0xe6c881, ink = 0x694321},
    target = {face = 0xf7ebc3, ink = 0x6b4323},
    damage = {face = 0xfbd096, ink = 0x742e23},
    guard = {face = 0xc5dee6, ink = 0x29485a},
    shield = {face = 0xc5dee6, ink = 0x29485a},
    skill = {face = 0xf3d6aa, ink = 0x724327},
    faint = {face = 0xf1d1ce, ink = 0x742e23},
    summon = {face = 0xc4e2c8, ink = 0x285346},
    shift = {face = 0xc4e2c8, ink = 0x285346},
    buff = {face = 0xc4e2c8, ink = 0x285346},
    debuff = {face = 0xf1d1ce, ink = 0x742e23},
}
local function who(side, name, sides)
    return (sides[side] or "双方") .. (name and " " .. name or "")
end
function M.duration(event)
    return event and event_seconds[event.type] or 0.4
end

function M.speed_caption(speed)
    return "倍速 x" .. speed
end

function M.next_speed(speed)
    return speed == 1 and 2 or 1
end

function M.toggle_caption(playing, ended)
    return playing and "暂停" or ended and "重看" or "继续"
end

-- Keep the next event visible for at least one render at low frame rates. The
-- fractional time carried at ordinary frame rates keeps x1 and x2 accurate.
function M.advance_clock(position, elapsed, dt, speed, count, duration_at)
    if position >= count then return position, 0 end
    local passed = elapsed + dt * speed
    local duration = duration_at(position)
    if passed < duration then return position, passed end
    position = position + 1
    if position == count then return position, 0 end
    return position, math.min(passed - duration, 1 / 30)
end

function M.board(events, position)
    for index = position, 1, -1 do
        if events[index].board then return events[index].board end
    end
end

local function ability_effect(event, catalog)
    local definition = event and event.type == "skill" and catalog.pet_by_id[event.id]
    local ability = definition and definition.ability
    return ability and event.ability == ability.name and ability
end

local function cause(events, position, catalog)
    local event = events[position]
    local kind, index = event.type, position - 1
    local candidate = events[index]
    while candidate and candidate.strike == event.strike do
        if candidate.type == kind then
            index = index - 1
        elseif kind == "summon" and candidate.type == "buff" then
            local rally = ability_effect(events[index - 1], catalog)
            if not rally or rally.effect ~= "rally_summon" then return end
            index = index - 2
        else
            local ability = ability_effect(candidate, catalog)
            if not ability then return end
            local effect = ability.effect
            if (kind == "damage" and candidate.uid == event.source_uid)
                or (candidate.side == event.side and (
                    (kind == "shield" and (effect == "shield_front" or effect == "shield_next"))
                    or (kind == "buff" and (effect == "buff_front" or effect == "rally_summon"))
                    or (kind == "summon" and effect == "summon" and ability.token == event.id))) then
                return candidate
            end
            return
        end
        candidate = events[index]
    end
end

local function moved_units(before, after)
    local moves
    if not before then return end
    for _, side in ipairs({"player", "enemy"}) do
        local positions = {}
        for slot, unit in ipairs(before[side]) do positions[unit.uid] = slot end
        for slot, unit in ipairs(after[side]) do
            local from = positions[unit.uid]
            if from and from ~= slot then
                moves = moves or {}
                moves[#moves + 1] = {side = side, uid = unit.uid, from = from, to = slot}
            end
        end
    end
    return moves
end

-- The canonical stream is also a training-trace hash input. Add display-only
-- facts to a copy, from the emitted event order and adjacent boards.
function M.event(events, position, catalog)
    local original = events[position]
    local kind = original.type
    if kind ~= "damage" and kind ~= "shield" and kind ~= "buff" and kind ~= "summon"
        and (kind ~= "faint" or not original.board) then return original end
    local event = {}
    for key, value in pairs(original) do event[key] = value end
    if kind == "damage" then
        local before = M.board(events, position - 1)
        local previous = before and before[event.side][event.slot]
        if previous and previous.uid == event.uid then
            event.health_loss = math.max(0, previous.health - event.health)
        end
        event.shield = event.board[event.side][event.slot].shield
    elseif kind == "faint" then
        event.shifts = moved_units(M.board(events, position - 1), event.board)
        return event
    end
    local skill = cause(events, position, catalog)
    if skill then
        event.source_side, event.source_id, event.source_uid = skill.side, skill.id, skill.uid
        event.source_ability = skill.ability
    end
    return event
end

function M.combat_values(attack, health, is_boost)
    local prefix = is_boost and "+" or ""
    local attack_text, health_text = prefix .. attack, prefix .. health
    local digits = #attack_text + #health_text
    local split = digits > 7
    local size = digits <= 3 and 22 or math.min(20, math.floor(82 / digits))
    if split then size = math.min(15, math.floor(95 / math.max(#attack_text, #health_text))) end
    local values = string.format("<b><color=#482D0B><size=%d>%s</size></color></b><size=12>攻</size>%s<b><color=#5F1E22><size=%d>%s</size></color></b><size=12>命</size>",
        size, attack_text, split and "\n" or "<size=12> </size>", size, health_text)
    return values, split
end
function M.stats(name, attack, health, shield)
    local values, split = M.combat_values(attack, health)
    local guard = (shield or 0) > 0 and ("\n盾 " .. shield) or ""
    if split and guard ~= "" then guard = "<size=14>" .. guard .. "</size>" end
    return "<size=16>" .. name .. "</size>\n" .. values .. guard
end
local function source_of(event, catalog, sides)
    if not event.source_side then return nil end
    local source = catalog.pet_by_id[event.source_id] or catalog.token_by_id[event.source_id]
    local name = who(event.source_side, source and source.name, sides)
    return event.source_ability and (name .. "「" .. event.source_ability .. "」") or name
end

local function health_loss(event)
    -- Older event streams store the incoming damage after shield absorption.
    return event.health_loss or event.amount
end

local function stat_changes(event)
    local attack, life = event.attack_amount or 0, event.amount
    if attack ~= 0 and life ~= 0 then return string.format("%+d攻 %+d命", attack, life) end
    if attack ~= 0 then return string.format("%+d攻", attack) end
    if life ~= 0 then return string.format("%+d命", life) end
    return "数值未变"
end

function M.describe(event, catalog, sides)
    sides = sides or default_sides
    local actor = who(event.side, event.name, sides)
    local source = source_of(event, catalog, sides)
    local effect_target = source and source .. " → " .. actor or actor
    if event.type == "attack" then
        return actor .. " 出击 → " .. who(event.target_side, event.target_name, sides)
    elseif event.type == "damage" then
        local loss, absorbed = health_loss(event), event.absorbed or 0
        local remaining = (" · 余%d命"):format(event.health)
        local rest = event.shield and ("，余%d盾"):format(event.shield) or ""
        local shield = absorbed > 0 and ("抵消%d%s"):format(absorbed, rest) or nil
        if loss == 0 and shield then return effect_target .. " · 护盾" .. shield .. remaining end
        if loss == 0 then return effect_target .. " · 无生命损失" .. remaining end
        return effect_target .. string.format(" -%d命", loss) .. remaining .. (shield and (" · 盾" .. shield) or "")
    elseif event.type == "skill" then
        local target = event.target_side and (" → " .. who(event.target_side, event.target_name, sides)) or ""
        return actor .. " 发动「" .. (event.ability or "技能") .. "」" .. target
    elseif event.type == "faint" then
        return actor .. " 退场" .. (event.shifts and (" · %d 名队员补位"):format(#event.shifts) or "")
    elseif event.type == "summon" then
        return effect_target .. string.format(" 入场 · %d攻 %d命", event.attack, event.health)
    elseif event.type == "shield" then
        return effect_target .. string.format(" 获得 %d盾 · 余%d盾", event.amount, event.shield)
    elseif event.type == "buff" then
        return effect_target .. " · " .. stat_changes(event)
    elseif event.type == "result" then
        local winner = event.outcome == "win" and sides.player or event.outcome == "loss" and sides.enemy
        return "战斗结束 · " .. (event.reason == "strike_limit" and "步数上限" or winner and (winner .. "获胜") or "平局")
    end
    return "双方入场"
end

local function cue(board, side, slot, uid, kind, label)
    local unit = slot and board[side] and board[side][slot]
    if unit and unit.uid == uid then
        local paint = cue_paints[kind]
        return {side = side, slot = slot, kind = kind, label = label, face = paint.face, ink = paint.ink}
    end
end

function M.cues(event, board)
    if not event or not board then return end
    local kind, label, target = event.type
    if kind == "attack" then
        label = "出击"
        target = cue(board, event.target_side, event.target_slot, event.target_uid, "target", "目标")
    elseif kind == "damage" then
        local loss = health_loss(event)
        if loss == 0 and (event.absorbed or 0) > 0 then
            kind, label = "guard", "格挡"
        elseif loss > 0 then
            label = "-" .. loss
        end
    elseif kind == "skill" then
        label = "技能"
        target = cue(board, event.target_side, event.target_slot, event.target_uid, "target", "目标")
    elseif kind == "shield" then
        label = "+" .. event.amount .. "盾"
    elseif kind == "buff" then
        local debuff = event.amount < 0 or (event.attack_amount or 0) < 0
        kind, label = debuff and "debuff" or kind, debuff and "减益" or "增益"
    elseif kind == "summon" then
        label = "入场"
    elseif kind == "faint" then
        if event.shifts then
            local move = event.shifts[1]
            return cue(board, move.side, move.to, move.uid, "shift", "补位")
        end
        label = "退场"
    end
    if label then return cue(board, event.side, event.slot, event.uid, kind, label), target end
end

function M.mark(event, unit, side)
    if not unit then return "" end
    if event.uid == unit.uid and event.side == side then
        if event.type == "attack" then return "出击 → " end
        if event.type == "damage" then
            local loss = health_loss(event)
            if loss > 0 then return "-" .. loss .. "命 · " end
            return (event.absorbed or 0) > 0 and "格挡 · " or ""
        end
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
