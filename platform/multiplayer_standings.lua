local standings = {}
local modes = {duel = 2, room = 8}
local phases = {
    lobby = "等待入席", preparation = "经营准备", battle = "战斗计算", settlement = "回合结算", ended = "对局终局",
}
local duel_phases = {"preparation", "settlement", "ended", "battle"}

local function seconds_until(deadline, now)
    if deadline == nil then return nil end
    local remaining = math.max(0, deadline - now)
    return remaining // 1000 + (remaining % 1000 > 0 and 1 or 0)
end

function standings.room(snapshot, now)
    local view = {
        revision = snapshot.host_revision or snapshot.revision, phase = snapshot.phase,
        round = snapshot.round, seat = snapshot.seat, seconds = seconds_until(snapshot.deadline, now),
        human_count = snapshot.human_count, bot_count = snapshot.bot_count, alive_count = snapshot.alive_count,
        opponent = snapshot.active and snapshot.opponent, bye = snapshot.active and snapshot.pairing == "bye",
        winner = snapshot.winner, seats = {},
    }
    for _, row in ipairs(snapshot.seats) do
        view.seats[row.seat] = {
            kind = row.kind, lives = row.lives, place = row.place, ready = row.ready,
            absent = row.connected == false and row.active,
            withdrawn = row.elimination_reason == "forfeit",
        }
    end
    return view
end

function standings.duel(snapshot, now)
    local seat = snapshot.seat
    local opponent = 3 - seat
    local view = {
        revision = snapshot.host_revision or snapshot.revision, phase = snapshot.phase,
        round = snapshot.round, seat = seat, seconds = seconds_until(snapshot.deadline, now),
        human_count = 2, bot_count = 0, opponent = opponent, winner = snapshot.winner,
        reconnecting = snapshot.opponent_connected == false,
        seats = {
            [seat] = {kind = "human", lives = snapshot.lives, ready = snapshot.ready},
            [opponent] = {kind = "human", lives = snapshot.opponent_lives, ready = snapshot.opponent_ready,
                absent = snapshot.opponent_connected == false},
        },
    }
    if snapshot.phase == "ended" and snapshot.winner then
        view.seats[snapshot.winner].place = 1
        view.seats[3 - snapshot.winner].place = 2
    end
    return view
end

function standings.duel_probe(fields)
    local players, seat, round, phase, ready, continued, _, revision, _, winner, reason, remaining, _, lives, opponent_lives =
        table.unpack(fields)
    local view = {
        revision = revision, round = round, seat = seat, phase = duel_phases[phase + 1],
        human_count = players, bot_count = 0, winner = winner > 0 and winner or nil,
        reconnecting = players < 2 and seat > 0, seats = {},
    }
    if seat > 0 then
        view.seats[seat] = {kind = "human", ready = ready, lives = lives}
        if players == 2 or opponent_lives ~= nil then
            view.seats[3 - seat] = {kind = "human", lives = opponent_lives, absent = players < 2}
        end
        if lives ~= nil then
            view.seconds = remaining
            view.opponent = 3 - seat
        end
    end
    if phase == 2 and reason == 1 then view.phase_name = "两轮同步验证完成"
    elseif phase == 2 then
        view.phase_name = "房间已结束"
        if lives ~= nil and view.winner and seat > 0 then
            view.seats[view.winner].place = 1
            view.seats[3 - view.winner].place = 2
        end
    elseif phase == 1 and continued then view.phase_name = "已确认本轮"
    elseif players < 2 and phase ~= 2 then view.phase = "lobby"
    end
    return view
end

function standings.room_probe(fields)
    local revision, field, seat, seconds, batch, kinds, work = table.unpack(fields)
    local view = {
        revision = revision, phase = "lobby", seat = seat,
        phase_name = "入席等待", seconds = seconds, human_count = field, bot_count = 0, seats = {},
    }
    if seat > 0 then
        view.phase_name = string.format("调度验证 %d / 4", batch)
        view.seconds = nil
    end
    for index, kind in ipairs(kinds) do
        if kind == 1 or kind == 3 then
            view.seats[index] = {kind = "human", absent = kind == 3}
        elseif kind == 2 then
            view.seats[index] = {kind = "bot", work = work[index]}
            view.bot_count = view.bot_count + 1
        end
    end
    return view
end

local function opponent_label(view)
    if view.winner then return "获胜席位 " .. view.winner end
    if view.phase == "ended" then
        return view.phase_name and "" or "本局平局"
    end
    if view.reconnecting then return "等待原席位恢复" end
    if view.bye then return "本轮轮空" end
    if view.opponent then return "本轮对手 · 席位 " .. view.opponent end
    return view.seat and view.seat > 0 and ("我的席位 " .. view.seat) or ""
end

local function row_text(view, seat)
    local row = view.seats[seat]
    local prefix = seat == view.seat and ("席位 " .. seat .. " · 我") or ("席位 " .. seat)
    if not row then return prefix, "空席" end
    local role = row.kind == "bot" and "机器人" or "真人"
    local detail
    if row.place then
        detail = row.place == 1 and "冠军" or ("第 " .. row.place .. " 名")
        if row.withdrawn then detail = detail .. " · 退出" end
        if view.phase ~= "ended" and not row.withdrawn then detail = detail .. " · 淘汰" end
    elseif row.absent then
        detail = "暂离"
    elseif row.work ~= nil then
        detail = "工作 " .. row.work
    elseif row.lives ~= nil then
        detail = row.lives .. " 命"
        if view.phase == "preparation" and row.ready then detail = detail .. " · 已准备" end
    elseif view.phase == "preparation" and row.ready then
        detail = "已准备"
    else
        detail = ""
    end
    return prefix, detail == "" and role or (role .. " · " .. detail)
end

function standings.bind(root, mode)
    local capacity = assert(modes[mode])
    local heading = {}
    for _, name in ipairs({"Phase", "Count", "Opponent"}) do heading[name] = assert(root:GetChild(name)) end
    local rows = {}
    for seat = 1, capacity do
        rows[seat] = {assert(root:GetChild("Seat" .. seat)), assert(root:GetChild("Seat" .. seat .. "Detail"))}
    end
    local latest = -1
    local displayed = {}
    local function set(control, text)
        if displayed[control] ~= text then
            control.text = text
            displayed[control] = text
        end
    end
    return function(view)
        if view.revision <= latest then return false end
        latest = view.revision
        local caption = view.phase_name or assert(phases[view.phase])
        if view.round and view.round > 0 and view.phase ~= "lobby" then
            caption = "第 " .. view.round .. " 轮 · " .. caption
        end
        if view.seconds and view.seconds > 0 then caption = caption .. " · " .. view.seconds .. " 秒" end
        set(heading.Phase, caption)
        local counts = string.format("%d 真人 · %d 机器人", view.human_count, view.bot_count)
        if view.alive_count and view.phase ~= "lobby" then counts = counts .. " · " .. view.alive_count .. " 存活" end
        set(heading.Count, counts)
        set(heading.Opponent, opponent_label(view))
        for seat, controls in ipairs(rows) do
            local name, detail = row_text(view, seat)
            set(controls[1], name)
            set(controls[2], detail)
        end
        return true
    end
end

return standings
