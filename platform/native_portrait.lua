local art = require("autopets.art")

-- Both practice and multiplayer draw the same layered portraits. Bind the
-- control lookup and scale once per view, and repaint only when a slot changes.
return function(control, scale)
    local portraits = {}
    return function(path, id, mirrored)
        local key = id and (id .. (mirrored and ":left" or ":right")) or false
        if portraits[path] == key then return end
        portraits[path] = key
        local layers = id and assert(art[id], id) or {}
        for index = 1, portrait_layers do
            local node = control(path .. "/Layer" .. index)
            local layer = layers[index]
            if layer then
                local image, x, y, width, height, r, g, b = table.unpack(layer)
                node:SetActive(true)
                node:SetImage(Enum.ImageSource.StaticReference, image)
                node.imageType = Enum.ImageType.Stretch
                node:SetAnchoredPosition((mirrored and -x or x) * scale, y * scale)
                node:SetSizeDelta(width * scale, height * scale)
                node.imageColor = Color(r, g, b, 255)
            end
            node:SetVisible(layer ~= nil)
            if not layer then node:SetActive(false) end
        end
    end
end
