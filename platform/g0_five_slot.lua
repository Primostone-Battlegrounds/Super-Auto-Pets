local root = script.object
local marker = root:GetChild("InputMarker")
local slots = {
    root:GetChild("Slot1"),
    root:GetChild("Slot2"),
    root:GetChild("Slot3"),
    root:GetChild("Slot4"),
    root:GetChild("Slot5"),
}
local click = Enum.CursorEventType.CursorClick
local listeners = {}

function OnStart()
    marker:SetActive(true)
    marker:SetVisible(false)
    local markerY = marker.anchoredPositionY
    for position, slot in ipairs(slots) do
        slot:SetActive(true)
        local face = slot:GetChild("Face")
        face:SetActive(true)
        face:SetVisible(true)

        local hit = slot:GetChild("Hit")
        hit:SetActive(true)
        hit:SetVisible(true)
        local function onClick()
            marker:SetAnchoredPosition(slot.anchoredPositionX, markerY)
            marker:SetVisible(true)
            print("AUTO_PETS_G0 slot=" .. tostring(position))
        end
        hit:AddCursorEventListener(click, onClick)
        listeners[hit] = onClick
    end
    print("AUTO_PETS_G0 ready")
end

function OnDestroy()
    for hit, onClick in pairs(listeners) do
        if hit.alive then
            hit:RemoveCursorEventListener(click, onClick)
        end
    end
    listeners = {}
end
