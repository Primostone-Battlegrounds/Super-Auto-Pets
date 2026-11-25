local animal_ability = require("autopets.animal_ability")
local phase_names = {[0] = "等待入席", "分配席位", "经营准备", "自动战斗", "回合结算", "对局终局", "计算名次"}
local result_names = {"本轮获胜", "本轮落败", "本轮平局", "战斗到达步数上限"}
local battle = require("autopets.battle")
local replay_view = require("autopets.replay_view")
local decode_shop = require("autopets.shop_wire")
local shop_rules = {pet_slots = 3, food_slots = 2, team_size = 5}
local battle_codes = {win = 1, loss = 2, draw = 3}
local click = Enum.CursorEventType.CursorClick
local latest, match, preview, selected, merge, reward, pending, forfeiting, hint
local inspected
local render_standings, panel
local controls, bindings, keys, content, visibility = {}, {}, {}, {}, {}
local frames, frame_round, frame_index, following, canonical_round, seconds
local replay_playing, replay_elapsed = false, 0
local token = 0
local source_ready = false

local function object(path)
    if not controls[path] then controls[path] = assert(panel:FindChild(path), path) end
    return controls[path]
end

local function text(path, value)
    if content[path] == value then return end
    object(path).text = value
    content[path] = value
end

local function visible(path, value)
    if visibility[path] == value then return end
    local control = object(path)
    if value then control:SetActive(true) end
    control:SetVisible(value)
    if not value then control:SetActive(false) end
    visibility[path] = value
end

local function transmit(action, round, sequence, from, to, flag, ack)
    local signal = game.ServerSignal("AP_RoomRequest")
    signal:AddInt(action)
    signal:AddInt(round)
    signal:AddInt(sequence)
    signal:AddInt(from)
    signal:AddInt(to)
    signal:AddInt(flag)
    signal:AddInt(ack)
    signal:SendSignal()
end

local function refresh()
    if pending then transmit(table.unpack(pending)) else transmit(0, 0, 0, 0, 0, 0, 0) end
end

local function alive()
    return match and match.seat > 0 and (match.lives[match.seat] or 0) > 0
end

local function editable()
    return not pending and alive() and match.phase == 2 and not match.ready and preview and preview.round == match.round
end

local function send(action, from, to, flag)
    if not source_ready or not alive() or pending or match.sequence == 0 then return end
    token = token % 2147483646 + 1
    pending = {action, match.round, match.sequence, from or 0, to or 0, flag or 0, token}
    transmit(table.unpack(pending))
end

local function chosen()
    if preview and selected then
        for slot, unit in ipairs(preview.team) do
            if unit.uid == selected then return slot, unit end
        end
    end
end

local function paint_ability()
    local picked = inspected or {kind = "pet", slot = 1}
    local code, level
    if picked.kind == "team" then
        local unit = preview and preview.team[picked.slot]
        code, level = unit and unit.code, unit and unit.level
    else
        local shelf = preview and (picked.kind == "reward" and preview.rewards or preview.pets)
        code, level = shelf and shelf[picked.slot], 1
    end
    local pet = code and native_catalog.pets[math.abs(code)]
    local title, body = "点动物旁的「技能」查看", "查看不会购买或改变阵容"
    if pet then title, body = animal_ability.describe(native_catalog, pet, level, true) end
    text("Shop/AbilityTitle", title)
    text("Shop/AbilityBody", body)
end

local function paint_shop()
    if not preview or preview.round ~= match.round then return end
    text("Shop/Money", string.format("金币 %d · %d 阶 · 阵容 %d / 5 · 右侧为前排", preview.gold, preview.tier, #preview.team))
    paint_ability()
    for slot = 1, 5 do
        local is_pet = slot <= 3
        local code = is_pet and preview.pets[slot] or preview.foods[slot - 3]
        local item = (is_pet and pets or foods)[math.abs(code)]
        local detail = is_pet and "%s\n%d 攻 · %d 命" or "%s\n+%d 攻 · +%d 命"
        text("Shop/Offer" .. slot .. "/Text", item and detail:format(item.name, item.attack, item.health) or "售罄")
        text("Shop/Freeze" .. slot .. "/Text", code < 0 and "解冻" or "冻结")
        local unit = preview.team[slot]
        local name = unit and pets[unit.code] and pets[unit.code].name or "空位 " .. slot
        local stats = unit and string.format("\n%d攻 %d命\nL%d · 经验%d", unit.attack, unit.health, unit.level, unit.xp) or ""
        text("Shop/Team" .. slot .. "/Text", name .. stats)
    end
    reward = math.min(reward, math.max(#preview.rewards, 1))
    local item = pets[preview.rewards[reward]]
    text("Shop/Reward/Text", item and string.format("%s %d/%d", item.name, reward, #preview.rewards) or "暂无升级奖励")
    text("Shop/Merge/Text", merge and "取消合并" or "合并队员")
end

local function paint_battle()
    local frame = frame_round == match.round and frames[frame_index]
    local has_frame = frame and (frame.left == match.seat or frame.right == match.seat) or false
    for _, name in ipairs({"Previous", "Forward", "Follow", "Ally", "Enemy"}) do
        visible("Replay/" .. name, has_frame)
    end
    visible("Replay/Auto", has_frame and frame.event ~= nil)
    if has_frame and frame.event then
        text("Replay/Auto/Text", replay_playing and "暂停" or frame_index == #frames and "重播" or "继续")
    end
    if not has_frame then
        text("Replay/Event", "")
        local opponent = match.opponents[match.seat]
        local result = result_names[match.results[match.seat]]
        if not result then
            if not alive() then result = "已淘汰"
            elseif match.phase == 5 then result = "本局已结束"
            elseif match.phase == 6 then result = "计算名次"
            elseif opponent == 0 then result = "本轮轮空"
            else result = "等待服务端战斗画面" end
        end
        text("Replay/RoundText", result)
        for slot = 1, 5 do
            text("Replay/Own" .. slot, "")
            text("Replay/Enemy" .. slot, "")
        end
        return
    end
    local allied_side = frame.left == match.seat and 0 or 1
    local opposing_seat = allied_side == 0 and frame.right or frame.left
    local board = frame.board
    for slot = 1, 5 do
        for side = 0, 1 do
            local name = side == allied_side and "Own" or "Enemy"
            local display = "空位"
            if frame.teams then
                local unit = frame.teams[side == 0 and "player" or "enemy"][slot]
                if unit then
                    local def = native_catalog.pet_by_id[unit.id] or native_catalog.token_by_id[unit.id]
                    local marker = frame.event and replay_view.mark(frame.event, unit, side == 0 and "player" or "enemy") or ""
                    display = string.format("%s%s\n%d攻 · %d命\n盾 %d", marker, def.name, unit.attack, unit.health, unit.shield)
                end
            elseif slot <= board[61 + side] then
                local head = board[63 + side]
                local offset = (side * 5 + (head + slot - 1) % 5) * 6 + 1
                local item = fighters[board[offset]] or pets[board[offset]]
                if item then
                    display = string.format("%s\n%d攻 · %d命\n盾 %d", item.name, board[offset + 1],
                        board[offset + 2], board[offset + 4])
                end
            end
            text("Replay/" .. name .. slot, display)
        end
    end
    local sides = allied_side == 0 and {player = "我方", enemy = "对方"} or {player = "对方", enemy = "我方"}
    text("Replay/Event", frame.event and replay_view.describe(frame.event, native_catalog, sides) or "服务端战斗快照")
    local result
    if frame.outcome == 1 or frame.outcome == 2 then
        result = frame.outcome == allied_side + 1 and "本轮获胜" or "本轮落败"
    elseif frame.outcome > 0 then
        result = result_names[frame.outcome]
    else
        result = "自动战斗"
    end
    text("Replay/RoundText", string.format("%s · 对手席位 %d\n回放 %d / %d",
        result, opposing_seat, frame_index, #frames))
end

local function draw_status()
    local label = phase_names[match.phase] or "等待房间"
    if match.round > 0 then label = label .. (" · 第 " .. match.round .. " 轮") end
    if seconds then label = label .. string.format(" · 余 %d 秒", math.ceil(seconds)) end
    text("Status", label)
end

local function redraw()
    if not match then return end
    draw_status()
    local shop_open = match.phase == 2 and preview ~= nil and alive()
    local replay_open = match.phase >= 3 and match.seat > 0
    visible("Shop", shop_open)
    visible("Replay", replay_open)
    visible("Ready", shop_open and not match.ready)
    visible("Forfeit", alive() and match.phase > 0 and match.phase < 5)
    text("Forfeit/Text", forfeiting and "确认认输" or "认输")
    if shop_open then paint_shop() end
    if replay_open then paint_battle() end
    local message = hint or "等待服务端推进"
    if pending then
        message = "等待服务端响应，可用「同步」查看当前状态"
    elseif not hint and shop_open then
        local _, unit = chosen()
        local animal = unit and pets[unit.code]
        if match.ready then message = "已准备，等待其他席位"
        elseif animal then message = "已选 " .. animal.name .. " · 可喂食、出售、换位或合并"
        else message = "点选队员后可喂食、出售、换位或合并" end
    elseif not hint and match.phase == 5 then
        local place = match.places[match.seat]
        message = place and place > 0 and ("我的名次 · 第 " .. place .. " 名") or "本局已结束"
    end
    text("Hint", message)
end

local function receive_view(_, values)
    if not source_ready then return end
    local revision, phase, round, seat, sequence, humans, winner, ready, lives, places, opponents, results, raw, ack, remaining =
        table.unpack(values)
    if match and round < match.round then return end
    local acknowledged = pending and round == pending[2] and ack == pending[7]
    if revision <= latest then
        if acknowledged then pending = nil; redraw() end
        return
    end
    local transitioned = not match or round ~= match.round or phase ~= match.phase
    if transitioned then
        selected, merge, reward, hint, inspected = nil, false, 1, nil, nil
    elseif acknowledged and sequence == pending[3] then
        hint = "操作未生效，已同步服务端状态"
    else
        hint = nil
    end
    if frame_round < round then
        frames, frame_round, frame_index, following = {}, round, 0, true
        replay_playing, replay_elapsed = false, 0
    end
    if transitioned or acknowledged or pending and sequence > pending[3] then pending = nil end
    latest, forfeiting = revision, false
    match = {phase = phase, round = round, seat = seat, sequence = sequence, ready = ready, lives = lives,
        places = places, opponents = opponents, results = results}
    seconds = (phase == 2 or phase == 4) and remaining or nil
    preview = decode_shop(raw, shop_rules)
    local playing_seats = phase >= 1
    local view = {revision = revision, phase = phase == 0 and "lobby" or phase == 5 and "ended" or "preparation",
        phase_name = phase_names[phase], round = round, seat = seat, human_count = humans,
        bot_count = playing_seats and 8 - humans or 0, alive_count = 0, seats = {},
        winner = winner > 0 and winner or nil}
    if alive() and phase >= 3 and phase <= 4 then
        local opponent = opponents[seat]
        view.opponent = opponent > 0 and opponent or nil
        view.bye = not view.opponent
    end
    for index = 1, playing_seats and 8 or humans do
        local life, place = lives[index], places[index]
        if phase == 5 and place == 1 or phase ~= 5 and life > 0 then view.alive_count = view.alive_count + 1 end
        view.seats[index] = {kind = index <= humans and "human" or "bot", lives = playing_seats and life or nil,
            place = place > 0 and place or nil, ready = index == seat and ready}
    end
    render_standings(view)
    redraw()
end

local function receive_battle(_, values)
    if not source_ready then return end
    local stamp, round, left, right, outcome, board = table.unpack(values)
    if #board < 66 or round <= canonical_round or round < frame_round or match and round < match.round then return end
    if match and round == match.round and match.seat ~= left and match.seat ~= right then return end
    if round > frame_round then
        frames, frame_round, frame_index, following = {}, round, 0, true
        replay_playing, replay_elapsed = false, 0
    end
    local at = #frames + 1
    while at > 1 and frames[at - 1].stamp > stamp do at = at - 1 end
    if at > 1 and frames[at - 1].stamp == stamp then return end
    table.insert(frames, at, {stamp = stamp, left = left, right = right, outcome = outcome, board = board})
    if at <= frame_index then frame_index = frame_index + 1 end
    if #frames > 256 then table.remove(frames, 1); frame_index = math.max(1, frame_index - 1) end
    if following then frame_index = #frames end
    if match and round == match.round and match.phase >= 3 then paint_battle() end
end

local function decode_formation(wire)
    local count = wire[1]
    if math.type(count) ~= "integer" or count < 0 or count > native_catalog.rules.team_size
        or #wire ~= 1 + count * 6 then return nil end
    local team = {}
    for at = 2, #wire, 6 do
        local definition = native_catalog.pets[wire[at]]
        if not definition then return nil end
        team[#team + 1] = {id = definition.id, uid = wire[at + 1], attack = wire[at + 2],
            health = wire[at + 3], level = wire[at + 4]}
    end
    return team
end

local function receive_replay(_, values)
    if not source_ready or not match then return end
    local round, left, right, outcome, seed, first, second = table.unpack(values)
    if round < match.round or round < frame_round or round <= canonical_round
        or (match.seat ~= left and match.seat ~= right) then return end
    local left_team, right_team = decode_formation(first), decode_formation(second)
    if not left_team or not right_team then return end
    local ok, result = pcall(battle.resolve, left_team, right_team, seed, native_catalog)
    if not ok or (result.status == "strike_limit" and 4 or battle_codes[result.outcome]) ~= outcome then
        print(string.format("AUTO_PETS_M3 replay_mismatch round=%d", round))
        return
    end
    local resolved, board = {}, nil
    for _, event in ipairs(result.events) do
        board = event.board or board
        resolved[#resolved + 1] = {left = left, right = right, outcome = event.type == "result" and outcome or 0,
            teams = board, event = event}
    end
    frames, frame_round, frame_index, following, canonical_round = resolved, round, 1, false, round
    replay_playing, replay_elapsed = #resolved > 1, 0
    print(string.format("AUTO_PETS_M3 replay round=%d events=%d outcome=%d", round, #result.events, outcome))
    if match.round == round and match.phase >= 3 then paint_battle() end
end

local function buy(slot, is_reward)
    if not editable() then return end
    local code = math.abs((is_reward and preview.rewards or preview.pets)[slot] or 0)
    local target, unit = chosen()
    if code == 0 then return end
    if unit and unit.code == code then send(12, slot, target, is_reward and 1 or 0)
    else send(11, slot, target, is_reward and 1 or 0) end
end

local function choose(slot)
    inspected = {kind = "team", slot = slot}
    if not editable() or not preview.team[slot] then return end
    local picked = chosen()
    if not picked then selected = preview.team[slot].uid
    elseif picked == slot then selected = nil
    else
        send(merge and 15 or 14, picked, slot)
        selected, merge = nil, false
    end
end

local function button(path, callback)
    local control = object(path .. "/Hit")
    local run = function()
        if source_ready then callback(); redraw() end
    end
    control:AddCursorEventListener(click, run)
    bindings[#bindings + 1] = {control, run}
end

local function key(event, callback)
    local run = function()
        if not source_ready then return false end
        callback()
        redraw()
        return true
    end
    panel:AddKeyEventListener(event, run)
    keys[#keys + 1] = {event, run}
end

local function reroll()
    if editable() then send(10) end
end

local function ready_up()
    if not editable() then return end
    if #preview.team > 0 then send(1)
    else hint = "请先购买至少一只动物，再准备" end
end

local function scrub(offset)
    if not match or frame_round ~= match.round or #frames == 0 then return end
    replay_playing, replay_elapsed = false, 0
    following = offset == 0
    frame_index = following and #frames or math.min(#frames, math.max(1, frame_index + offset))
end

function OnStart(view_root)
    local root = view_root or script.object
    local function child(name) return assert(root:GetChild(name), name) end
    panel = child("Match")
    render_standings = standings.bind(child("Standings"), "room")
    latest, match, preview, selected, merge, reward, pending, forfeiting, hint = -1, nil, nil, nil, false, 1, nil, false, nil
    frames, frame_round, frame_index, following, canonical_round = {}, -1, 0, true, -1
    controls, bindings, keys, content, visibility = {}, {}, {}, {}, {}
    inspected = nil
    source_ready = true
    replay_playing, replay_elapsed = false, 0
    visible("Ready", false)
    visible("Forfeit", false)
    button("Shop/InspectReward", function() inspected = {kind = "reward", slot = reward} end)
    for slot = 1, 5 do
        button("Shop/InspectTeam" .. slot, function() inspected = {kind = "team", slot = slot} end)
        if slot <= 3 then
            button("Shop/InspectOffer" .. slot, function() inspected = {kind = "pet", slot = slot} end)
        end
        button("Shop/Offer" .. slot, function()
            if slot <= 3 then
                buy(slot, false)
            elseif editable() then
                local target = chosen()
                if target and preview.foods[slot - 3] ~= 0 then send(16, slot - 3, target) end
            end
        end)
        button("Shop/Freeze" .. slot, function()
            if not editable() then return end
            local is_pet = slot <= 3
            local code = is_pet and preview.pets[slot] or preview.foods[slot - 3]
            if code ~= 0 then send(17, is_pet and slot or slot - 3, is_pet and 0 or 1) end
        end)
        button("Shop/Team" .. slot, function() choose(slot) end)
    end
    button("Shop/Reroll", reroll)
    button("Shop/Sell", function()
        local slot = editable() and chosen()
        if slot then send(13, 0, slot); selected = nil end
    end)
    button("Shop/Merge", function() if editable() then merge = not merge end end)
    button("Shop/Reward", function() buy(reward, true) end)
    button("Shop/RewardNext", function()
        if editable() and #preview.rewards > 1 then reward = reward % #preview.rewards + 1 end
    end)
    button("Replay/Previous", function() scrub(-1) end)
    button("Replay/Forward", function() scrub(1) end)
    button("Replay/Auto", function()
        local frame = frames[frame_index]
        if not match or frame_round ~= match.round or not frame or not frame.event then return end
        if frame_index == #frames then frame_index = 1; replay_playing = true
        else replay_playing = not replay_playing end
        following, replay_elapsed = false, 0
    end)
    button("Replay/Follow", function() scrub(0) end)
    button("Refresh", refresh)
    button("Ready", ready_up)
    button("Forfeit", function()
        if not alive() or match.phase == 0 or match.phase >= 5 or pending then return end
        if forfeiting then send(3) else forfeiting = true end
    end)
    key(Enum.KeyEventType.KeyboardCharacterSkill1KeyDown, refresh)
    key(Enum.KeyEventType.KeyboardInteractKeyDown, ready_up)
    key(Enum.KeyEventType.KeyboardCharacterSkill2KeyDown, reroll)
    script:RegisterServerSignalHandler("AP_RoomView", receive_view)
    script:RegisterServerSignalHandler("AP_RoomBattle", receive_battle)
    script:RegisterServerSignalHandler("AP_RoomReplay", receive_replay)
    refresh()
end

function OnUpdate(dt)
    if not source_ready then return end
    if seconds then
        seconds = math.max(0, seconds - dt)
        draw_status()
    end
    if not replay_playing or not match or match.phase < 3 or frame_round ~= match.round then return end
    local frame = frames[frame_index]
    if not frame or not frame.event then return end
    replay_elapsed = replay_elapsed + dt
    if replay_elapsed < replay_view.duration(frame.event) then return end
    replay_elapsed = 0
    frame_index = math.min(#frames, frame_index + 1)
    replay_playing = frame_index < #frames
    paint_battle()
end

function OnDestroy()
    source_ready = false
    replay_playing, replay_elapsed = false, 0
    seconds = nil
    script:UnregisterServerSignalHandler("AP_RoomView")
    script:UnregisterServerSignalHandler("AP_RoomBattle")
    script:UnregisterServerSignalHandler("AP_RoomReplay")
    for _, item in ipairs(bindings) do
        if item[1].alive then item[1]:RemoveCursorEventListener(click, item[2]) end
    end
    if panel and panel.alive then
        for _, item in ipairs(keys) do panel:RemoveKeyEventListener(item[1], item[2]) end
    end
    controls, bindings, keys, content, visibility, frames = {}, {}, {}, {}, {}, {}
    render_standings, panel = nil, nil
end
