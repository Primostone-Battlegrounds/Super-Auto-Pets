local root = script.object
local status = root:GetChild("Status")
local roster = root:GetChild("Roster")
local private = root:GetChild("Private")
local hit = root:GetChild("LuaRequest")
local click = Enum.CursorEventType.CursorClick
local latest = -1
local my_seat = 0
local native_count = 0
local lua_count = 0
local pending_reply
local seat_names = {[0] = "空", "真人", "机器人", "真人缺席"}

local function send(path)
    local request = game.ServerSignal("AP_EightProbeRequest")
    request:AddInt(path)
    request:SendSignal()
end

local function click_lua()
    send(2)
end

local function on_reply(_, values)
    local seat, path, native, lua = table.unpack(values)
    if my_seat == 0 and seat > 0 then
        -- The status refresh and its private reply can arrive in either order.
        if not pending_reply or (native >= pending_reply[3] and lua >= pending_reply[4]) then
            pending_reply = values
        end
        return
    end
    if seat ~= my_seat or native < native_count or lua < lua_count then
        return
    end
    native_count = native
    lua_count = lua
    private.text = string.format("我的回执  ·  原生 %d  ·  界面 %d", native, lua)
    print(string.format("AUTO_PETS_M3_PROBE reply seat=%d path=%d native=%d lua=%d", seat, path, native, lua))
end

local function on_view(_, values)
    local revision, field_count, seat, seconds, batch, seats, work = table.unpack(values)
    if revision <= latest then
        return
    end
    if my_seat ~= seat then
        my_seat = seat
        native_count = 0
        lua_count = 0
        private.text = ""
    end
    latest = revision
    local seat_text = seat > 0 and ("席位 " .. seat) or "未分配席位"
    status.text = string.format("场内真人 %d  ·  %s\n入席等待 %d 秒  ·  服务端批次 %d / 4", field_count, seat_text, seconds, batch)
    local lines = {}
    for index, state in ipairs(seats) do
        local detail = state == 2 and (" · 工作 " .. work[index]) or ""
        lines[index] = string.format("%d  %s%s", index, seat_names[state] or "未知", detail)
    end
    roster.text = table.concat(lines, "\n")
    print(string.format("AUTO_PETS_M3_PROBE view revision=%d field=%d seat=%d wait=%d batch=%d seats=%s work=%s",
        revision, field_count, seat, seconds, batch, table.concat(seats, ","), table.concat(work, ",")))
    if my_seat > 0 and pending_reply then
        local reply = pending_reply
        pending_reply = nil
        on_reply(nil, reply)
    end
end

function OnStart()
    latest = -1
    my_seat = 0
    native_count = 0
    lua_count = 0
    pending_reply = nil
    private.text = ""
    script:RegisterServerSignalHandler("AP_EightProbeView", on_view)
    script:RegisterServerSignalHandler("AP_EightProbeReply", on_reply)
    hit:AddCursorEventListener(click, click_lua)
    send(0)
end

function OnDestroy()
    if hit.alive then
        hit:RemoveCursorEventListener(click, click_lua)
    end
    script:UnregisterServerSignalHandler("AP_EightProbeView")
    script:UnregisterServerSignalHandler("AP_EightProbeReply")
end
