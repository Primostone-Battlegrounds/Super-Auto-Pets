#!/bin/sh
set -eu

checkout=${1:?Usage: sh platform/setup-tools.sh <new MCP checkout directory>}
revision=59c576e41632a6bf6781bbca83a676d0da0374ec
test ! -e "$checkout"

git init -q "$checkout"
git -C "$checkout" remote add origin https://github.com/FurinyaWorks/genshin-miliastra-mcp.git
git -C "$checkout" fetch --depth=1 origin "$revision"
git -C "$checkout" checkout -q --detach FETCH_HEAD
test "$(git -C "$checkout" rev-parse HEAD)" = "$revision"

# Keep pinned tarball integrity hashes while using the npm public registry.
node - "$checkout/npm-shrinkwrap.json" <<'JS'
const fs = require("node:fs");
const lock = process.argv[2];
const contents = fs.readFileSync(lock, "utf8");
fs.writeFileSync(lock, contents.replaceAll("https://registry.npmmirror.com/", "https://registry.npmjs.org/"));
JS
npm --prefix "$checkout" ci --no-audit --no-fund
npm --prefix "$checkout" run build:core
