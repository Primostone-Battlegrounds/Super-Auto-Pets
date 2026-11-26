local art = require("autopets.art")

-- Both practice and multiplayer draw the same layered portraits. Bind the
-- control lookup and scale once per view, and repaint only when a slot changes.
return function(control, scale)
    local portraits = {}
    return function(path, id, mirrored, fitted_scale)
        local key = id and (id .. (mirrored and ":left" or ":right")) or false
        if portraits[path] == key then return end
        portraits[path] = key
        local layers = id and assert(art[id], id) or {}
        local layer_scale = fitted_portraits and fitted_scale or scale
        local extra
        if fitted_portraits then
            local picture = control(path)
            picture:SetLocalScale(mirrored and -1 or 1, 1, 1)
            if fitted_portrait_template then
                extra = picture:FindChild(fitted_portrait_name)
                if #layers > portrait_layers and not extra then
                    extra = assert(game.InstantiateClientUIControl(fitted_portrait_template, picture))
                    extra:SetAsLastSibling()
                elseif #layers <= portrait_layers and extra then
                    game.DestroyClientUIControl(extra)
                    extra = nil
                end
            end
        end
        for index = 1, extra and fitted_portrait_limit or portrait_layers do
            local name = "Layer" .. index
            local node = index <= portrait_layers and control(path .. "/" .. name) or extra:GetChild(name)
            local layer = layers[index]
            if layer then
                local image, x, y, width, height, r, g, b, rx, ry, rz = table.unpack(layer)
                node:SetActive(true)
                node:SetImage(Enum.ImageSource.StaticReference, image)
                if image ~= 100003 then node.imageType = Enum.ImageType.Stretch end
                if fitted_portraits then node:SetLocalRotation(rx or 0, ry or 0, rz or 0) end
                node:SetAnchoredPosition((mirrored and not fitted_portraits and -x or x) * layer_scale, y * layer_scale)
                node:SetSizeDelta(width * layer_scale, height * layer_scale)
                node.imageColor = Color(r, g, b, 255)
            end
            node:SetVisible(layer ~= nil)
            if not layer then node:SetActive(false) end
        end
    end
end
