local modules = {
    compatibility = "autopets.data",
    release = "autopets.release_data",
    expanded = "autopets.expanded_data",
}

return function(profile)
    return require(assert(modules[profile or "compatibility"], "unknown content profile: " .. tostring(profile)))
end
