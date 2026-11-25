local click = Enum.CursorEventType.CursorClick
local bind_portrait = require("autopets.native_portrait")
local root, active, section, mode, practice, online, lobby
local elapsed, loading, confirm_fill = 0, nil, false
local pending, pending_time
local bindings = {}
local borrowed_portraits = {}
local online_modes = {[2] = "好友 1v1", [8] = "八人吃鸡"}
local refusal = {
    [1] = "等待好友进入关卡，两人到齐后再开局。",
    [2] = "好友 1v1 需要恰好两名玩家，请调整千星房间人数。",
    [3] = "部分玩家仍在加载，可以等待或确认机器人补位。",
    [4] = "其他玩家已开启对局，正在进入。",
    [5] = "当前人数无法开始这场对局。",
}

local function request(choice, fill)
    local signal = game.ServerSignal("AP_GameChooseMode")
    signal:AddInt(choice)
    signal:AddBool(fill == true)
    signal:SendSignal()
end

local function set_visible(control, visible)
    if visible then control:SetActive(true) end
    control:SetVisible(visible)
    if not visible then control:SetActive(false) end
end

local function feedback(message)
    lobby:GetChild("Feedback").text = message
end

local function start_online(choice, fill)
    if pending then return end
    pending, pending_time = choice, 0
    feedback("正在发起" .. online_modes[choice] .. "…")
    request(choice, fill)
end

local function show_section(next_section)
    if section == next_section then return end
    if section == "Practice" and practice then practice.disable() end
    if section then set_visible(root:GetChild(section), false) end
    section = next_section
    if not section then return end
    set_visible(root:GetChild(section), true)
    script:EnableUpdate(true)
end

local function main_menu()
    show_section("Lobby")
    elapsed, confirm_fill = 0, false
    pending = nil
    lobby:FindChild("Choices/Room/Title").text = "八人吃鸡"
    feedback("")
    request(0)
end

local function online_portraits(duel)
    -- One authored pool serves the mutually exclusive preparation and replay
    -- views. Keep the original parent/transform so practice can mount fresh.
    local practice_board = root:GetChild("Practice")
    local replay = root:FindChild(duel and "Duel/ReplayBoard" or "Room/Match/Replay")
    local room_shop = not duel and root:FindChild("Room/Match/Shop")
    local market = duel and root:FindChild("Duel/MarketOffers")
    local duel_board = duel and root:GetChild("Duel")
    local pictures, replay_slots = {}, {}
    for slot = 1, 5 do
        for _, side in ipairs({"Own", "Enemy"}) do
            local own = side == "Own"
            local source = practice_board:GetChild((own and "Team" or "Enemy") .. slot)
            local picture = source:GetChild("Portrait")
            local label = replay:GetChild(side .. slot)
            local px, py = picture:GetAnchoredPosition()
            local lx, ly = label:GetAnchoredPosition()
            local width, height = label:GetSizeDelta()
            borrowed_portraits[#borrowed_portraits + 1] = {
                picture = picture, parent = source, index = picture:GetSiblingIndex(), x = px, y = py,
                label = label, label_x = lx, label_y = ly, width = width, height = height,
            }
            label:SetAnchoredPosition(lx, ly - (duel and 40 or 35))
            label:SetSizeDelta(width, duel and 90 or 84)
            local shop, hit
            if duel then
                shop = own and duel_board or market
                local name = own and ("Team" .. slot) or slot <= 3 and ("Buy" .. slot) or ("Food" .. (slot - 3))
                hit = shop:GetChild(name)
            else
                shop = room_shop:GetChild((own and "Team" or "Offer") .. slot)
                hit = shop:GetChild("Hit")
            end
            local sx, sy = hit:GetAnchoredPosition()
            local slot_id = own and slot or 5 + slot
            replay_slots[side .. slot] = slot_id
            pictures[slot_id] = {
                control = picture, shown = false, lunge = 0,
                replay = {parent = replay, x = lx, y = ly + (duel and 42 or 39)},
                shop = {parent = shop, x = sx, y = sy + (duel and 22 or own and 30 or 25)},
            }
            set_visible(picture, false)
        end
    end

    local view, draw
    local function select(next_view)
        if view == next_view then return end
        view = next_view
        draw = bind_portrait(function(path)
            local slot, layer = path:match("^([^/]+)/([^/]+)$")
            return pictures[tonumber(slot)].control:GetChild(layer)
        end, view == "shop" and (duel and 1.32 or 1.25) or 1.55)
        for _, picture in ipairs(pictures) do
            set_visible(picture.control, false)
            picture.shown, picture.lunge = false, 0
            local target = picture[view]
            if target then
                picture.control.parent = target.parent
                picture.control:SetAsLastSibling()
                picture.control:SetAnchoredPosition(target.x, target.y)
            end
        end
    end

    local function paint(slot, id, mirrored, attacking)
        local picture = pictures[slot]
        local shown = id ~= nil
        if picture.shown ~= shown then
            picture.shown = shown
            set_visible(picture.control, shown)
        end
        if shown then draw(tostring(slot), id, mirrored) end
        local lunge = attacking and (mirrored and -9 or 9) or 0
        if picture.lunge ~= lunge then
            picture.lunge = lunge
            local target = picture[view]
            picture.control:SetAnchoredPosition(target.x + lunge, target.y)
        end
    end

    select("replay")
    return {
        view = select,
        shop = function(slot, id) if view == "shop" then paint(slot, id, false, false) end end,
        replay = function(slot, id, mirrored, attacking)
            if view == "replay" then paint(replay_slots[slot], id, mirrored, attacking) end
        end,
    }
end

local function show_online()
    local duel = mode == 2
    local board = duel and "Duel" or "Room"
    show_section(board)
    if online then online.refresh(); return end
    online = (duel and duel_view or room_view)(root:GetChild(board))
    online.start(root:GetChild(board), online_portraits(duel))
end

local function receive_lobby(_, values)
    if not active then return end
    local selected, present, waiting, requested, reason = table.unpack(values)
    if mode ~= 0 and selected ~= mode then return end
    local label = online_modes[selected]
    local entering = mode == 0 and label
    mode, loading = selected, waiting
    if label or requested == pending then pending = nil end
    if label or waiting == 0 then
        confirm_fill = false
    elseif requested == 8 and reason == 3 then
        confirm_fill = true
    end
    lobby:FindChild("Choices/Room/Title").text = confirm_fill and "确认开局 · 机器人补位" or "八人吃鸡"
    set_visible(lobby:GetChild("Choices"), label == nil)
    set_visible(lobby:GetChild("Continue"), label ~= nil)
    lobby:FindChild("Continue/Title").text = label and ("回到" .. label) or ""
    local count = string.format("已进入 %d 人", present)
    if waiting > 0 then count = count .. string.format(" · %d 人加载中", waiting) end
    lobby:GetChild("Status").text = label and ("当前对局 · " .. label) or count
    lobby:GetChild("Help").text = label and "本局结束后，房主可从千星房间选择「重新挑战」。"
        or "好友 1v1 请先通过千星好友房间邀请好友，两人进入后即可开始。"
    if label then
        feedback("")
    elseif refusal[reason] then
        feedback(refusal[reason])
    elseif present == 2 and waiting == 0 and lobby:GetChild("Feedback").text == refusal[1] then
        feedback("两位玩家已到齐，点好友 1v1 开局。")
    end
    if entering and section == "Lobby" then show_online() end
end

local function bind(container, path, callback)
    local target = assert(container:FindChild(path), path)
    local handler = function()
        if active then callback() end
    end
    target:AddCursorEventListener(click, handler)
    bindings[#bindings + 1] = {target, handler}
end

function OnStart()
    root, active, mode = script.object, true, 0
    set_visual_plates(root)
    lobby = root:GetChild("Lobby")
    bind(lobby, "Choices/Room/Hit", function()
        if pending then return end
        if loading and loading > 0 and not confirm_fill then
            confirm_fill = true
            lobby:FindChild("Choices/Room/Title").text = "确认开局 · 机器人补位"
            feedback("部分玩家仍在加载，再点一次确认先开。")
            return
        end
        start_online(8, confirm_fill)
    end)
    bind(lobby, "Choices/Duel/Hit", function()
        if pending then return end
        confirm_fill = false
        lobby:FindChild("Choices/Room/Title").text = "八人吃鸡"
        start_online(2)
    end)
    bind(lobby, "Choices/Practice/Hit", function()
        show_section("Practice")
        if not practice then
            practice = practice_view()
            practice.start(root:GetChild("Practice"), main_menu)
            lobby:FindChild("Choices/Practice/Title").text = "继续 AI 练习"
        end
        practice.enable()
    end)
    bind(lobby, "Continue/Hit", show_online)
    bind(root, "Duel/Back/Hit", main_menu)
    bind(root, "Room/Back/Hit", main_menu)
    script:RegisterServerSignalHandler("AP_GameLobby", receive_lobby)
    main_menu()
end

function OnEnable()
    active = true
    if section == "Practice" then
        practice.enable()
    elseif section then
        script:EnableUpdate(true)
    end
end

function OnDisable()
    active = false
    if section == "Practice" then practice.disable() end
    script:EnableUpdate(false)
end

function OnUpdate(dt)
    if not active then return end
    if section == "Lobby" and mode == 0 then
        if pending then
            pending_time = pending_time + dt
            if pending_time >= 6 then
                pending, elapsed = nil, 0
                feedback("尚未收到关卡回应，可以重试。")
                request(0)
            end
        end
        elapsed = elapsed + dt
        if elapsed >= 2 then
            elapsed = 0
            request(0)
        end
    elseif section == "Practice" then
        practice.update(dt)
    elseif section ~= "Lobby" and online then
        online.update(dt)
    end
end

function OnDestroy()
    script:UnregisterServerSignalHandler("AP_GameLobby")
    if online then online.destroy() end
    for _, entry in ipairs(borrowed_portraits) do
        if entry.picture.alive and entry.parent.alive then
            entry.picture.parent = entry.parent
            entry.picture:SetSiblingIndex(entry.index)
            entry.picture:SetAnchoredPosition(entry.x, entry.y)
            set_visible(entry.picture, true)
        end
        if entry.label.alive then
            entry.label:SetAnchoredPosition(entry.label_x, entry.label_y)
            entry.label:SetSizeDelta(entry.width, entry.height)
        end
    end
    borrowed_portraits = {}
    if practice then practice.destroy() end
    for _, binding in ipairs(bindings) do
        if binding[1].alive then binding[1]:RemoveCursorEventListener(click, binding[2]) end
    end
    bindings = {}
    active, section, practice, online = false, nil, nil, nil
end
