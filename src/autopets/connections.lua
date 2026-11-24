local connections = {}

function connections.detach(by_connection, seat)
    if seat.connection then
        by_connection[seat.connection] = nil
        seat.connection = nil
    end
end

function connections.attach(by_connection, seat, index)
    connections.detach(by_connection, seat)
    seat.connection = {}
    seat.expires = nil
    by_connection[seat.connection] = index
    return seat.connection
end

function connections.next_expiry(seats)
    local earliest
    for _, seat in pairs(seats) do
        if seat.expires and (not earliest or seat.expires < earliest) then
            earliest = seat.expires
        end
    end
    return earliest
end

return connections
