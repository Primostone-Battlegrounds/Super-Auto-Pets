#!/bin/sh
set -eu

lua_command=${LUA:-lua}
backlog doctor
"$lua_command" -e 'assert(_VERSION == "Lua 5.4", "Lua 5.4 required")'
for test_file in tests/*.lua; do
    if [ -f "$test_file" ]; then
        "$lua_command" "$test_file"
    fi
done
