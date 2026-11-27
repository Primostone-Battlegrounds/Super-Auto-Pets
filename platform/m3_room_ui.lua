local animal_ability = require("autopets.animal_ability")
local phase_names = {[0] = "等待入席", "分配席位", "经营准备", "自动战斗", "回合结算", "对局终局", "计算名次"}
local result_names = {"本轮获胜", "本轮落败", "本轮平局", "本轮未分胜负"}
local battle = require("autopets.battle")
local replay_view = require("autopets.replay_view")
local decode_shop = require("autopets.shop_wire")
local shop_input = require("autopets.shop_input")
local shop_rules = {pet_slots = 3, food_slots = 2, team_size = 5}
local battle_codes = {win = 1, loss = 2, draw = 3}
local click = Enum.CursorEventType.CursorClick
local latest, match, preview, selected, merge, reward, pending, forfeiting, hint
local inspected, round_start_lives, reviewing_result
local render_standings, panel, portrait, badges, unified_layout
local shop_drag
local controls, bindings, keys, content, visibility = {}, {}, {}, {}, {}
local frames, frame_round, frame_index, following, canonical_round, seconds
local replay_playing, replay_elapsed, replay_speed = false, 0, 1
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
    local title = formal_room_ui and "点「技能」或「详情」查看" or "点动物旁的「技能」查看"
    local body = "查看不会购买或改变阵容"
    if picked.kind == "food" then
        local code = preview.foods[picked.slot]
        local food = native_catalog.foods[math.abs(code)]
        if food then
            title = string.format("%s · %d 阶食物 · %d 金", food.name, food.tier, native_catalog.rules.food_cost)
            body = string.format("目标 +%d攻 +%d命", food.attack, food.health)
            if food.adjacent_attack or food.adjacent_health then
                body = body .. string.format(" · 邻位 +%d攻 +%d命", food.adjacent_attack or 0, food.adjacent_health or 0)
            end
        end
        text("Shop/AbilityTitle", title)
        text("Shop/AbilityBody", body)
        return
    end
    local code, level, experience
    if picked.kind == "team" then
        local unit = preview and preview.team[picked.slot]
        code, level = unit and unit.code, unit and unit.level
        experience = unit and unit.xp
    else
        local shelf = preview and (picked.kind == "reward" and preview.rewards or preview.pets)
        code, level = shelf and shelf[picked.slot], 1
    end
    local pet = code and native_catalog.pets[math.abs(code)]
    if pet then
        title, body = animal_ability.describe(native_catalog, pet, level, true)
        if formal_room_ui then
            title = title .. string.format(" · %d 阶", pet.tier)
            if experience then
                local next_level = native_catalog.rules.level_xp[level + 1]
                body = body .. (next_level and string.format(" · 经验 %d/%d", experience, next_level) or " · 经验已满")
            else
                title = title .. string.format(" · %d 金", native_catalog.rules.pet_cost)
            end
        elseif badges and experience then body = body .. " · 经验 " .. experience end
    end
    text("Shop/AbilityTitle", title)
    text("Shop/AbilityBody", body)
end

local function paint_shop()
    if not preview or preview.round ~= match.round then return end
    text("Shop/Money", string.format("金币 %d · %d 阶 · 阵容 %d / 5 · 右侧为前排", preview.gold, preview.tier, #preview.team))
    paint_ability()
    local picked = chosen()
    if badges then
        badges.select("shop", object("Shop"), function(slot)
            local team = slot <= 5
            local offer = slot - 5
            local card = object("Shop/" .. (team and ("Team" .. slot) or ("Offer" .. offer)))
            local x, y = card:GetAnchoredPosition()
            local tx, ty = card:GetChild("Text"):GetAnchoredPosition()
            return x + tx, y + ty - (team and 28 or 25), x + (offer <= 3 and 42 or 47), y + 27
        end)
    end
    for slot = 1, 5 do
        local is_pet = slot <= 3
        local code = is_pet and preview.pets[slot] or preview.foods[slot - 3]
        local item = (is_pet and pets or foods)[math.abs(code)]
        if portrait then
            local definition = (is_pet and native_catalog.pets or native_catalog.foods)[math.abs(code)]
            portrait.shop(5 + slot, definition and definition.id)
        end
        local offer = "售罄"
        if badges then
            if is_pet or formal_room_ui then visible("Shop/InspectOffer" .. slot, item ~= nil) end
            local cost = is_pet and native_catalog.rules.pet_cost or native_catalog.rules.food_cost
            badges.paint(5 + slot, item and item.attack, item and item.health, item and cost, not is_pet)
            if item then offer = item.name end
        elseif item and portrait then
            offer = item.name .. "\n" .. replay_view.combat_values(item.attack, item.health, not is_pet)
        elseif item then
            local detail = is_pet and "%s\n%d 攻 · %d 命" or "%s\n+%d 攻 · +%d 命"
            offer = detail:format(item.name, item.attack, item.health)
        end
        local kind, index = is_pet and "pet" or "food", is_pet and slot or slot - 3
        if shop_drag and shop_drag.source(kind, index) then offer = "拖动中" end
        text("Shop/Offer" .. slot .. "/Text", offer)
        local frozen = code < 0
        text("Shop/Freeze" .. slot .. "/Text", frozen and (formal_room_ui and "已冻结 · 解冻" or "解冻") or "冻结")
        if formal_room_ui then visible("Shop/Freeze" .. slot, code ~= 0) end
        local unit = preview.team[slot]
        if portrait then
            local definition = unit and native_catalog.pets[unit.code]
            portrait.shop(slot, definition and definition.id)
        end
        local name = unit and pets[unit.code] and pets[unit.code].name or "空位 " .. slot
        local stats = ""
        if badges then
            visible("Shop/InspectTeam" .. slot, unit ~= nil)
            badges.paint(slot, unit and unit.attack, unit and unit.health)
            local mark = shop_drag and shop_drag.mark(slot) or 0
            object("Shop/Team" .. slot .. "/Surface").imageColor =
                mark == 2 and Color(104, 194, 168, 255) or mark == 1 and Color(125, 168, 133, 255)
                or picked == slot and Color(228, 176, 94, 255) or unit and Color(117, 140, 93, 255) or Color(80, 107, 76, 255)
            name = unit and (name .. " L" .. unit.level) or ""
        elseif unit then
            local values = portrait and replay_view.combat_values(unit.attack, unit.health)
                or string.format("%d攻 %d命", unit.attack, unit.health)
            stats = string.format("\n%s\nL%d · 经验%d", values, unit.level, unit.xp)
        end
        text("Shop/Team" .. slot .. "/Text", name .. stats)
    end
    reward = math.min(reward, math.max(#preview.rewards, 1))
    local item = pets[preview.rewards[reward]]
    if badges then visible("Shop/InspectReward", item ~= nil) end
    text("Shop/Reward/Text", shop_drag and shop_drag.source("reward", reward) and "拖动中"
        or item and string.format("%s %d/%d", item.name, reward, #preview.rewards)
        or badges and "暂无奖励" or "暂无升级奖励")
    text("Shop/Merge/Text", merge and "取消合并" or "合并队员")
    if formal_room_ui then visible("Shop/RewardNext", #preview.rewards > 1) end
    if unified_layout then
        text("Shop/Reroll/Text", shop_drag.waiting() and "取消拖放"
            or string.format("刷新 · %d 金", native_catalog.rules.reroll_cost))
    end
end

local function current_frame()
    local frame = frame_round == match.round and frames[frame_index]
    return frame and (frame.left == match.seat or frame.right == match.seat) and frame or nil
end

local function paint_battle()
    local frame = current_frame()
    local has_frame = frame ~= nil
    for _, name in ipairs({"Previous", "Forward", "Follow", "Ally", "Enemy"}) do
        visible("Replay/" .. name, has_frame)
    end
    visible("Replay/Auto", has_frame and frame.event ~= nil)
    if formal_room_ui then
        visible("Replay/Speed", has_frame and frame.event ~= nil and frame_index < #frames)
        text("Replay/Speed/Text", "倍速 · " .. replay_speed .. "x")
    end
    if badges then
        visible("Replay/OwnFront", has_frame)
        visible("Replay/EnemyFront", has_frame)
    end
    if has_frame and frame.event then
        text("Replay/Auto/Text", replay_playing and "暂停" or frame_index == #frames and "重播" or "继续")
        text("Replay/Follow/Text", frame.event and "跳过回放" or "追到最新")
    end
    if not has_frame then
        if badges then badges.hide() end
        text("Replay/Event", "")
        local opponent = match.opponents[match.seat]
        local result = result_names[match.results[match.seat]]
        if not result then
            if not alive() then result = "已淘汰"
            elseif match.phase == 5 then result = "本局已结束"
            elseif match.phase == 6 then result = "计算名次"
            elseif opponent == 0 then result = "本轮轮空"
            else result = "等待本轮战斗" end
        end
        text("Replay/RoundText", result)
        for slot = 1, 5 do
            text("Replay/Own" .. slot, "")
            text("Replay/Enemy" .. slot, "")
            if portrait then
                portrait.replay("Own" .. slot, nil, false)
                portrait.replay("Enemy" .. slot, nil, true)
            end
        end
        return
    end
    if badges then
        badges.select("replay", object("Replay"), function(slot)
            local label = object("Replay/" .. (slot <= 5 and ("Own" .. slot) or ("Enemy" .. (slot - 5))))
            local x, y = label:GetAnchoredPosition()
            return x, y - 39, x, y + 35
        end)
    end
    local allied_side = frame.left == match.seat and 0 or 1
    local opposing_seat = allied_side == 0 and frame.right or frame.left
    if badges then
        local primary, target = replay_view.cues(frame.event, frame.teams)
        badges.feedback(primary, target, allied_side == 0 and "player" or "enemy")
    end
    local board = frame.board
    for slot = 1, 5 do
        for side = 0, 1 do
            local name = side == allied_side and "Own" or "Enemy"
            local display, id, attacking = badges and "" or "空位", nil, false
            local attack, life
            if frame.teams then
                local key = side == 0 and "player" or "enemy"
                local unit = frame.teams[key][slot]
                if unit then
                    id, attack, life = unit.id, unit.attack, unit.health
                    local def = native_catalog.pet_by_id[unit.id] or native_catalog.token_by_id[unit.id]
                    local event = frame.event
                    if portrait then
                        display = badges and def.name .. ((unit.shield or 0) > 0 and ("\n盾 " .. unit.shield) or "")
                            or replay_view.stats(def.name, unit.attack, unit.health, unit.shield)
                        attacking = event and event.type == "attack" and event.uid == unit.uid and event.side == key
                    else
                        local marker = event and replay_view.mark(event, unit, key) or ""
                        display = string.format("%s%s\n%d攻 · %d命\n盾 %d", marker, def.name, unit.attack, unit.health, unit.shield)
                    end
                end
            elseif slot <= board[61 + side] then
                local head = board[63 + side]
                local offset = (side * 5 + (head + slot - 1) % 5) * 6 + 1
                local item = fighters[board[offset]] or pets[board[offset]]
                if item then
                    id, attack, life = item.id, board[offset + 1], board[offset + 2]
                    if badges then
                        display = item.name .. (board[offset + 4] > 0 and ("\n盾 " .. board[offset + 4]) or "")
                    elseif portrait then
                        display = replay_view.stats(item.name, board[offset + 1], board[offset + 2], board[offset + 4])
                    else
                        display = string.format("%s\n%d攻 · %d命\n盾 %d", item.name, board[offset + 1],
                            board[offset + 2], board[offset + 4])
                    end
                end
            end
            text("Replay/" .. name .. slot, display)
            if badges then badges.paint(name == "Own" and slot or 5 + slot, attack, life) end
            if portrait then portrait.replay(name .. slot, id, name == "Enemy", attacking, true) end
        end
    end
    local sides = allied_side == 0 and {player = "我方", enemy = "对方"} or {player = "对方", enemy = "我方"}
    text("Replay/Event", frame.event and replay_view.describe(frame.event, native_catalog, sides) or "")
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

local function paint_settlement()
    local place = match.places[match.seat] or 0
    local title = place == 1 and "冠军" or place > 0 and string.format("第 %d 名", place) or "本局已结束"
    local summary = string.format("共 %d 轮", match.round)
    if match.seat > 0 then summary = summary .. string.format(" · 剩余 %d 命", match.lives[match.seat]) end
    if match.winner > 0 and match.winner ~= match.seat then
        summary = summary .. string.format(" · 冠军为席位 %d", match.winner)
    end
    local frame = current_frame()
    local can_review = frame and frame.event ~= nil
    text("Settlement/Placement", title)
    text("Settlement/Summary", summary)
    text("Settlement/ReplayGuide", can_review and "" or "本局可在右侧查看完整排名")
    visible("ResultReplay", not not can_review)
    text("ResultReplay/Text", reviewing_result and "返回结算" or "回看最后一战")
end

local function redraw()
    if not match then return end
    draw_status()
    local shop_open = match.phase == 2 and preview ~= nil and alive()
    local settled = formal_room_ui and match.phase == 5
    local replay_open = match.phase >= 3 and match.seat > 0 and (not settled or reviewing_result)
    if portrait then portrait.view(shop_open and "shop" or (replay_open or not formal_room_ui) and "replay" or nil) end
    visible("Shop", shop_open)
    visible("Replay", replay_open)
    if formal_room_ui then
        visible("Settlement", settled and not reviewing_result)
        visible("Hint", not settled)
        if settled then paint_settlement() else visible("ResultReplay", false) end
    end
    local can_prepare = shop_open and not match.ready
    visible("Ready", can_prepare)
    if unified_layout then visible("Shop/Reroll", can_prepare) end
    visible("Forfeit", alive() and match.phase > 0 and match.phase < 5)
    text("Forfeit/Text", forfeiting and "确认认输" or "认输")
    if shop_open then paint_shop() end
    if replay_open then paint_battle() elseif badges and not shop_open then badges.hide() end
    local message = hint or (formal_room_ui and "" or "等待服务端推进")
    if pending then
        message = "正在确认操作，可点「同步」查看进度"
    elseif not hint and shop_open then
        local _, unit = chosen()
        local animal = unit and pets[unit.code]
        if match.ready then message = "已准备，等待其他席位"
        elseif animal then message = "已选 " .. animal.name .. " · 可喂食、出售、换位或合并"
        else message = unified_layout and "拖向高亮站位，或点选动物购买" or "点选队员后可喂食、出售、换位或合并" end
    elseif formal_room_ui and not hint and match.phase == 4 then
        local lives = match.lives[match.seat]
        if lives then
            local outcome = (round_start_lives or lives) > 0 and result_names[match.results[match.seat]]
            local life = round_start_lives and round_start_lives > lives and string.format("损失 %d 命 · ", round_start_lives - lives) or ""
            message = (outcome and outcome .. " · " or "") .. life .. string.format("剩余 %d 命", lives)
                .. (lives > 0 and "\n等待下一轮" or "\n已淘汰，等待最终排名")
        end
    elseif formal_room_ui and not hint and match.phase == 2 and match.seat > 0 then
        message = alive() and "正在准备商店" or "已淘汰，等待最终排名"
    elseif not hint and match.phase == 5 and not formal_room_ui then
        local place = match.places[match.seat]
        message = place and place > 0 and ("我的名次 · 第 " .. place .. " 名") or "本局已结束"
    end
    text("Hint", message)
end

local function level_up_message(before, after)
    if not before or not after or before.round ~= after.round then return end
    for _, unit in ipairs(after.team) do
        for _, previous in ipairs(before.team) do
            if unit.uid == previous.uid and unit.level > previous.level then
                local pet = native_catalog.pets[unit.code]
                local reward_message = #after.rewards > #before.rewards and " · 有升级奖励" or ""
                return string.format("%s 升至 L%d%s", pet.name, unit.level, reward_message)
            end
        end
    end
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
        reviewing_result = false
    elseif acknowledged and sequence == pending[3] then
        hint = "操作未生效，画面已同步"
    else
        hint = nil
    end
    if frame_round < round then
        frames, frame_round, frame_index, following = {}, round, 0, true
        replay_playing, replay_elapsed = false, 0
    end
    if not match or round ~= match.round then round_start_lives = nil end
    if phase == 1 or phase == 2 or phase == 3 then round_start_lives = round_start_lives or lives[seat] end
    if transitioned or acknowledged or pending and sequence > pending[3] then pending = nil end
    latest, forfeiting = revision, false
    match = {phase = phase, round = round, seat = seat, sequence = sequence, ready = ready, lives = lives,
        places = places, opponents = opponents, results = results, winner = winner}
    seconds = (phase == 2 or phase == 4) and remaining or nil
    local previous = preview
    preview = decode_shop(raw, shop_rules)
    if formal_room_ui and phase == 2 then hint = level_up_message(previous, preview) or hint end
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
    if match and round == match.round and match.phase >= 3 then redraw() end
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
    for index in ipairs(result.events) do
        local event = replay_view.event(result.events, index, native_catalog)
        board = event.board or board
        resolved[#resolved + 1] = {left = left, right = right, outcome = event.type == "result" and outcome or 0,
            teams = board, event = event}
    end
    frames, frame_round, frame_index, following, canonical_round = resolved, round, 1, false, round
    replay_playing, replay_elapsed, replay_speed = #resolved > 1, 0, 1
    print(string.format("AUTO_PETS_M3 replay round=%d events=%d outcome=%d", round, #result.events, outcome))
    if match.round == round and match.phase >= 3 then redraw() end
end

local function shop_action(kind, index, target, merging)
    local action, reason = shop_input.plan(editable() and preview, native_catalog.rules, kind, index, target, merging)
    if action then send(table.unpack(action, 1, 4)) else hint = reason end
end

local function buy(slot, is_reward)
    if unified_layout then shop_action(is_reward and "reward" or "pet", slot, chosen()); return end
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
    elseif unified_layout then
        shop_action("team", picked, slot, merge)
        if pending then selected, merge = nil, false end
    else
        send(merge and 15 or 14, picked, slot)
        selected, merge = nil, false
    end
end

local function button(path, callback, kind, index)
    local control = object(path .. "/Hit")
    local run = function()
        if source_ready then callback(); redraw() end
    end
    if shop_drag and kind then shop_drag.bind(control, kind, index, run); return end
    if shop_drag then
        local invoke = run
        run = function()
            if source_ready and not shop_drag.cancel() then invoke() end
        end
    end
    control:AddCursorEventListener(click, run)
    bindings[#bindings + 1] = {control, run}
end

local function key(event, callback)
    local run = function()
        if not source_ready then return false end
        if shop_drag and shop_drag.cancel() then return true end
        callback()
        redraw()
        return true
    end
    panel:AddKeyEventListener(event, run)
    keys[#keys + 1] = {event, run}
end

local function reroll()
    if not unified_layout then
        if editable() then send(10) end
        return
    end
    local ok, reason = shop_input.reroll(editable() and preview, native_catalog.rules.reroll_cost)
    if ok then send(10) else hint = reason end
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

function OnStart(view_root, painter, badge_pool)
    portrait = painter
    badges = bind_online_badges(badge_pool)
    unified_layout = view_root ~= nil
    local root = view_root or script.object
    local function child(name) return assert(root:GetChild(name), name) end
    panel = child("Match")
    render_standings = standings.bind(child("Standings"), "room")
    latest, match, preview, selected, merge, reward, pending, forfeiting, hint = -1, nil, nil, nil, false, 1, nil, false, nil
    frames, frame_round, frame_index, following, canonical_round = {}, -1, 0, true, -1
    controls, bindings, keys, content, visibility = {}, {}, {}, {}, {}
    inspected, round_start_lives, reviewing_result = nil, nil, false
    source_ready = true
    if unified_layout then
        if game.GetUICanvasSize then
            local width, height = game.GetUICanvasSize()
            local x, y = panel:GetAnchoredPosition()
            for _, name in ipairs({"Border", "Paper"}) do
                object(name):SetAnchoredPosition(-x, -y)
                object(name):SetSizeDelta(width, height)
            end
        end
        local targets = {}
        for slot = 1, 5 do
            local path = "Shop/Team" .. slot
            targets[slot] = {panel, object("Shop"), object(path), object(path .. "/Hit")}
        end
        shop_drag = shop_input.bind_drag(targets, {
            key = function() return editable() and (match.round .. ":" .. match.sequence) end,
            plan = function(kind, index, target)
                return shop_input.plan(editable() and preview, native_catalog.rules, kind, index, target)
            end,
            apply = function(action) send(table.unpack(action, 1, 4)) end,
            changed = function(message) hint = message; redraw() end,
        })
    end
    replay_playing, replay_elapsed, replay_speed = false, 0, 1
    visible("Ready", false)
    visible("Forfeit", false)
    button("Shop/InspectReward", function() inspected = {kind = "reward", slot = reward} end)
    for slot = 1, 5 do
        button("Shop/InspectTeam" .. slot, function() inspected = {kind = "team", slot = slot} end)
        local kind, index = slot <= 3 and "pet" or "food", slot <= 3 and slot or slot - 3
        if slot <= 3 or formal_room_ui then
            button("Shop/InspectOffer" .. slot, function() inspected = {kind = kind, slot = index} end)
        end
        button("Shop/Offer" .. slot, function()
            if slot <= 3 then
                buy(slot, false)
            elseif unified_layout then
                local target = chosen()
                shop_action("food", slot - 3, target)
            elseif editable() then
                local target = chosen()
                if target and preview.foods[slot - 3] ~= 0 then send(16, slot - 3, target) end
            end
        end, kind, function() return index end)
        button("Shop/Freeze" .. slot, function()
            if not editable() then return end
            local is_pet = slot <= 3
            local code = is_pet and preview.pets[slot] or preview.foods[slot - 3]
            if code ~= 0 then send(17, is_pet and slot or slot - 3, is_pet and 0 or 1)
            elseif unified_layout then hint = "这个货位没有商品" end
        end)
        button("Shop/Team" .. slot, function() choose(slot) end, "team", function() return slot end)
    end
    button("Shop/Reroll", reroll)
    button("Shop/Sell", function()
        local slot = editable() and chosen()
        if slot then send(13, 0, slot); selected = nil
        elseif unified_layout then hint = "请先选择要出售的队员" end
    end)
    button("Shop/Merge", function() if editable() then merge = not merge end end)
    button("Shop/Reward", function() buy(reward, true) end, "reward", function() return reward end)
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
    if formal_room_ui then
        button("Replay/Speed", function() replay_speed = replay_speed == 1 and 2 or 1 end)
        button("ResultReplay", function()
            local frame = match and match.phase == 5 and current_frame()
            if not frame or not frame.event then return end
            reviewing_result = not reviewing_result
            if reviewing_result then frame_index, replay_playing, replay_elapsed, replay_speed = 1, #frames > 1, 0, 1 end
        end)
    end
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
    if formal_room_ui and match.phase == 5 and not reviewing_result then return end
    local frame = frames[frame_index]
    if not frame or not frame.event then return end
    replay_elapsed = replay_elapsed + dt * replay_speed
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
    if shop_drag then shop_drag.destroy(); shop_drag = nil end
    for _, item in ipairs(bindings) do
        if item[1].alive then item[1]:RemoveCursorEventListener(click, item[2]) end
    end
    if panel and panel.alive then
        for _, item in ipairs(keys) do panel:RemoveKeyEventListener(item[1], item[2]) end
    end
    controls, bindings, keys, content, visibility, frames = {}, {}, {}, {}, {}, {}
    if badges then badges.restore() end
    render_standings, panel, portrait, badges = nil, nil, nil, nil
end
