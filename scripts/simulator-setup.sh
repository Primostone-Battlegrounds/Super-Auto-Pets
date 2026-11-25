#!/bin/sh
set -eu
checkout=${1:?Usage: sh scripts/simulator-setup.sh <new checkout> <scratch>}
scratch=${2:?Provide dependency cache scratch directory}
revision=9ef690044c68ed2d1553c158f14122a89200a458
test ! -e "$checkout"
mkdir -p "$scratch"
scratch=$(cd "$scratch" && pwd)
git init -q "$checkout"
git -C "$checkout" remote add origin https://github.com/1475505/miliastra-beyond-simulator.git
git -C "$checkout" fetch --depth=1 origin "$revision"
git -C "$checkout" checkout -q --detach FETCH_HEAD
test "$(git -C "$checkout" rev-parse HEAD)" = "$revision"
# Distribution prepare/build is unnecessary for direct source imports. Respect
# the upstream dependency lock and workspace package links, with writable cache.
XDG_CACHE_HOME="$scratch/cache" XDG_DATA_HOME="$scratch/data" \
  npm exec --cache "$scratch/npm-cache" --yes --package=pnpm@10.15.0 -- \
  pnpm --dir "$checkout" install --frozen-lockfile --ignore-scripts --store-dir "$scratch/pnpm-store"
