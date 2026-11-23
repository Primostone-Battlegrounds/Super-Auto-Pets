local sourcePath = assert(arg[1], "provide the Lua read from the GIL")
assert(_VERSION == "Lua 5.3", "the Miliastra client uses Lua 5.3")

local control = {}
control.__index = control
function control:SetActive(value) self.active = value end
function control:SetVisible(value)
    assert(self.active)
    self.visible = value
end

local events = {}
local marker = setmetatable({ anchoredPositionY = -54, visible = true }, control)
function marker:SetAnchoredPosition(x, y)
    assert(self.active)
    self.anchoredPositionX, self.anchoredPositionY = x, y
end

local children = { InputMarker = marker }
local hits = {}
local cursorClick = "CursorClick"
local expectedX = { -320, -160, 0, 160, 320 }
for index, x in ipairs(expectedX) do
    local hit = setmetatable({ alive = true }, control)
    function hit:AddCursorEventListener(event, callback)
        assert(self.active and self.visible and self.alive)
        assert(event == cursorClick and self.callback == nil)
        self.callback = callback
    end
    function hit:RemoveCursorEventListener(event, callback)
        assert(self.alive and event == cursorClick and self.callback == callback)
        self.callback = nil
    end
    local name = "Slot" .. index
    local slot = setmetatable({ anchoredPositionX = x }, control)
    local controls = { Face = setmetatable({}, control), Hit = hit }
    function slot:GetChild(childName) return (assert(controls[childName], childName)) end
    children[name] = slot
    hits[index] = hit
end

local root = {}
function root:GetChild(name) return (assert(children[name], name)) end

local client = setmetatable({
    script = { object = root },
    Enum = { CursorEventType = { CursorClick = cursorClick } },
    print = function(message) events[#events + 1] = message end,
}, { __index = _G })
assert(loadfile(sourcePath, "t", client))()
client.OnStart()
assert(marker.active and not marker.visible)
assert(events[1] == "AUTO_PETS_G0 ready" and #events == 1)
for index in ipairs(expectedX) do
    local slot = children["Slot" .. index]
    local face = slot:GetChild("Face")
    assert(slot.active and face.active and face.visible)
end

for step, position in ipairs({ 3, 1, 5, 2, 4, 4 }) do
    local hit = hits[position]
    assert(hit.callback, "missing click callback")()
    assert(marker.visible and marker.anchoredPositionX == expectedX[position])
    assert(marker.anchoredPositionY == -54)
    assert(events[step + 1] == "AUTO_PETS_G0 slot=" .. position)
    assert(#events == step + 1)
end

client.OnDestroy()
for _, hit in pairs(hits) do assert(hit.callback == nil) end
for _, event in ipairs(events) do print(event) end
