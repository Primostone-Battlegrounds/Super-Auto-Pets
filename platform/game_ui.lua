local click = Enum.CursorEventType.CursorClick
local root, active, section, mode, practice, online, lobby
local elapsed = 0
local bindings = {}
local online_modes = {[2] = "好友 1v1", [8] = "八人吃鸡"}

local function request(choice)
    local signal = game.ServerSignal("AP_GameChooseMode")
    signal:AddInt(choice)
    signal:SendSignal()
end

local function set_visible(control, visible)
    if visible then control:SetActive(true) end
    control:SetVisible(visible)
    if not visible then control:SetActive(false) end
end

local function show_section(next_section)
    if section == next_section then return end
    if section == "Practice" and practice then practice.disable() end
    if section then set_visible(root:GetChild(section), false) end
    section = next_section
    if not section then return end
    set_visible(root:GetChild(section), true)
    script:EnableUpdate(section ~= "Room")
end

local function main_menu()
    show_section("Lobby")
    elapsed = 0
    request(0)
end

local function show_online()
    local board = mode == 2 and "Duel" or "Room"
    show_section(board)
    if online then return end
    online = (mode == 2 and duel_view or room_view)(root:GetChild(board))
    online.start(root:GetChild(board))
end

local function receive_lobby(_, values)
    if not active then return end
    local selected, present, waiting = table.unpack(values)
    if mode ~= 0 and selected ~= mode then return end
    local label = online_modes[selected]
    local entering = mode == 0 and label
    mode = selected
    set_visible(lobby:GetChild("Choices"), label == nil)
    set_visible(lobby:GetChild("Continue"), label ~= nil)
    lobby:FindChild("Continue/Title").text = label and ("回到" .. label) or ""
    local count = string.format("已进入 %d 人", present)
    if waiting > 0 then count = count .. string.format(" · %d 人加载中", waiting) end
    lobby:GetChild("Status").text = label and ("当前对局 · " .. label) or count
    lobby:GetChild("Help").text = label and "再次对战可从千星房间选择「重新挑战」。"
        or "好友 1v1 请先通过千星好友房间邀请好友，两人进入后即可开始。"
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
    bind(lobby, "Choices/Room/Hit", function() request(8) end)
    bind(lobby, "Choices/Duel/Hit", function() request(2) end)
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
        script:EnableUpdate(section ~= "Room")
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
        elapsed = elapsed + dt
        if elapsed >= 2 then
            elapsed = 0
            request(0)
        end
    elseif section == "Practice" then
        practice.update(dt)
    elseif section == "Duel" and online then
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
