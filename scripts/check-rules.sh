#!/bin/sh
set -eu

test -z "$(git status --porcelain --untracked-files=all)"
printf 'SAP_RULES_REVISION=%s\n' "$(git rev-parse HEAD)"
printf 'Lua 5.4 rule suites\n'
lua5.4 -v
LUA=lua5.4 sh scripts/check.sh
printf 'Lua 5.3 rule suites\n'
lua5.3 -v
for suite in tests/*.lua; do
    lua5.3 -E "$suite"
done
printf 'SAP_RULES_RESULT=passed\n'
