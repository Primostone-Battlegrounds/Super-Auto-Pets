local click = Enum.CursorEventType.CursorClick
local root, active, section, mode, practice, online, lobby
local elapsed, loading, confirm_fill = 0, nil, false
local pending, pending_time
local bindings = {}
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

local function show_online()
    local board = mode == 2 and "Duel" or "Room"
    show_section(board)
    if online then online.refresh(); return end
    online = (mode == 2 and duel_view or room_view)(root:GetChild(board))
    online.start(root:GetChild(board))
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
    if practice then practice.destroy() end
    if online then online.destroy() end
    for _, binding in ipairs(bindings) do
        if binding[1].alive then binding[1]:RemoveCursorEventListener(click, binding[2]) end
    end
    bindings = {}
    active, section, practice, online = false, nil, nil, nil
end
