local input = {}

function input.plan(view, rules, kind, from, to, merge)
    if not view then return nil, "等待商店同步后再操作" end
    local team = view.team
    local source, target = team[from], team[to]
    if kind == "team" then
        if not source then return nil, "请先选一名队员" end
        to = to and math.min(to, #team)
        target = team[to]
        if not target or from == to then return nil, "请选择另一处站位" end
        if merge == false or (merge == nil and source.code ~= target.code) then
            return {14, from, to, 0, "换位"}
        end
        if source.code ~= target.code then return nil, "只能合并同种动物" end
        if target.level >= rules.max_level then return nil, "这只动物已达最高等级" end
        return {15, from, to, 0, "合并"}
    end
    if kind == "food" then
        if not view.foods[from] or view.foods[from] == 0 then return nil, "这个货位没有食物" end
        if not target then return nil, "请把食物拖向一名队员，或先点选队员" end
        if view.gold < rules.food_cost then return nil, "金币不足，喂食需 " .. rules.food_cost .. " 金" end
        return {16, from, to, 0, "喂食 · " .. rules.food_cost .. " 金"}
    end
    local reward = kind == "reward"
    local stock = reward and view.rewards or view.pets
    local code = math.abs(stock[from] or 0)
    if code == 0 then return nil, "这个货位没有动物" end
    local combines = target and target.code == code
    if combines and target.level >= rules.max_level then return nil, "这只动物已达最高等级" end
    if not combines and #team >= rules.team_size then return nil, "阵容已满，只能与同种动物合并" end
    if view.gold < rules.pet_cost then return nil, "金币不足，购买需 " .. rules.pet_cost .. " 金" end
    local destination = to and math.min(to, #team + 1) or 0
    return {combines and 12 or 11, from, destination, reward and 1 or 0,
        (combines and "购买并合并 · " or "购买 · ") .. rules.pet_cost .. " 金"}
end

function input.reroll(view, cost)
    if not view then return false, "等待商店同步后再操作" end
    if view.gold < cost then return false, "金币不足，刷新需 " .. cost .. " 金" end
    for _, shelf in ipairs({view.pets, view.foods}) do
        for _, code in ipairs(shelf) do
            if code >= 0 then return true end
        end
    end
    return false, "当前商品已全部冻结"
end

function input.team_slot(event, targets)
    local x, y = event:GetUIPos()
    local width, height = game.GetUICanvasSize()
    x, y = x - width / 2, y - height / 2
    for slot, hierarchy in ipairs(targets) do
        local slot_x, slot_y = 0, 0
        for _, control in ipairs(hierarchy) do
            local dx, dy = control:GetAnchoredPosition()
            slot_x, slot_y = slot_x + dx, slot_y + dy
        end
        local hit_w, hit_h = hierarchy[#hierarchy]:GetSizeDelta()
        if math.abs(x - slot_x) <= hit_w / 2 and math.abs(y - slot_y) <= hit_h / 2 then return slot end
    end
end

function input.bind_drag(targets, options)
    local events = Enum.CursorEventType
    local bindings = {}
    local press, drag, staged
    local function plan(origin, target)
        if origin.key ~= options.key() then return nil, "商店已更新，请重新选择商品" end
        return options.plan(origin.kind, origin.index, target)
    end
    local function source(kind, index)
        local origin = drag
        return origin ~= nil and origin.kind == kind and origin.index == index
    end
    local function mark(slot)
        if staged and staged.target == slot and plan(staged, slot) then return 2 end
        if not drag or not plan(drag, slot) then return 0 end
        return drag.target == slot and 2 or 1
    end
    local function cancel(message)
        if not drag and not staged then return false end
        press, drag, staged = nil, nil, nil
        options.changed(message or "已取消拖放")
        return true
    end
    local function bind(control, kind, fetch_index, clicked)
        local function pressed(event)
            return press and press.touch == event.touchId and press.control == control
        end
        local listeners = {
            [events.CursorDown] = function(event)
                if drag then return end
                press = {touch = event.touchId, control = control}
            end,
            [events.CursorBeginDrag] = function(event)
                if not pressed(event) then return end
                press.moved = true
                local key = options.key()
                if not key then return end
                drag, staged = {key = key, kind = kind, index = fetch_index()}, nil
                options.changed(kind == "food" and "把食物拖向一名队员" or "拖向高亮站位")
            end,
            [events.CursorDrag] = function(event)
                if not drag or not pressed(event) then return end
                local target = input.team_slot(event, targets)
                if target == drag.target then return end
                drag.target = target
                local action, reason = plan(drag, target)
                options.changed(target and (action and action[5] or reason) or "松手可取消拖放")
            end,
            [events.CursorEndDrag] = function(event)
                if not drag or not pressed(event) then return end
                local origin = drag
                local target = input.team_slot(event, targets)
                press, drag = nil, nil
                local action, reason = plan(origin, target)
                if target and action then
                    -- Native EndDrag also reports interrupted gestures. Commit only
                    -- after a new click reaches the highlighted destination.
                    origin.target, staged = target, origin
                    options.changed("点高亮站位确认" .. action[5] .. "，或取消拖放")
                else
                    options.changed(target and reason or "已取消拖放")
                end
            end,
            [events.CursorClick] = function(event)
                if not pressed(event) then return end
                local moved = press.moved
                press = nil
                if moved then return end
                if not staged then clicked(); return end
                local origin = staged
                if kind ~= "team" or origin.target ~= fetch_index() then cancel(); return end
                staged = nil
                local action, reason = plan(origin, origin.target)
                options.changed(reason)
                if action then options.apply(action); options.changed() end
            end,
        }
        if events.CursorEnter and options.inspect then
            listeners[events.CursorEnter] = function()
                if not drag and not staged then options.inspect(kind, fetch_index()) end
            end
        end
        bindings[#bindings + 1] = {control, listeners}
        for event, listener in pairs(listeners) do control:AddCursorEventListener(event, listener) end
    end
    local function destroy()
        for _, binding in ipairs(bindings) do
            local control, listeners = table.unpack(binding)
            if control.alive then
                for event, listener in pairs(listeners) do control:RemoveCursorEventListener(event, listener) end
            end
        end
    end
    return {bind = bind, destroy = destroy, source = source, mark = mark, cancel = cancel,
        waiting = function() return staged ~= nil end}
end

return input
