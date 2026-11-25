# Native practice text diagnosis

Source baseline: `ab73443adee5a2b5b37268779356c2fe67220886`. This is offline native GIL + actual upstream simulator evidence. Official game client, account permissions, HUD suppression, PC device and phone device acceptance remain pending.

## Finding

The isolated `AutoPetsTextDiagnostic` uses the **production `label()` builder**, production `.text` assignment and the real native script lifecycle. Static and dynamic Latin and CJK both survive native GIL readback and paint in the upstream simulator. A same-screen coordinate click updates both dynamic strings from gold 10 to 11 on PC and mobile simulator canvases. Font assets and account permissions are unchanged. A production title `小动物自走棋` in the original 374×46 box at font 35 reproduces zero visible lines with auto-size disabled. The same string, box, colour and font declaration paints with auto-size enabled. This isolates a demonstrated geometry/rendering failure from script binding or a general absence of CJK glyphs. It does not establish any official-account permission state.

The simulator text layout includes a block inset in its required height. A 16px single line requires 27.2px, so a 22–24px native box can paint no text. A 14px line can require 24.3px. Checking only `fontSize < box.height` misses this failure.

## Practice changes

- Explicit native auto-size with a 16px minimum for normal labels (existing smaller labels retain their size), readable name/stat/header boxes, and 25px boxes for 14px badges.
- XP / front-position information and frozen / level / effect tags use the upper badge position; purchase price, attack, health remain below names. Existing portraits and all cursor control paths remain.
- Selected details keep the same `Tooltip/Heading` and `Tooltip/Body` paths. A 72px panel fits within the existing 74px gap between team and shop hit areas. The body allows two lines down to 14px. Bounds, selection underline separation, same-screen input and popup separation are checked by the native acceptance harness.
- Evergreen, warm paper and pale sage colours follow the v2 design tokens. No new gameplay or copied external UI/game assets are introduced.
- Battle movement remains driven by actual `attack` and `damage` event side/slot/target data. Existing regression verifies attack lunge moves toward the named opposing target, damage popup matches actual health loss, shielding, summons, pause, replay and lifecycle release. No ambient animal motion substitutes for battle events.

## Proven project comparison

Read-only comparison against Slay-the-Heavens `79abbb50ec5ed0b536db5c8961a0593352758b74`: `src/lua/abyss_node_ui.lua` uses direct `.text` / `.fontColor` binding and visibility changes, and documents install-before-render and stable input identity. Its `scripts/build-ui.mjs` validates native font sizes, colour syntax, child capacities and control ownership. Practice follows the same property-binding model, binds inputs once, releases exact listener identities, and pauses updates/audio on disable. No source or assets were copied.

## Reproduction

Use the pinned MCP `59c576e41632a6bf6781bbca83a676d0da0374ec` with `MILIASTRA_ALLOW_LIVE_WRITE=0`.

```
node tests/native/verify-text.mjs <MCP> <new-text-build> <lua5.3>
node tests/native/text-simulator.mjs <MCP> <simulator> <simulator-native.mjs> <text-build>/scenes/saves/text-diagnostic.gil <new-render-dir>
LUA54=<lua5.4> node tests/native/verify-m1.mjs <MCP> <new-practice-build> <lua5.3> --release
```

The text renderer test asserts positive painted line counts for static/dynamic Latin+CJK, successful coordinate hit targeting and updated text, plus the original-title zero-line reproduction and auto-size repair. The simulator native adapter is produced by the runtime workstream; it imports GIL UI and scripts into the upstream simulator, rather than using the legacy mocked-frame preview.

The practice acceptance harness passes Lua 5.3/5.4 source and native readback parity, all 15 rounds / six tiers, cursor and drag interactions, actual event anchoring, summon replay, win terminal, restart and release of all 95 listeners. PC/mobile acceptance harness frames match. Actual upstream renderer evidence additionally covers five canvas shapes and coordinate clicks through menu, pet selection, purchases and battle entry; all 1,395 nonempty labels in 35 actual-renderer frames fully fit and paint inside the canvas. `node tests/native/text-paint-check.mjs <render-dir>` checks the exact upstream paint output.

Local evidence is kept outside source control in `/workspace/work/native-text-proof-v3`, `/workspace/work/native-text-render-v3`, `/workspace/work/native-practice-proof-final` and `/workspace/work/native-practice-render-final`. These are work evidence paths, not official device receipts. Final integrated candidate hashes and packaged user-facing evidence belong to the integration workstream.
