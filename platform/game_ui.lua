local click = Enum.CursorEventType.CursorClick
local bind_portrait = require("autopets.native_portrait")
local root, active, section, mode, practice, online, lobby
local elapsed, confirm_fill = 0, false
local request_id, last_view = 0, 0
local availability, snapshot_age, pending, saw_lobby
local bindings = {}
local borrowed_portraits = {}
local online_modes = {[2] = "好友 1v1", [8] = "八人吃鸡"}
local entry_labels = {[2] = "房间", [3] = "匹配"}
local refusal = {
    [1] = "等待好友进入关卡，两人到齐后再开局。",
    [2] = "好友 1v1 需要恰好两名玩家，请调整千星房间人数。",
    [3] = "部分玩家仍在加载，可以等待或确认机器人补位。",
    [4] = "关卡已有对局，可从主菜单回到本局。",
    [5] = "当前人数无法开始这场对局。",
    [6] = "等待关卡内的发起者开始对局，你也可以先练习。",
    [7] = "这次请求已失效，请重新选择。",
}

local function send_request(choice, fill, token)
    local signal = game.ServerSignal("AP_GameChooseMode")
    signal:AddInt(choice)
    signal:AddBool(fill == true)
    signal:AddInt(token)
    signal:SendSignal()
end

local function next_request()
    request_id = request_id + 1
    return request_id
end

local function query_lobby()
    send_request(0, false, next_request())
end

local function set_visible(control, visible)
    if visible then control:SetActive(true) end
    control:SetVisible(visible)
    if not visible then control:SetActive(false) end
end

local function feedback(message)
    lobby:GetChild("Feedback").text = message
end

local function clear_pending()
    pending = nil
    set_visible(lobby:GetChild("Cancel"), false)
end

local function reset_fill()
    confirm_fill = false
    lobby:FindChild("Choices/Room/Title").text = "八人吃鸡"
end

local function start_online(choice)
    if pending then return end
    if not availability then
        feedback("千星关卡状态未同步。可以稍后重试，或先开始 AI 练习。")
        return
    end
    local reason = availability[choice]
    local fill = choice == 8 and reason == 3
    if fill and not confirm_fill then
        confirm_fill = true
        lobby:FindChild("Choices/Room/Title").text = "确认开局 · 机器人补位"
        feedback("部分玩家仍在加载，再点一次确认先开。")
        return
    end
    reset_fill()
    if reason ~= 0 and not fill then
        feedback(refusal[reason])
        return
    end
    local token = next_request()
    pending = {choice = choice, token = token, elapsed = 0}
    set_visible(lobby:GetChild("Cancel"), true)
    feedback("正在发起" .. online_modes[choice] .. "…")
    print("AUTO_PETS_LOBBY mode_request " .. choice)
    send_request(choice, fill, token)
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
    elapsed, availability, snapshot_age, last_view = 0, nil, 0, request_id
    clear_pending()
    reset_fill()
    if mode == 0 then lobby:GetChild("Status").text = "正在连接千星关卡" end
    feedback("")
    query_lobby()
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
            local source = own and practice_board:GetChild("Team" .. slot)
                or practice_board:FindChild(shared_portrait_homes[slot])
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
                shop = {parent = shop, x = sx - (own and 0 or 4), y = sy + (duel and 22 or own and 30 or 25)},
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
        end, view == "shop" and (duel and 1.50 or 1.47) or 1.78)
        for _, picture in ipairs(pictures) do
            set_visible(picture.control, false)
            picture.shown, picture.recess, picture.lunge = false, false, 0
            local target = picture[view]
            if target then
                picture.control.parent = target.parent
                picture.control:SetAsLastSibling()
                picture.control:SetAnchoredPosition(target.x, target.y)
            end
        end
    end

    local function paint(slot, id, mirrored, attacking, show_empty)
        local picture = pictures[slot]
        local recess = id == nil and show_empty == true
        local shown = id ~= nil or recess
        if picture.shown ~= shown then
            picture.shown = shown
            set_visible(picture.control, shown)
        end
        if recess and not picture.recess then
            draw(tostring(slot), nil, mirrored)
            local plate = picture.control:GetChild("Layer1")
            plate:SetImage(Enum.ImageSource.StaticReference, 106053)
            plate.imageType = Enum.ImageType.Basic
            plate:SetAnchoredPosition(0, duel and -32 or -30)
            plate:SetSizeDelta(duel and 68 or 58, 18)
            plate.imageColor = mirrored and Color(118, 80, 59, 255) or Color(75, 98, 59, 255)
            set_visible(plate, true)
        elseif id ~= nil then
            draw(tostring(slot), id, mirrored)
        end
        picture.recess = recess
        local lunge = attacking and (mirrored and -15 or 15) or 0
        if picture.lunge ~= lunge then
            picture.lunge = lunge
            local target = picture[view]
            picture.control:SetAnchoredPosition(target.x + lunge, target.y + (lunge == 0 and 0 or 4))
        end
    end

    select("replay")
    return {
        view = select,
        shop = function(slot, id) if view == "shop" then paint(slot, id, false, false) end end,
        replay = function(slot, id, mirrored, attacking, show_empty)
            if view == "replay" then paint(replay_slots[slot], id, mirrored, attacking, show_empty) end
        end,
    }
end

local function show_online()
    local duel = mode == 2
    local board = duel and "Duel" or "Room"
    show_section(board)
    if online then online.refresh(); return end
    online = (duel and duel_view or room_view)(root:GetChild(board))
    local badges = root:FindChild("Duel/ReplayBoard/BadgePool")
    online.start(root:GetChild(board), online_portraits(duel), badges)
end

local function receive_lobby(_, values)
    if not active then return end
    local selected, present, waiting, _, reason, token, entry, duel_reason, room_reason, latest = table.unpack(values)
    if not latest or not (selected == 0 or online_modes[selected]) then return end
    if mode ~= 0 and selected ~= mode then return end
    local label = online_modes[selected]
    local matched = pending and token == pending.token
    local fresh = token > last_view and token <= request_id
    local broadcast = token == 0 and label
    if not fresh and not broadcast and not (label and matched) then
        if matched then
            clear_pending()
            print("AUTO_PETS_LOBBY mode_rejected " .. reason)
            feedback(refusal[reason] or refusal[7])
        end
        return
    end
    if not saw_lobby then
        saw_lobby = true
        print("AUTO_PETS_LOBBY first_response")
    end
    if fresh then last_view = token end
    request_id = math.max(request_id, latest)
    local entering = mode == 0 and label and (broadcast or pending and pending.choice == selected)
    if confirm_fill and (room_reason ~= 3 or not availability or availability.waiting ~= waiting) then
        reset_fill()
    end
    mode = selected
    availability, snapshot_age = {[2] = duel_reason, [8] = room_reason, waiting = waiting}, 0
    if label or matched then clear_pending() end
    set_visible(lobby:GetChild("Choices"), label == nil)
    set_visible(lobby:GetChild("Continue"), label ~= nil)
    lobby:FindChild("Continue/Title").text = label and ("回到" .. label) or ""
    local count = string.format("已进入 %d 人", present)
    if waiting > 0 then count = count .. string.format(" · %d 人加载中", waiting) end
    if entry_labels[entry] then count = entry_labels[entry] .. " · " .. count end
    lobby:GetChild("Status").text = label and ("当前对局 · " .. label) or count
    lobby:GetChild("Help").text = label and "联机重开请使用千星房间的「重新挑战」。"
        or duel_reason == 6 and "等待关卡内的发起者开局。你可以先开始 AI 练习。"
        or "好友 1v1 请先通过千星好友房间邀请好友，两人进入后即可开始。"
    if label then
        if matched then print("AUTO_PETS_LOBBY mode_accepted " .. selected) end
        feedback("")
    elseif matched and refusal[reason] then
        print("AUTO_PETS_LOBBY mode_rejected " .. reason)
        feedback(refusal[reason])
    elseif duel_reason == 0 and lobby:GetChild("Feedback").text == refusal[1] then
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
    bind(lobby, "Choices/Room/Hit", function() start_online(8) end)
    bind(lobby, "Choices/Duel/Hit", function() start_online(2) end)
    bind(lobby, "Choices/Practice/Hit", function()
        clear_pending()
        reset_fill()
        show_section("Practice")
        if not practice then
            practice = practice_view()
            practice.start(root:GetChild("Practice"), main_menu)
            lobby:FindChild("Choices/Practice/Title").text = "继续 AI 练习"
        end
        practice.enable()
    end)
    bind(lobby, "Cancel/Hit", function()
        clear_pending()
        feedback("已停止等待。若关卡已开局，可从主菜单进入。")
    end)
    bind(lobby, "Exit/Hit", function()
        clear_pending()
        reset_fill()
        feedback("从千星左上角菜单或 Esc 打开试玩控制，选择退出。")
    end)
    bind(lobby, "Continue/Hit", show_online)
    bind(root, "Duel/Back/Hit", main_menu)
    bind(root, "Room/Back/Hit", main_menu)
    script:RegisterServerSignalHandler("AP_GameLobby", receive_lobby)
    print("AUTO_PETS_LOBBY client_start")
    main_menu()
end

function OnEnable()
    local resuming = not active
    active = true
    if section == "Practice" then
        practice.enable()
    elseif section then
        script:EnableUpdate(true)
        if resuming and section == "Lobby" then main_menu() end
    end
end

function OnDisable()
    active = false
    if pending then clear_pending() end
    if section == "Practice" then practice.disable() end
    script:EnableUpdate(false)
end

function OnUpdate(dt)
    if not active then return end
    if section == "Lobby" and mode == 0 then
        elapsed = elapsed + dt
        if pending then
            pending.elapsed = pending.elapsed + dt
            if pending.elapsed >= 6 then
                clear_pending()
                elapsed = 0
                print("AUTO_PETS_LOBBY mode_timeout")
                feedback("尚未收到关卡回应，可以重试。")
                query_lobby()
            end
        end
        snapshot_age = snapshot_age + dt
        if snapshot_age >= 6 and snapshot_age - dt < 6 then
            availability = nil
            reset_fill()
            lobby:GetChild("Status").text = "等待关卡状态同步"
        end
        if elapsed >= 2 then
            elapsed = 0
            query_lobby()
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
    request_id, last_view, availability, saw_lobby = 0, 0, nil, nil
end
