local root, offers = script.object, script.object
local function child(name)
    local parent = name:match("^InspectTeam") and root:FindChild("TeamInspection") or root
    return assert(parent:GetChild(name), name)
end
local animal_ability = require("autopets.animal_ability")
local pet_presentation = require("autopets.pet_presentation")
local status = child("Status")
local market_gold = child("MarketGold")
local team_label = child("Team")
local leave_label = child("LeaveLabel")
local merge_label = child("MergeLabel")
local reward_label = child("RewardLabel")
local replay_label = child("ReplayLabel")
local replay_status = child("ReplayStatus")
local click = Enum.CursorEventType.CursorClick
local battle = require("autopets.battle")
local replay_view = require("autopets.replay_view")
local decode_shop = require("autopets.shop_wire")
local shop_input = require("autopets.shop_input")
local pets = {
    -- AP_DUEL_PETS
}
local foods = {
    -- AP_DUEL_FOODS
}
local rules = {
    -- AP_DUEL_RULES
}
local round = 0
local latest_version = 0
local sequence = 0
local next_token = 1
local pending
local preparing = false
local can_advance = false
local can_leave = false
local confirm_leave = false
local inspected, offer_pick
local selected_uid
local merge_mode = false
local reward_index = 1
local market
local playback, status_header, status_message, seconds, hint
local awaiting_settlement = false
local portrait, badges
local shop_drag
local draw_status
local visible = {}
local bindings = {}
local pet_labels, food_labels, team_labels = {}, {}, {}
local pet_freeze_labels, food_freeze_labels = {}, {}

local function show(control, enabled)
    if visible[control] == enabled then return end
    if enabled then control:SetActive(true) end
    control:SetVisible(enabled)
    if not enabled then control:SetActive(false) end
    visible[control] = enabled
end

local function show_action(action, label, enabled)
    show(child(action), enabled)
    show(child(action .. "Face"), enabled)
    show(child(label), enabled)
end

local function show_actions()
    if portrait then portrait.view(preparing and "shop" or "replay") end
    if offers ~= root then
        show(offers, preparing)
        show(market_gold, preparing)
    end
    for slot = 1, rules.team_size do show(child("Team" .. slot), preparing) end
    for _, binding in ipairs({{"Reroll", "RerollLabel"}, {"Sell", "SellLabel"}, {"Merge", "MergeLabel"},
        {"Reward", "RewardLabel"}, {"RewardNext", "RewardNextLabel"}}) do
        show_action(binding[1], binding[2], preparing and (not portrait or binding[1] == "Reroll"))
    end
    for slot = 1, rules.pet_slots do
        for _, suffix in ipairs({"", "Face", "Label"}) do
            show(offers:GetChild("InspectPet" .. slot .. suffix), preparing)
        end
    end
    for slot = 1, rules.team_size do
        show_action("InspectTeam" .. slot, "InspectTeam" .. slot .. "Label", preparing)
    end
    show_action("InspectReward", "InspectRewardLabel", preparing)
    show(child("AbilityTitle"), preparing)
    show(child("AbilityBody"), preparing)
    show_action("Ready", "ReadyLabel", preparing)
    show_action("Advance", "AdvanceLabel", can_advance)
    show_action("Leave", "LeaveLabel", can_leave)
end

local function transmit(command)
    local signal = game.ServerSignal("AP_DuelRequest")
    signal:AddInt(command.action)
    signal:AddInt(command.round)
    signal:AddInt(command.sequence)
    signal:AddInt(command.token)
    signal:AddInt(command.from)
    signal:AddInt(command.to)
    signal:AddInt(command.flag)
    signal:SendSignal()
end

local function send(action, from, to, flag)
    if pending or sequence == 0 then return end
    hint = nil
    pending = {action = action, round = round, sequence = sequence, token = next_token,
        from = from or 0, to = to or 0, flag = flag or 0}
    next_token = next_token + 1
    transmit(pending)
end

local function request_snapshot()
    transmit(pending or {action = 0, round = round, sequence = 0, token = 0, from = 0, to = 0, flag = 0})
end

local function current_market()
    if market and market.round == round then return market end
end

local function editable_market()
    local view = current_market()
    if preparing and view and view.version == latest_version and not pending then return view end
end

local function selected_slot(view)
    if selected_uid then
        for slot, unit in ipairs(view.team) do
            if unit.uid == selected_uid then return slot end
        end
    end
end

local function render_ability(view)
    local picked = inspected or {kind = "pet", slot = 1}
    local code, level, experience, unit
    if picked.kind == "team" then
        unit = view and view.team[picked.slot]
        code, level = unit and unit.code, unit and unit.level
        experience = unit and unit.xp
    else
        local shelf = view and (picked.kind == "reward" and view.rewards
            or picked.kind == "food" and view.foods or view.pets)
        code, level = shelf and shelf[picked.slot], 1
    end
    local food = picked.kind == "food"
    local item = code and (food and native_catalog.foods or native_catalog.pets)[math.abs(code)]
    local title, body = "选择一项商品或队员查看", "查看详情不会花费金币"
    if item then
        if portrait and food then title, body = pet_presentation.food(item)
        elseif portrait then title, body = pet_presentation.animal(native_catalog, item, unit)
        else title, body = animal_ability.describe(native_catalog, item, level, true) end
    end
    if portrait and unit then body = body .. "\n" .. pet_presentation.level(unit, native_catalog.rules.level_xp)
    elseif badges and experience then body = body .. "\n经验 " .. experience end
    if portrait then title = title:gsub("(.*) · (.+)", "%1\n%2") end
    child("AbilityTitle").text, child("AbilityBody").text = title, body
end

local function render_market()
    local view = current_market()
    render_ability(view)
    if badges then
        for slot = 1, rules.team_size do
            local name = "InspectTeam" .. slot
            show_action(name, name .. "Label", preparing and view ~= nil and view.team[slot] ~= nil)
        end
        for slot = 1, rules.pet_slots do
            local name = "InspectPet" .. slot
            local available = preparing and view ~= nil and view.pets[slot] ~= 0
            for _, suffix in ipairs({"", "Face", "Label"}) do show(offers:GetChild(name .. suffix), available) end
        end
        show_action("InspectReward", "InspectRewardLabel", preparing and view ~= nil and #view.rewards > 0)
    end
    local shop_badges = badges and preparing
    if portrait then
        local picked = view and selected_slot(view)
        local inspected_kind = inspected and inspected.kind
        local function freeze_visibility(kind, index, code)
            local path = "Freeze" .. kind .. index
            local shown = preparing and code ~= 0 and inspected_kind == kind:lower() and inspected.slot == index
            show(offers:GetChild(path), shown)
            show(offers:GetChild(path .. "Face"), shown)
            show(offers:GetChild("Freeze" .. kind .. "Label" .. index), shown)
        end
        for slot = 1, rules.pet_slots do freeze_visibility("Pet", slot, view and view.pets[slot] or 0) end
        for slot = 1, rules.food_slots do
            local code = view and view.foods[slot] or 0
            freeze_visibility("Food", slot, code)
            show(offers:GetChild("FoodTier" .. slot), preparing and code ~= 0)
        end
        local count = view and #view.rewards or 0
        show_action("Sell", "SellLabel", preparing and picked ~= nil)
        if picked then
            local x = team_labels[picked]:GetAnchoredPosition()
            for _, name in ipairs({"Sell", "SellFace", "SellLabel"}) do
                local action = child(name)
                local _, y = action:GetAnchoredPosition()
                action:SetAnchoredPosition(x, y)
            end
        end
        show_action("Reward", "RewardLabel", preparing and count > 0)
        show_action("RewardNext", "RewardNextLabel", preparing and count > 1)
    end
    if shop_badges then
        badges.select("shop", offers, function(slot)
            if slot <= 5 then
                local x, y = team_labels[slot]:GetAnchoredPosition()
                return x, y - 28
            end
            local offer = slot - 5
            local pet = offer <= 3
            local control = pet and pet_labels[offer] or food_labels[offer - 3]
            local x, y = control:GetAnchoredPosition()
            return x, y - 25, x + 52, y + (portrait and 83 or 45)
        end)
    end
    if not view then
        if shop_badges then
            for slot = 1, 10 do badges.paint(slot) end
        end
        if portrait and preparing then
            for slot = 1, rules.team_size + rules.pet_slots + rules.food_slots do portrait.shop(slot, nil) end
        end
        market_gold.text = portrait and "商店准备中…" or "同步商店中"
        team_label.text = "阵容 —"
        reward_label.text = "升级奖励"
        for slot, label in ipairs(team_labels) do
            label.text = badges and "" or string.format("阵位 %d  ·  空", slot)
        end
        for slot, label in ipairs(pet_labels) do
            label.text = "—"
            pet_freeze_labels[slot].text = "冻结"
        end
        for slot, label in ipairs(food_labels) do
            label.text = "—"
            food_freeze_labels[slot].text = "冻结"
        end
        return
    end

    market_gold.text = portrait and string.format("金币 %d", view.gold) or string.format("金币 %d  ·  第 %d 阶", view.gold, view.tier)
    if portrait then
        child("RerollLabel").text = shop_drag and shop_drag.waiting() and "取消拖放"
            or string.format("刷新 · %d 金\n%s", native_catalog.rules.reroll_cost, pet_presentation.tier(view.tier))
    end
    local picked = selected_slot(view)
    if not picked then selected_uid = nil end
    local price = string.format("购买 %d 金", rules.pet_cost)
    local footer = price
    if view.version ~= latest_version then
        footer = portrait and "商店更新中…" or "等待同步"
    elseif not preparing then
        footer = "本轮已锁定"
    elseif view.gold < rules.pet_cost then
        footer = "金币不足"
    elseif #view.team == rules.team_size and not picked then
        footer = "阵容已满"
    end
    if portrait and footer ~= price then
        market_gold.text = market_gold.text .. "  ·  " .. footer
    end
    for slot, label in ipairs(pet_labels) do
        local code = view.pets[slot]
        local pet = pets[math.abs(code)]
        if portrait then
            local animal = native_catalog.pets[math.abs(code)]
            portrait.shop(rules.team_size + slot, animal and animal.id)
            if animal then offers:GetChild("InspectPet" .. slot .. "Label").text = pet_presentation.tier(animal) end
            if shop_badges then badges.paint(rules.team_size + slot, pet and pet.attack, pet and pet.health, pet and rules.pet_cost) end
            label.text = pet and (badges and pet.name or string.format("%s\n%s\n%d金", pet.name,
                replay_view.combat_values(pet.attack, pet.health), rules.pet_cost)) or "售罄"
            if shop_drag and shop_drag.source("pet", slot) then label.text = "拖动中" end
        else
            label.text = pet and string.format("%s\n攻%d / 命%d · %s", pet.name, pet.attack, pet.health, footer) or "售罄"
        end
        pet_freeze_labels[slot].text = code < 0 and "解冻动物" or "冻结动物"
    end
    for slot, label in ipairs(food_labels) do
        local code = view.foods[slot]
        local food = foods[math.abs(code)]
        if portrait then
            local item = native_catalog.foods[math.abs(code)]
            portrait.shop(rules.team_size + rules.pet_slots + slot, item and item.id)
            if item then offers:GetChild("FoodTier" .. slot).text = pet_presentation.tier(item) end
            if shop_badges then
                badges.paint(rules.team_size + rules.pet_slots + slot, food and food.attack, food and food.health,
                    food and rules.food_cost, true)
            end
            label.text = food and (badges and food.name or string.format("%s\n%s\n%d金", food.name,
                replay_view.combat_values(food.attack, food.health, true), rules.food_cost)) or "售罄"
            if shop_drag and shop_drag.source("food", slot) then label.text = "拖动中" end
        else
            label.text = food and string.format("%s\n+%d攻 / +%d命 · %d 金",
                food.name, food.attack, food.health, rules.food_cost) or "售罄"
        end
        food_freeze_labels[slot].text = code < 0 and "解冻食物" or "冻结食物"
    end
    for slot, label in ipairs(team_labels) do
        local unit = view.team[slot]
        if portrait then
            local animal = unit and native_catalog.pets[unit.code]
            portrait.shop(slot, animal and animal.id)
            local mark = shop_drag and shop_drag.mark(slot) or 0
            local planned
            if offer_pick then
                planned = shop_input.plan(editable_market(), native_catalog.rules, offer_pick.kind, offer_pick.slot, slot)
            elseif picked then
                planned = shop_input.plan(editable_market(), native_catalog.rules, "team", picked, slot)
            end
            local combining = planned and (planned[1] == 15 or planned[1] == 12)
            if unit then
                child("InspectTeam" .. slot .. "Label").text =
                    (combining and "→ " or "") .. pet_presentation.level(unit, native_catalog.rules.level_xp)
            end
            local face = mark == 2 and Color(104, 194, 168, 255) or mark == 1 and Color(125, 168, 133, 255)
                or combining and Color(206, 177, 94, 255)
                or slot == picked and Color(228, 176, 94, 255)
                or unit and Color(117, 140, 93, 255) or Color(80, 107, 76, 255)
            child("Team" .. slot .. "Face").imageColor = face
            if shop_badges then badges.paint(slot, unit and unit.attack, unit and unit.health) end
        end
        if unit then
            local pet = pets[unit.code]
            local name = pet and pet.name or "动物"
            if badges then
                label.text = portrait and name or string.format("%s\nL%d", name, unit.level)
            elseif portrait then
                label.text = string.format("%s\n%s\nL%d · 经验%d", name,
                    replay_view.combat_values(unit.attack, unit.health), unit.level, unit.xp)
            else
                local prefix = slot == picked and "已选 · " or ""
                label.text = string.format("%s%s\n%d/%d · Lv%d 经验%d", prefix, name, unit.attack, unit.health, unit.level, unit.xp)
            end
        else
            label.text = badges and "" or string.format("阵位 %d  ·  空", slot)
        end
    end
    team_label.text = string.format("阵容 %d / %d · 右侧为前排", #view.team, rules.team_size)
    if portrait and picked then
        local animal = pets[view.team[picked].code]
        team_label.text = team_label.text .. " · 已选 " .. (animal and animal.name or "动物")
    end
    if reward_index > #view.rewards then reward_index = 1 end
    local reward = pets[view.rewards[reward_index]]
    local reward_tier = portrait and reward and pet_presentation.tier(native_catalog.pets[view.rewards[reward_index]])
    reward_label.text = reward and (reward_tier and (reward.name .. " · " .. reward_tier)
        or string.format("奖励 %d/%d · %s", reward_index, #view.rewards, reward.name)) or "暂无升级奖励"
    if shop_drag and shop_drag.source("reward", reward_index) then reward_label.text = "拖动中" end
end

local function shop_action(kind, slot, target, merging)
    local action, reason = shop_input.plan(editable_market(), native_catalog.rules, kind, slot, target, merging)
    if action then
        send(table.unpack(action, 1, 4))
    elseif portrait then
        hint = reason
        draw_status()
    end
end

local function acquire(slot, reward)
    local view = editable_market()
    if portrait then shop_action(reward and "reward" or "pet", slot, view and selected_slot(view)); return end
    if not view or view.gold < rules.pet_cost then return end
    local shelf = reward and view.rewards or view.pets
    local code = math.abs(shelf[slot] or 0)
    if code == 0 then return end
    local picked = selected_slot(view)
    if picked and view.team[picked].code == code and view.team[picked].level < rules.max_level then
        send(12, slot, picked, reward and 1 or 0)
    elseif #view.team < rules.team_size then
        send(11, slot, picked or 0, reward and 1 or 0)
    end
end

local function feed(slot)
    local view = editable_market()
    if portrait then
        inspected = {kind = "food", slot = slot}
        local target = view and selected_slot(view)
        if target then shop_action("food", slot, target)
        elseif view and view.foods[slot] ~= 0 then offer_pick = inspected end
        render_market()
        return
    end
    if not view or view.gold < rules.food_cost or view.foods[slot] == 0 then return end
    local picked = selected_slot(view)
    if picked then send(16, slot, picked) end
end

local function freeze(slot, food)
    local view = editable_market()
    if not view then return end
    local shelf = food and view.foods or view.pets
    if shelf[slot] ~= 0 then send(17, slot, food and 1 or 0)
    elseif portrait then hint = "这个货位没有商品"; draw_status() end
end

local function select_unit(slot)
    local view = editable_market()
    if portrait and view and offer_pick then
        shop_action(offer_pick.kind, offer_pick.slot, slot)
        if pending then offer_pick = nil end
        render_market()
        return
    end
    inspected = {kind = "team", slot = slot}
    if not view or not view.team[slot] then return end
    local picked = selected_slot(view)
    if not picked then
        selected_uid = view.team[slot].uid
    elseif picked == slot then
        selected_uid = nil
    elseif portrait then
        shop_action("team", picked, slot)
        if pending then selected_uid, merge_mode = nil, false; merge_label.text = "合并模式" end
    elseif not merge_mode or view.team[picked].code == view.team[slot].code
        and view.team[slot].level < rules.max_level then
        send(merge_mode and 15 or 14, picked, slot)
        selected_uid = nil
        merge_mode = false
        merge_label.text = "合并模式"
    end
    render_market()
end

local function inspect_offer(kind, slot)
    if portrait and offer_pick and offer_pick.kind == kind and offer_pick.slot == slot then
        offer_pick = nil
        hint = nil
    elseif portrait and editable_market() then
        offer_pick = {kind = kind, slot = slot}
        selected_uid = nil
        hint = "点选阵位购买，同种动物将合并"
    end
    inspected = {kind = kind, slot = slot}
    render_market()
    if portrait then draw_status() end
end

local function submit_ready()
    local view = editable_market()
    if not view then return end
    if #view.team > 0 then send(1)
    else
        hint = "请先购买至少一只动物，再准备"
        draw_status()
    end
end

local function request_advance()
    if can_advance then send(2) end
end

local function forfeit()
    if not can_leave or pending then return end
    if confirm_leave then
        send(6)
    else
        confirm_leave = true
        leave_label.text = "确认认输"
    end
end

local function bind(name, callback, parent, kind, index)
    bindings[#bindings + 1] = {object = (parent or root):GetChild(name), callback = callback, kind = kind, index = index}
end

-- These controls belong to the reward shelf during preparation. In the unified
-- view they can be reused when the shelf is hidden, without adding hit areas.
local replay_controls = {
    {name = "Reward", x = 0},
    {name = "RewardNext", x = 164},
}
local function show_replay_controls(enabled)
    if offers == root then return end
    for _, button in ipairs(replay_controls) do
        local caption = child(button.name .. "Label")
        if enabled and not button.positions then
            button.positions = {}
            button.shop_caption = caption.text
            for _, suffix in ipairs({"", "Face", "Label"}) do
                local control = child(button.name .. suffix)
                local x, y = control:GetAnchoredPosition()
                local width, height = control:GetSizeDelta()
                button.positions[suffix] = {x, y, width, height}
                control:SetAnchoredPosition(button.x, 218)
                control:SetSizeDelta(144, 82)
            end
        elseif not enabled and button.positions then
            for suffix, position in pairs(button.positions) do
                local control = child(button.name .. suffix)
                control:SetAnchoredPosition(position[1], position[2])
                control:SetSizeDelta(position[3], position[4])
            end
            if caption.text == button.battle_caption then caption.text = button.shop_caption end
            button.positions = nil
        end
        if enabled then
            button.battle_caption = button.name == "Reward" and replay_view.speed_caption(playback.speed) or "跳过"
            caption.text = button.battle_caption
        end
        show_action(button.name, button.name .. "Label", enabled or preparing)
    end
end

local function show_replay()
    draw_status()
    local replay_available = not preparing or offers == root
    show(replay_status, replay_available)
    show_action("Replay", "ReplayLabel", replay_available and playback ~= nil)
    show_replay_controls(not preparing and playback ~= nil and playback.position < #playback.events)
    local board_root = child("ReplayBoard")
    show(board_root, playback ~= nil and not preparing)
    local replay_badges = badges and not preparing and playback
    if replay_badges then
        badges.select("replay", board_root, function(slot)
            local label = board_root:GetChild(slot <= 5 and ("Own" .. slot) or ("Enemy" .. (slot - 5)))
            local x, y = label:GetAnchoredPosition()
            return x, y - 40, x, y + 34
        end)
    elseif badges and not preparing then badges.hide() end
    for slot = 1, rules.team_size do
        show_action("Team" .. slot, "TeamLabel" .. slot, preparing)
    end
    show(team_label, preparing)
    if offers == root then
        -- Standalone compatibility UI has no MarketOffers parent to hide.
        for slot = 1, rules.pet_slots do
            show_action("Buy" .. slot, "OfferLabel" .. slot, preparing)
            show_action("FreezePet" .. slot, "FreezePetLabel" .. slot, preparing)
        end
        for slot = 1, rules.food_slots do
            show_action("Food" .. slot, "FoodLabel" .. slot, preparing)
            show_action("FreezeFood" .. slot, "FreezeFoodLabel" .. slot, preparing)
        end
    end
    if not playback then
        replay_status.text = portrait and "战斗即将开始" or "等待战斗回放"
        replay_label.text = portrait and "继续" or "回放"
        return
    end
    local event = replay_view.event(playback.events, playback.position, native_catalog)
    playback.board = replay_view.board(playback.events, playback.position)
    if replay_badges then
        local primary, target = replay_view.cues(event, playback.board)
        badges.feedback(primary, target, "player")
    end
    for side, key in ipairs({"player", "enemy"}) do
        for slot = 1, rules.team_size do
            local unit = playback.board[key][slot]
            local display = badges and "" or portrait and "—" or "空位"
            if unit then
                local definition = native_catalog.pet_by_id[unit.id] or native_catalog.token_by_id[unit.id]
                if badges then
                    display = definition.name .. "\n" .. pet_presentation.level(unit)
                elseif portrait then
                    display = replay_view.stats(definition.name, unit.attack, unit.health, unit.shield)
                else
                    local seat = slot == 1 and (side == 1 and "席1 · 前排\n" or "席2 · 前排\n") or ""
                    display = seat .. replay_view.mark(event, unit, key) .. definition.name
                        .. string.format("\n%d攻 · %d命\n盾 %d", unit.attack, unit.health, unit.shield or 0)
                end
            end
            local path = (side == 1 and "Own" or "Enemy") .. slot
            board_root:GetChild(path).text = display
            if replay_badges then
                badges.paint((side - 1) * rules.team_size + slot, unit and unit.attack, unit and unit.health,
                    nil, false, unit and unit.shield)
            end
            if portrait then
                local attacking = unit and event.type == "attack" and event.uid == unit.uid and event.side == key
                portrait.replay(path, unit and unit.id, side == 2, attacking, true)
            end
        end
    end
    local description = replay_view.describe(event, native_catalog)
    replay_status.text = portrait and description or string.format("第 %d 轮  %d/%d  %s",
        playback.round, playback.position, #playback.events, description)
    replay_label.text = portrait and replay_view.toggle_caption(playback.playing, playback.position == #playback.events)
        or playback.playing and "暂停" or playback.position == #playback.events and "重播" or "继续"
end

local function decode_formation(wire)
    if #wire % 5 ~= 0 or #wire > 5 * rules.team_size then return nil end
    local team = {}
    for at = 1, #wire, 5 do
        local definition = native_catalog.pets[wire[at]]
        if not definition then return nil end
        team[#team + 1] = {id = definition.id, uid = wire[at + 1], attack = wire[at + 2],
            health = wire[at + 3], level = wire[at + 4]}
    end
    return team
end

local function receive_replay(_, parameters)
    local battle_round, seed, outcome, first, second = table.unpack(parameters)
    if (playback and battle_round <= playback.round) or battle_round < round - 1 then return end
    local left, right = decode_formation(first), decode_formation(second)
    if not left or not right then return end
    local ok, result = pcall(battle.resolve, left, right, seed, native_catalog)
    local codes = {win = 1, loss = 2, draw = 3}
    if not ok or result.status ~= "resolved" or codes[result.outcome] ~= outcome then
        replay_status.text = portrait and "暂时无法显示本轮战斗" or "回放校验失败"
        print(string.format("AUTO_PETS_M2 replay_mismatch round=%d", battle_round))
        return
    end
    playback = {round = battle_round, events = result.events, position = 1, elapsed = 0, playing = true, speed = 1}
    print(string.format("AUTO_PETS_M2 replay round=%d events=%d outcome=%d", battle_round, #result.events, outcome))
    show_replay()
end

local function skip_battle()
    if not playback or preparing or offers == root then return end
    playback.position = #playback.events
    playback.elapsed, playback.playing = 0, false
    show_replay()
end

bind("Replay", function()
    if not playback then return end
    if playback.position == #playback.events then
        playback.position = 1
        playback.elapsed = 0
        playback.playing = true
    else
        playback.playing = not playback.playing
    end
    show_replay()
end)

bind("Refresh", request_snapshot)
bind("Ready", submit_ready)
bind("Advance", request_advance)
bind("Leave", forfeit)
bind("Reroll", function()
    if not portrait then
        if editable_market() then send(10) end
        return
    end
    local ok, reason = shop_input.reroll(editable_market(), native_catalog.rules.reroll_cost)
    if ok then send(10) else hint = reason; draw_status() end
end)
bind("Sell", function()
    local view = editable_market()
    local slot = view and selected_slot(view)
    if slot then
        send(13, 0, slot)
        selected_uid = nil
        render_market()
    elseif portrait then
        hint = "请先选择要出售的队员"
        draw_status()
    end
end)
bind("Merge", function()
    if editable_market() then
        merge_mode = not merge_mode
        merge_label.text = merge_mode and "取消合并" or "合并模式"
    end
end)
bind("Reward", function()
    if preparing then acquire(reward_index, true)
    elseif playback and offers ~= root and playback.position < #playback.events then
        playback.speed = replay_view.next_speed(playback.speed)
        show_replay()
    end
end, nil, "reward", function() return reward_index end)
bind("RewardNext", function()
    if not preparing then skip_battle(); return end
    local view = editable_market()
    if view and #view.rewards > 1 then
        reward_index = reward_index % #view.rewards + 1
        render_market()
    end
end)

bind("InspectReward", function()
    inspect_offer("reward", reward_index)
end)
for slot = 1, rules.pet_slots do
    bind("InspectPet" .. slot, function() inspect_offer("pet", slot) end, offers)
    pet_labels[slot] = offers:GetChild("OfferLabel" .. slot)
    pet_freeze_labels[slot] = offers:GetChild("FreezePetLabel" .. slot)
    bind("Buy" .. slot, function() acquire(slot, false) end, offers, "pet", function() return slot end)
    bind("FreezePet" .. slot, function() freeze(slot, false) end, offers)
end
for slot = 1, rules.food_slots do
    food_labels[slot] = offers:GetChild("FoodLabel" .. slot)
    food_freeze_labels[slot] = offers:GetChild("FreezeFoodLabel" .. slot)
    bind("Food" .. slot, function() feed(slot) end, offers, "food", function() return slot end)
    bind("FreezeFood" .. slot, function() freeze(slot, true) end, offers)
end
for slot = 1, rules.team_size do
    bind("InspectTeam" .. slot, function()
        offer_pick = nil
        inspected = {kind = "team", slot = slot}
        render_market()
    end, root:FindChild("TeamInspection"))
    team_labels[slot] = root:GetChild("TeamLabel" .. slot)
    bind("Team" .. slot, function() select_unit(slot) end, nil, "team", function() return slot end)
end

local function receive_market(_, parameters)
    local market_round, version, raw = table.unpack(parameters)
    if market_round < round or version < latest_version or (market and version <= market.version) then return end
    local view = decode_shop(raw, rules)
    local before = market
    offer_pick = nil
    market = view
    if not view then render_market(); return end
    view.round, view.version = market_round, version
    if portrait then
        hint = pet_presentation.level_up(before, view, native_catalog) or hint
        draw_status()
    end
    print(string.format("AUTO_PETS_M2 market round=%d gold=%d team=%d version=%d", market_round, view.gold, #view.team, version))
    render_market()
end

draw_status = function()
    if not status_header then return end
    local message = status_message
    if awaiting_settlement and playback and playback.round == round then
        if playback.position == #playback.events then
            message = portrait and "战斗结束 · 等待结算" or "回放结束 · 等待结算"
        else
            message = portrait and (playback.playing and "战斗中" or "已暂停")
                or (playback.playing and "正在播放本轮战斗" or "本轮回放已暂停")
        end
    end
    local suffix = seconds and string.format(" · 余 %d 秒", math.ceil(seconds)) or ""
    local feedback = portrait and pending and "正在确认操作…" or hint
    if not feedback and portrait and preparing then feedback = "拖向高亮站位，或点选动物购买" end
    local content = status_header .. "\n" .. message .. suffix .. (feedback and ("\n" .. feedback) or "")
    if status.text ~= content then status.text = content end
end

local function receive_snapshot(_, parameters)
    local players, seat, new_round, phase, is_ready, continued, settlements, version,
        next_sequence, winner, reason, remaining, ack, lives, opponent_lives, outcome = table.unpack(parameters)
    local acknowledged = pending and pending.token == ack
    local rejected = acknowledged and new_round == pending.round and next_sequence == pending.sequence
    if acknowledged then pending = nil end
    if new_round < round or version <= latest_version then return end
    if pending and (new_round > pending.round or next_sequence > pending.sequence or phase == 2) then pending = nil end
    if new_round > round then reward_index, inspected, offer_pick = 1, nil, nil end
    hint = rejected and (portrait and "操作未生效" or "操作未生效，已同步服务端状态") or nil
    latest_version = version
    round = new_round
    sequence = next_sequence
    confirm_leave = false
    leave_label.text = "认输"
    preparing = players == 2 and seat > 0 and phase == 0 and not is_ready
    can_advance = players == 2 and seat > 0 and phase == 1 and not continued
    can_leave = seat > 0 and phase ~= 2
    local message = "等待第 2 位玩家"
    if phase == 2 then
        if winner == 0 then
            message = "对局平局"
        else
            message = winner == seat and "本席获胜" or "对局已结束，本席告负"
        end
    elseif seat > 0 and players < 2 then
        message = "等待原席位返回"
    elseif players == 2 then
        if phase == 0 then
            message = is_ready and "已准备，等待对手" or "双方已入场"
        elseif phase == 3 then
            message = portrait and "战斗即将开始" or "双方已锁定 · 战斗计算中"
        else
            local round_result = outcome == 3 and "本轮平局" or outcome == seat and "本轮获胜" or "本轮失利"
            message = round_result .. (continued and " · 已确认" or " · 确认下一轮")
        end
    end
    local seat_text = seat > 0 and string.format("席位 %d", seat) or "等候席位"
    status_header = string.format("%s  ·  第 %d 轮  ·  生命 %d / 对手 %d", seat_text, round, lives, opponent_lives)
    status_message = message
    awaiting_settlement = players == 2 and seat > 0 and phase == 3
    seconds = players == 2 and seat > 0 and (phase == 0 or phase == 1) and math.max(0, remaining) or nil
    show_actions()
    print(string.format("AUTO_PETS_M2 seat=%d players=%d round=%d phase=%d ready=%s continued=%s settlements=%d version=%d",
        seat, players, round, phase, tostring(is_ready), tostring(continued), settlements, version))
    print(string.format("AUTO_PETS_M2 sequence=%d winner=%d reason=%d remaining=%d", sequence, winner, reason, remaining))
    render_market()
    show_replay()
end

function OnStart(_, painter, badge_pool)
    portrait = painter
    badges = bind_online_badges(badge_pool)
    if portrait then
        if game.GetUICanvasSize then child("Background"):SetSizeDelta(game.GetUICanvasSize()) end
        local targets = {}
        for slot = 1, rules.team_size do
            local hit = child("Team" .. slot)
            targets[slot] = {hit}
        end
        shop_drag = shop_input.bind_drag(targets, {
            key = function()
                local view = editable_market()
                return view and (round .. ":" .. sequence)
            end,
            plan = function(kind, index, target)
                return shop_input.plan(editable_market(), native_catalog.rules, kind, index, target)
            end,
            apply = function(action) send(table.unpack(action, 1, 4)) end,
            inspect = function(kind, slot)
                if current_market() and not offer_pick then
                    inspected = {kind = kind, slot = slot}
                    render_market()
                end
            end,
            changed = function(message)
                hint = message
                render_market()
                draw_status()
            end,
        })
    end
    script:RegisterServerSignalHandler("AP_DuelSnapshot", receive_snapshot)
    script:RegisterServerSignalHandler("AP_DuelMarket", receive_market)
    script:RegisterServerSignalHandler("AP_DuelReplay", receive_replay)
    for _, binding in ipairs(bindings) do
        if shop_drag and binding.kind then
            shop_drag.bind(binding.object, binding.kind, binding.index, binding.callback)
        else
            binding.listener = function()
                if not shop_drag or not shop_drag.cancel() then binding.callback() end
            end
            binding.object:AddCursorEventListener(click, binding.listener)
        end
    end
    render_market()
    show_actions()
    show_replay()
    request_snapshot()
end

function OnUpdate(dt)
    if seconds then
        seconds = math.max(0, seconds - dt)
        draw_status()
    end
    if not playback or not playback.playing then return end
    local old_position = playback.position
    playback.position, playback.elapsed = replay_view.advance_clock(old_position, playback.elapsed, dt,
        playback.speed, #playback.events, function(index) return replay_view.duration(playback.events[index]) end)
    if playback.position == old_position then return end
    if playback.position == #playback.events then playback.playing = false end
    show_replay()
end

function OnDestroy()
    script:UnregisterServerSignalHandler("AP_DuelSnapshot")
    script:UnregisterServerSignalHandler("AP_DuelMarket")
    script:UnregisterServerSignalHandler("AP_DuelReplay")
    if shop_drag then shop_drag.destroy(); shop_drag = nil end
    for _, binding in ipairs(bindings) do
        if binding.listener and binding.object.alive then
            binding.object:RemoveCursorEventListener(click, binding.listener)
        end
        binding.listener = nil
    end
    round, latest_version, sequence = 0, 0, 0
    pending, market, selected_uid, offer_pick = nil, nil, nil, nil
    playback, status_header, status_message, seconds, hint, visible = nil, nil, nil, nil, nil, {}
    awaiting_settlement = false
    if badges then badges.restore() end
    portrait, badges = nil, nil
    preparing, can_advance, can_leave, confirm_leave, merge_mode = false, false, false, false, false
    reward_index = 1
    if merge_label.alive then merge_label.text = "合并模式" end
end
