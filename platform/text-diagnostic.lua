-- Isolated diagnostic; deliberately uses the production .text property, colour,
-- visibility and cursor lifecycle. No font resource or permission is changed.
local root, hit, handler
local count = 0
local function render()
    local latin = "Shop 123 / Gold " .. (10 + count)
    local cjk = "单人练习 · 金币 " .. (10 + count)
    for index, value in ipairs({latin, cjk}) do
        local node = assert(root:FindChild("Dynamic" .. (index - 1)))
        node:SetActive(true)
        node:SetVisible(true)
        node.text = value
        assert(node.text == value, "dynamic text property readback failed")
        print("AUTO_PETS_TEXT_BINDING Dynamic" .. (index - 1) .. "=" .. node.text)
    end
end
function OnStart()
    root = script.object
    count = 0
    hit = assert(root:FindChild("Cycle/Hit"))
    handler = function() count = count + 1; render() end
    hit:AddCursorEventListener(Enum.CursorEventType.CursorClick, handler)
    render()
end
function OnEnable()
    if root then render() end
end
function OnDestroy()
    if hit and hit.alive then hit:RemoveCursorEventListener(Enum.CursorEventType.CursorClick, handler) end
    root, hit, handler = nil, nil, nil
end
