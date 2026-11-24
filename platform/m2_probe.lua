local root = script.object
local status = root:GetChild("Status")
local market_gold = root:GetChild("MarketGold")
local team_label = root:GetChild("Team")
local leave_label = root:GetChild("LeaveLabel")
local merge_label = root:GetChild("MergeLabel")
local reward_label = root:GetChild("RewardLabel")
local replay_label = root:GetChild("ReplayLabel")
local replay_status = root:GetChild("ReplayStatus")
local click = Enum.CursorEventType.CursorClick
local battle = require("autopets.battle")
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
local selected_uid
local merge_mode = false
local reward_index = 1
local market
local playback
local bindings = {}
local pet_labels, food_labels, team_labels = {}, {}, {}
local pet_freeze_labels, food_freeze_labels = {}, {}

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

local function render_market()
    local view = current_market()
    if not view then
        market_gold.text = "同步商店中"
        team_label.text = "阵容 —"
        reward_label.text = "升级奖励"
        for slot, label in ipairs(team_labels) do
            label.text = string.format("阵位 %d  ·  空", slot)
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

    market_gold.text = string.format("金币 %d  ·  第 %d 阶", view.gold, view.tier)
    local picked = selected_slot(view)
    if not picked then selected_uid = nil end
    local footer = string.format("购买 %d 金", rules.pet_cost)
    if view.version ~= latest_version then
        footer = "等待同步"
    elseif not preparing then
        footer = "本轮已锁定"
    elseif view.gold < rules.pet_cost then
        footer = "金币不足"
    elseif #view.team == rules.team_size and not picked then
        footer = "阵容已满"
    end
    for slot, label in ipairs(pet_labels) do
        local code = view.pets[slot]
        local pet = pets[math.abs(code)]
        label.text = pet and string.format("%s  攻%d / 生%d\n%s", pet.name, pet.attack, pet.health, footer) or "售罄"
        pet_freeze_labels[slot].text = code < 0 and "解冻动物" or "冻结动物"
    end
    for slot, label in ipairs(food_labels) do
        local code = view.foods[slot]
        local food = foods[math.abs(code)]
        label.text = food and string.format("%s  +%d攻 / +%d生\n喂食 %d 金",
            food.name, food.attack, food.health, rules.food_cost) or "售罄"
        food_freeze_labels[slot].text = code < 0 and "解冻食物" or "冻结食物"
    end
    for slot, label in ipairs(team_labels) do
        local unit = view.team[slot]
        if unit then
            local pet = pets[unit.code]
            local name = pet and pet.name or "动物"
            local prefix = slot == picked and "已选 · " or ""
            label.text = string.format("%s%s  %d/%d\nLv%d  经验 %d", prefix, name, unit.attack, unit.health, unit.level, unit.xp)
        else
            label.text = string.format("阵位 %d  ·  空", slot)
        end
    end
    team_label.text = string.format("阵容 %d / %d", #view.team, rules.team_size)
    if reward_index > #view.rewards then reward_index = 1 end
    local reward = pets[view.rewards[reward_index]]
    reward_label.text = reward and string.format("奖励 %d/%d · %s", reward_index, #view.rewards, reward.name) or "暂无升级奖励"
end

local function acquire(slot, reward)
    local view = editable_market()
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
    if not view or view.gold < rules.food_cost or view.foods[slot] == 0 then return end
    local picked = selected_slot(view)
    if picked then send(16, slot, picked) end
end

local function freeze(slot, food)
    local view = editable_market()
    if not view then return end
    local shelf = food and view.foods or view.pets
    if shelf[slot] ~= 0 then send(17, slot, food and 1 or 0) end
end

local function select_unit(slot)
    local view = editable_market()
    if not view or not view.team[slot] then return end
    local picked = selected_slot(view)
    if not picked then
        selected_uid = view.team[slot].uid
    elseif picked == slot then
        selected_uid = nil
    elseif not merge_mode or view.team[picked].code == view.team[slot].code
        and view.team[slot].level < rules.max_level then
        send(merge_mode and 15 or 14, picked, slot)
        selected_uid = nil
        merge_mode = false
        merge_label.text = "合并模式"
    end
    render_market()
end

local function submit_ready()
    local view = editable_market()
    if view and #view.team > 0 then send(1) end
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

local function bind(name, callback)
    bindings[#bindings + 1] = {object = root:GetChild(name), callback = callback}
end

local event_text = {start = "入场", skill = "技能", attack = "攻击", damage = "受击", shield = "护盾",
    faint = "退场", buff = "强化", summon = "召唤", result = "结算"}

local function show_replay()
    if not playback then
        replay_status.text = "等待战斗回放"
        replay_label.text = "回放"
        return
    end
    local event = playback.events[playback.position]
    local step = event_text[event.type] or event.type
    local side = event.side == "player" and "席1" or event.side == "enemy" and "席2" or "双方"
    if event.board then playback.board = event.board end
    local names = {}
    for _, key in ipairs({"player", "enemy"}) do
        local units = {}
        for _, unit in ipairs(playback.board[key]) do
            local definition = native_catalog.pet_by_id[unit.id] or native_catalog.token_by_id[unit.id]
            units[#units + 1] = string.format("%s%d", definition.name, unit.health)
        end
        names[#names + 1] = #units > 0 and table.concat(units, " ") or "空"
    end
    replay_status.text = string.format("第 %d 轮  %d/%d  %s · %s\n席1 %s  |  席2 %s", playback.round,
        playback.position, #playback.events, side, step, names[1], names[2])
    replay_label.text = playback.playing and "暂停" or playback.position == #playback.events and "重播" or "继续"
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
        replay_status.text = "回放校验失败"
        print(string.format("AUTO_PETS_M2 replay_mismatch round=%d", battle_round))
        return
    end
    playback = {round = battle_round, events = result.events, position = 1, elapsed = 0, playing = true}
    print(string.format("AUTO_PETS_M2 replay round=%d events=%d outcome=%d", battle_round, #result.events, outcome))
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
    if editable_market() then send(10) end
end)
bind("Sell", function()
    local view = editable_market()
    local slot = view and selected_slot(view)
    if slot then
        send(13, 0, slot)
        selected_uid = nil
        render_market()
    end
end)
bind("Merge", function()
    if editable_market() then
        merge_mode = not merge_mode
        merge_label.text = merge_mode and "取消合并" or "合并模式"
    end
end)
bind("Reward", function() acquire(reward_index, true) end)
bind("RewardNext", function()
    local view = editable_market()
    if view and #view.rewards > 1 then
        reward_index = reward_index % #view.rewards + 1
        render_market()
    end
end)

for slot = 1, rules.pet_slots do
    pet_labels[slot] = root:GetChild("OfferLabel" .. slot)
    pet_freeze_labels[slot] = root:GetChild("FreezePetLabel" .. slot)
    bind("Buy" .. slot, function() acquire(slot, false) end)
    bind("FreezePet" .. slot, function() freeze(slot, false) end)
end
for slot = 1, rules.food_slots do
    food_labels[slot] = root:GetChild("FoodLabel" .. slot)
    food_freeze_labels[slot] = root:GetChild("FreezeFoodLabel" .. slot)
    bind("Food" .. slot, function() feed(slot) end)
    bind("FreezeFood" .. slot, function() freeze(slot, true) end)
end
for slot = 1, rules.team_size do
    team_labels[slot] = root:GetChild("TeamLabel" .. slot)
    bind("Team" .. slot, function() select_unit(slot) end)
end

local function receive_market(_, parameters)
    local market_round, version, raw = table.unpack(parameters)
    if market_round < round or version < latest_version or (market and version <= market.version) then return end
    if #raw == 1 then
        market = nil
        render_market()
        return
    end
    local view = {round = market_round, version = version, tier = raw[2], gold = raw[3], pets = {}, foods = {}, team = {}, rewards = {}}
    local cursor = 7
    for _, shelf in ipairs({{view.pets, rules.pet_slots}, {view.foods, rules.food_slots}}) do
        for slot = 1, shelf[2] do
            shelf[1][slot] = raw[cursor]
            cursor = cursor + 1
        end
    end
    for slot = 1, raw[6] do
        local at = cursor + (slot - 1) * 6
        view.team[slot] = {code = raw[at], uid = raw[at + 1], attack = raw[at + 2], health = raw[at + 3],
            level = raw[at + 4], xp = raw[at + 5]}
    end
    for at = cursor + rules.team_size * 6, #raw do view.rewards[#view.rewards + 1] = raw[at] end
    market = view
    print(string.format("AUTO_PETS_M2 market round=%d gold=%d team=%d version=%d", market_round, view.gold, #view.team, version))
    render_market()
end

local function receive_snapshot(_, parameters)
    local players, seat, new_round, phase, is_ready, continued, settlements, version,
        next_sequence, winner, reason, remaining, ack, lives, opponent_lives, outcome = table.unpack(parameters)
    if pending and pending.token == ack then pending = nil end
    if new_round < round or version <= latest_version then return end
    if pending and (new_round > pending.round or next_sequence > pending.sequence or phase == 2) then pending = nil end
    if new_round > round then reward_index = 1 end
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
            message = "双方已锁定 · 战斗计算中"
        else
            local round_result = outcome == 3 and "本轮平局" or outcome == seat and "本轮获胜" or "本轮失利"
            message = round_result .. (continued and " · 已确认" or " · 确认下一轮")
        end
    end
    local seat_text = seat > 0 and string.format("席位 %d", seat) or "等候席位"
    status.text = string.format("%s  ·  第 %d 轮  ·  生命 %d / 对手 %d\n%s", seat_text, round, lives, opponent_lives, message)
    print(string.format("AUTO_PETS_M2 seat=%d players=%d round=%d phase=%d ready=%s continued=%s settlements=%d version=%d",
        seat, players, round, phase, tostring(is_ready), tostring(continued), settlements, version))
    print(string.format("AUTO_PETS_M2 sequence=%d winner=%d reason=%d remaining=%d", sequence, winner, reason, remaining))
    render_market()
end

function OnStart()
    script:RegisterServerSignalHandler("AP_DuelSnapshot", receive_snapshot)
    script:RegisterServerSignalHandler("AP_DuelMarket", receive_market)
    script:RegisterServerSignalHandler("AP_DuelReplay", receive_replay)
    for _, binding in ipairs(bindings) do binding.object:AddCursorEventListener(click, binding.callback) end
    render_market()
    show_replay()
    request_snapshot()
end

function OnUpdate(dt)
    if not playback or not playback.playing then return end
    playback.elapsed = playback.elapsed + dt
    if playback.elapsed < 0.18 then return end
    playback.elapsed = 0
    playback.position = playback.position + 1
    if playback.position == #playback.events then playback.playing = false end
    show_replay()
end

function OnDestroy()
    script:UnregisterServerSignalHandler("AP_DuelSnapshot")
    script:UnregisterServerSignalHandler("AP_DuelMarket")
    script:UnregisterServerSignalHandler("AP_DuelReplay")
    for _, binding in ipairs(bindings) do
        if binding.object.alive then binding.object:RemoveCursorEventListener(click, binding.callback) end
    end
    round, latest_version, sequence = 0, 0, 0
    pending, market, selected_uid = nil, nil, nil
    playback = nil
    preparing, can_advance, can_leave, confirm_leave, merge_mode = false, false, false, false, false
    reward_index = 1
    if merge_label.alive then merge_label.text = "合并模式" end
end
