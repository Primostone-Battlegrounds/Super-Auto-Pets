local root = script.object
local status = root:GetChild("Status")
local refresh = root:GetChild("Refresh")
local ready = root:GetChild("Ready")
local advance = root:GetChild("Advance")
local leave = root:GetChild("Leave")
local leave_label = root:GetChild("LeaveLabel")
local market_gold = root:GetChild("MarketGold")
local team_label = root:GetChild("Team")
local click = Enum.CursorEventType.CursorClick
local catalog = {
    -- AP_DUEL_CATALOG
}
local pet_cost = 0 -- AP_DUEL_PET_COST
local round = 0
local latest_version = 0
local sequence = 0
local next_token = 1
local pending
local preparing = false
local can_advance = false
local can_leave = false
local confirm_leave = false
local market
local offers = {}

local function transmit(action, command_round, command_sequence, token)
    local signal = game.ServerSignal("AP_DuelRequest")
    signal:AddInt(action)
    signal:AddInt(command_round)
    signal:AddInt(command_sequence)
    signal:AddInt(token)
    signal:SendSignal()
end

local function send(action)
    if pending or sequence == 0 then return end
    pending = {action = action, round = round, sequence = sequence, token = next_token}
    next_token = next_token + 1
    transmit(pending.action, pending.round, pending.sequence, pending.token)
end

local function request_snapshot()
    if pending then
        transmit(pending.action, pending.round, pending.sequence, pending.token)
    else
        transmit(0, round, 0, 0)
    end
end

local function submit_ready()
    if preparing and market and market.round == round and market.version == latest_version and #market.team > 0 then
        send(1)
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

local function current_market()
    if market and market.round == round then
        return market
    end
end

for slot = 1, 3 do
    offers[slot] = {
        label = root:GetChild("OfferLabel" .. slot),
        button = root:GetChild("Buy" .. slot),
        buy = function()
            local view = current_market()
            -- Status and market packets can cross in flight. Act on a matched pair.
            if preparing and view and view.version == latest_version
                and #view.team < 5 and view.gold >= pet_cost and catalog[view.offers[slot]] then
                send(slot + 2)
            end
        end,
    }
end

local function render_market()
    local view = current_market()
    if not view then
        market_gold.text = "同步商店中"
        team_label.text = "阵容 —"
        for _, offer in ipairs(offers) do
            offer.label.text = "—"
        end
        return
    end

    market_gold.text = string.format("金币 %d", view.gold)
    local footer = string.format("购买 %d 金", pet_cost)
    if view.version ~= latest_version then
        footer = "等待同步"
    elseif not preparing then
        footer = "本轮已锁定"
    elseif #view.team >= 5 then
        footer = "阵容已满"
    elseif view.gold < pet_cost then
        footer = "金币不足"
    end
    for slot, offer in ipairs(offers) do
        local pet = catalog[view.offers[slot]]
        offer.label.text = pet and string.format("%s  攻%d / 生%d\n%s", pet.name, pet.attack, pet.health, footer) or "售罄"
    end
    local names = {}
    for slot, code in ipairs(view.team) do
        local pet = catalog[code]
        names[slot] = pet and pet.name or "未知动物"
    end
    local lineup = #names > 0 and table.concat(names, "  ·  ") or "空阵容"
    if #names == 0 and preparing and view.version == latest_version and view.gold >= pet_cost then
        lineup = "先购买动物"
    end
    team_label.text = string.format("阵容 %d / 5\n%s", #names, lineup)
end

local function receive_market(_, parameters)
    local market_round, version, gold, selection, team = table.unpack(parameters)
    if market_round < round or version < latest_version or (market and version <= market.version) then
        return
    end
    local lineup = {}
    for _, code in ipairs(team or {}) do
        if code ~= 0 then
            lineup[#lineup + 1] = code
        end
    end
    market = {round = market_round, version = version, gold = gold, offers = selection, team = lineup}
    print(string.format("AUTO_PETS_M2 market round=%d gold=%d team=%d version=%d", market_round, gold, #lineup, version))
    render_market()
end

local function receive_snapshot(_, parameters)
    local players, seat, new_round, phase, is_ready, continued, settlements, version,
        next_sequence, winner, reason, remaining, ack = table.unpack(parameters)
    -- An actor's acknowledgement can arrive after a newer peer update.
    if pending and pending.token == ack then pending = nil end
    if new_round < round or version <= latest_version then
        return
    end
    if pending and (new_round > pending.round or next_sequence > pending.sequence or phase == 2) then
        pending = nil
    end
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
        if reason == 1 then
            message = "两轮同步验证完成"
        elseif winner == 0 then
            message = "房间已结束"
        else
            message = winner == seat and "对手离开，本席获胜" or "对局已结束，本席告负"
        end
    elseif seat > 0 and players < 2 then
        message = "等待原席位返回"
    elseif players == 2 then
        if phase == 0 then
            message = is_ready and "已准备，等待对手" or "双方已入场"
        else
            message = continued and "已确认，等待对手" or "本轮已结算，请确认下一轮"
        end
    end
    local seat_text = seat > 0 and string.format("席位 %d", seat) or "等候席位"
    status.text = string.format("%s  ·  第 %d 轮  ·  结算 %d 次\n%s", seat_text, round, settlements, message)
    print(string.format("AUTO_PETS_M2 seat=%d players=%d round=%d phase=%d ready=%s continued=%s settlements=%d version=%d",
        seat, players, round, phase, tostring(is_ready), tostring(continued), settlements, version))
    print(string.format("AUTO_PETS_M2 sequence=%d winner=%d reason=%d remaining=%d", sequence, winner, reason, remaining))
    render_market()
end

function OnStart()
    script:RegisterServerSignalHandler("AP_DuelSnapshot", receive_snapshot)
    script:RegisterServerSignalHandler("AP_DuelMarket", receive_market)
    refresh:AddCursorEventListener(click, request_snapshot)
    ready:AddCursorEventListener(click, submit_ready)
    advance:AddCursorEventListener(click, request_advance)
    leave:AddCursorEventListener(click, forfeit)
    for _, offer in ipairs(offers) do
        offer.button:AddCursorEventListener(click, offer.buy)
    end
    render_market()
    request_snapshot()
end

function OnDestroy()
    script:UnregisterServerSignalHandler("AP_DuelSnapshot")
    script:UnregisterServerSignalHandler("AP_DuelMarket")
    if refresh.alive then
        refresh:RemoveCursorEventListener(click, request_snapshot)
    end
    if ready.alive then
        ready:RemoveCursorEventListener(click, submit_ready)
    end
    if advance.alive then
        advance:RemoveCursorEventListener(click, request_advance)
    end
    if leave.alive then
        leave:RemoveCursorEventListener(click, forfeit)
    end
    for _, offer in ipairs(offers) do
        if offer.button.alive then
            offer.button:RemoveCursorEventListener(click, offer.buy)
        end
    end
    round = 0
    latest_version = 0
    sequence = 0
    pending = nil
    preparing = false
    can_advance = false
    can_leave = false
    confirm_leave = false
    market = nil
end
