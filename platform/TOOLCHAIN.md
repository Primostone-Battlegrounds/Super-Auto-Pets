# Isolated runtime verification

`toolchain-lock.json` pins both source repositories. The MCP upstream identifies itself as **unofficial**. Its isolated build tools and the external simulator are separate from the official game client. Neither can establish an official-device pass.

Use `platform/setup-tools.sh <new-MCP-checkout>` for the pinned MCP, then `npm --prefix <MCP> run build:core`. Set `MILIASTRA_ALLOW_LIVE_WRITE=0`; all native builds use a new scratch directory and `Service({workspace, saveRoots:[], allowLive:false})`. Never point the service at formal save roots. No Owner desktop, formal save, or publication is part of this verification.

Install simulator source at the locked commit, then run `pnpm@10.15.0 install --frozen-lockfile --ignore-scripts` in its root. Use an npm cache under scratch if the home directory is read only. The executed cloud experiment used Node 24.19.0, upstream exact direct dependencies installed with npm, and local workspace package links. No upstream simulator Lua/runtime/rendering source was edited. Remote sprite fetch in this environment requires Node `--use-env-proxy`.

```sh
node tests/simulator/native.test.mjs "$MCP" "$PACKAGE/super-auto-pets.gil"
SIMULATOR_REQUIRE_TEXT=1 node --use-env-proxy scripts/simulator-verify.mjs \
  "$MCP" "$SIMULATOR" "$PACKAGE/super-auto-pets.gil" "$NEW_EVIDENCE_DIR"
```

The verifier reads actual UI, IDs, exact embedded Lua and instance parameters from the GIL. Its narrow parameter adapter supplies native GIL values before upstream Lua script mount because the upstream authoring compiler drops those values. It reverses native drawing-order lists into the simulator's editor-order lists. Its integration test checks geometry, text, initial visibility, ID uniqueness and source digests against the upstream save reader. Only container, image, text, cursor and preset button controls are supported; other kinds fail explicitly.

The output is an upstream simulator save, per-viewport runtime JSON and software PNG captures, and `receipt.json`. `sourceRevision` and `designVersion` come from neighboring `BUILD.json` when available; its GIL digest is checked. The receipt separates actual Lua pointer/update execution from explicit server fixtures. No GIL node graphs execute in this simulator. Audio instances are observable; audibility and official-client asset fidelity remain unverified. Rendering text with the upstream font/layout implementation does not validate official account text-display permissions.

For another interface set `SIMULATOR_UI`; `SIMULATOR_CLICKS` accepts a JSON array of exact root-relative cursor paths. Every click resolves the actual control and asserts coordinate hit testing finds that control before pointer down/up injection. Missing or occluded paths fail. `SIMULATOR_REQUIRE_TEXT=1` fails on any nonempty painted textbox with no visible line and records its frame, control name, content, height and required height. Runtime errors fail independently. `observed-text-defects` is evidence of failure, never an acceptance pass.

The baseline experiment at source `ab73443adee5a2b5b37268779356c2fe67220886` built GIL SHA-256 `5bd4af6c68bad1181d1ade22ff9fe147353ac1b0ddc7f95ae7c341d80db5d657`. Actual simulator captures show title height 61 versus required 67.8 and status height 30 versus required 37.35, both with zero visible lines. This is a simulator reproduction, not a proposed explanation of official-client permission behavior. The prior Slay-the-Heavens native importer experiment informed the readback direction and strict evidence boundaries; no game assets were copied.

The expanded verifier replays the existing literal fifteen-round practice input fixture through real coordinate hit testing. It captures the first battle before and after 120 actual update frames, tier six, terminal state and restart. It also creates separate two-client and eight-client Lua sessions with explicitly supplied authoritative-wire-schema fixtures, different per-player fixture money, each player's preparation capture, and a real buy input with its emitted request checked. These client fixtures prove parsing/rendering/input dispatch only. They never prove networking, server graph execution, shopping authority, settlement or reconnect.

The baseline expanded run additionally exposed Fengari's absent `string.pack` when the production practice training hash executes at next-round transition. This is a real simulator compatibility failure and the verifier records its stack and captures a runtime-exception frame before continuing the other configurations. It does not polyfill or patch production Lua to hide that failure.
