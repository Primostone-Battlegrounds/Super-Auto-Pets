local root = script.object
local status = root:GetChild("Status")
local refresh = root:GetChild("Refresh")
local ready = root:GetChild("Ready")
local advance = root:GetChild("Advance")
local market_gold = root:GetChild("MarketGold")
local team_label = root:GetChild("Team")
local click = Enum.CursorEventType.CursorClick
local catalog = {
    -- AP_DUEL_CATALOG
}
local pet_cost = 0 -- AP_DUEL_PET_COST
local round = 0
local latest_version = 0
local preparing = false
local market
local offers = {}

local function send(action)
    local signal = game.ServerSignal("AP_DuelRequest")
    signal:AddInt(action)
    signal:AddInt(round)
    signal:SendSignal()
end

local function request_snapshot()
    send(0)
end

local function submit_ready()
    send(1)
end

local function request_advance()
    send(2)
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
    local players, seat, new_round, phase, is_ready, continued, settlements, version = table.unpack(parameters)
    if new_round < round or version <= latest_version then
        return
    end
    latest_version = version
    round = new_round
    preparing = players == 2 and seat > 0 and phase == 0 and not is_ready
    local message = "等待第 2 位玩家"
    if phase == 2 then
        message = "验证完成"
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
    render_market()
end

function OnStart()
    script:RegisterServerSignalHandler("AP_DuelSnapshot", receive_snapshot)
    script:RegisterServerSignalHandler("AP_DuelMarket", receive_market)
    refresh:AddCursorEventListener(click, request_snapshot)
    ready:AddCursorEventListener(click, submit_ready)
    advance:AddCursorEventListener(click, request_advance)
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
    for _, offer in ipairs(offers) do
        if offer.button.alive then
            offer.button:RemoveCursorEventListener(click, offer.buy)
        end
    end
    round = 0
    latest_version = 0
    preparing = false
    market = nil
end
