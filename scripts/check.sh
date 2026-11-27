#!/bin/sh
set -eu

lua_command=${LUA:-lua}
backlog doctor
node --test tests/design-contract.test.mjs tests/product-release.test.mjs
"$lua_command" -e 'assert(_VERSION == "Lua 5.4", "Lua 5.4 required")'
for test_file in tests/*.lua; do
    if [ -f "$test_file" ]; then
        "$lua_command" "$test_file"
    fi
done
