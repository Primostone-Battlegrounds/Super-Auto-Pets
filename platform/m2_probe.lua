local root = script.object
local status = root:GetChild("Status")
local refresh = root:GetChild("Refresh")
local ready = root:GetChild("Ready")
local advance = root:GetChild("Advance")
local click = Enum.CursorEventType.CursorClick
local round = 0
local latest_version = 0

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

local function receive_snapshot(_, parameters)
    local players, seat, new_round, phase, is_ready, continued, settlements, version = table.unpack(parameters)
    if version <= latest_version then
        return
    end
    latest_version = version
    round = new_round
    local message = "等待第 2 位玩家"
    if phase == 2 then
        message = "验证完成"
    elseif players == 2 then
        if phase == 0 then
            message = is_ready and "已准备，等待对手" or "双方已入场，请准备"
        else
            message = continued and "已确认，等待对手" or "本轮已结算，请确认下一轮"
        end
    end
    status.text = string.format("席位 %d  ·  第 %d 轮  ·  结算 %d 次\n%s", seat, round, settlements, message)
    print(string.format("AUTO_PETS_M2 seat=%d players=%d round=%d phase=%d ready=%s continued=%s settlements=%d version=%d",
        seat, players, round, phase, tostring(is_ready), tostring(continued), settlements, version))
end

function OnStart()
    script:RegisterServerSignalHandler("AP_DuelSnapshot", receive_snapshot)
    refresh:AddCursorEventListener(click, request_snapshot)
    ready:AddCursorEventListener(click, submit_ready)
    advance:AddCursorEventListener(click, request_advance)
    request_snapshot()
end

function OnDestroy()
    script:UnregisterServerSignalHandler("AP_DuelSnapshot")
    if refresh.alive then
        refresh:RemoveCursorEventListener(click, request_snapshot)
    end
    if ready.alive then
        ready:RemoveCursorEventListener(click, submit_ready)
    end
    if advance.alive then
        advance:RemoveCursorEventListener(click, request_advance)
    end
    round = 0
    latest_version = 0
end
