# v2.0.0 interaction ledger

Status: Proposed. This file separates the intended interaction basis from the narrower HTML study. Preserve verified source actions, order and information priority; justify changed behavior through actual Miliastra invite/practice/touch/native constraints. Unobserved details remain disclosed assumptions, not verified source defaults. Independent review can approve bounded assumptions for implementation without asserting release acceptance.

## Intended interaction basis and observed source

| Intent | Primary observation | Intended native behavior / bounded adaptation |
|---|---|---|
| Read details | `STV-SHOP-DETAIL` 00:04.000: lower-row pointer and Ladybug tooltip; `STV-FOOD-DETAIL` 00:08.500: Apple price/effect | PC pointer-accessible read-only detail preserves action context; hover is supported by native implementation, but the trailer does not distinguish hover from click/held input. Touch has a separate Inspect target so looking does not buy/feed/move. Inspect changes no gold, roster, selection used by economic actions, ready state or server revision. |
| Recruit/arrange | `STV-SHOP-DRAG` 00:05.000: lifted pet, shop silhouette, formation arrows and contextual Freeze; `STV-SHOP-PURCHASE` 00:05.500: pet placed in team and gold 10→7 | Retain drag/source-target affordances and explicit economic controls. A cancelled drag changes nothing. Native button/tap alternatives must show the same source, eligible destinations, cost and result; do not silently turn inspection into a swap. Frames do not prove every raw input or cancellation rule. |
| Food target | `STV-FOOD-TARGET` 00:09.500: dotted source→target and circular target highlights | Keep food separate from pets; show effect/cost, chosen target and rejection reason before/after action. Native target highlights support touch. Exact current-source input events remain unverified. |
| Match waiting | `STV-MATCH-WAIT` 00:18.000: same-turn-opponent wait text | Disclose waiting/ready/authority status. This does not establish current private lobby, invitation or timeout values. |
| Playback/causality | `STV-BATTLE-CONTROLS` 00:26.000; ability 00:27.000; damage 00:28.000; faint 00:29.000 | Preserve Rewind/Pause/Autoplay/Fast/Skip roles and actor→target→amount→changed stats→faint/effect clarity. Native mapping must be explicit. Frames are a montage, not a full causal event trace or measured timing specification. |

These are official Steam trailer observations, not a run of the current client or a named Turtle pack. See [steam-trailer-observation.md](../../references/v2.0.0/steam-trailer-observation.md) and its trace for immutable media, exact timestamps and scope. Proposed cadence must be reviewed on actual candidate captures; neither the montage nor the HTML's 1.6-second fixture establishes source timing.

## HTML study ledger (not the complete intended implementation)

The following table documents only `prototype/index.html`, including deliberate simplifications. For the current code/target differences see [IMPLEMENTATION-MAP.md](IMPLEMENTATION-MAP.md).

| Surface | Prototype behavior | Source status / decision required |
|---|---|---|
| Mode entry | Practice → shop; friend/eight-seat → lobby | Project mode requirement; source mapping unverified |
| Invite | click Invite → simulated accepted guest; no platform call | Miliastra-specific adaptation; real pending/error/cancel/retry evidence required |
| Start | 1v1 disabled until guest; 8-seat starts with bot fill | Product requirement, fixture only |
| Inspect | click recruitment/team card → adjacent detail, persistent selection outline | Pointer/detail observed in trailer (hover/click/held trigger unresolved); this HTML click-only selection is a study adaptation, not complete native hover/touch parity |
| Buy | selected recruit → Buy → first empty team; or selected recruit → empty team | Trailer supports drag→team purchase; this HTML button/target path is an illustrative alternative, not a source-input verification |
| Reorder | selected team → explicit Adjust position → second team/empty slot swaps; toggle Cancel exits move mode | HTML safety control; intended native retains established drag/source-target actions with separate read-only Inspect |
| Freeze | selected recruit → Freeze; persists through refresh/round; toggle to unfreeze | Provisional sequence, project economy sample |
| Sell | selected team → Send off; remove and add 1 gold | Provisional sequence; no confirmation in this local reversible study |
| Roll | 1 gold; refresh unfrozen recruits; preserve frozen index | Project sample, source economy/ordering unverified |
| Ready | no companions disables Ready; otherwise locks study screen and starts fixture | Provisional sequence, no multiplayer readiness implementation |
| Battle | six ordered fixture events; 1.6 s interval at 1×; 2×/4×; skip to confirmed fixture end | Timings are intentionally unverified placeholders; real event timing and source cadence must replace |
| Result | shown only after terminal event; Continue resets gold to 10; third round offers Restart | Study shortcut; production practice is 10 wins/5 lives |
| Return | returns to menu and cancels battle timer | Local study; production leave/rejoin behavior not covered |

## State and semantics

`menu → lobby → shop → battle → result → shop | end`; practice enters shop directly. `window.__prototype.snapshot()` returns a copy of local state for evidence, not a mutation API. `data-testid` controls: `mode-{practice,duel,tournament}`, `invite-friend`, `start-run`, `shop-slot-0..4`, `team-slot-0..4`, `buy-selected`, `sell-selected`, `move-selected`, `freeze-selected`, `roll-shop`, `ready-battle`, `battle-speed`, `skip-battle`, `battle-result`, `next-round`, `restart-run`, `home`.

Buttons have keyboard focus rings; all changes use button activation, selected cards have outlines, disabled actions are visually distinct and semantically disabled. Toasts are in a polite live region; economy/selection is inspectable as text. Movement can be performed by clicking/tapping rather than drag precision. Arrow-key navigation and screen-reader full playthrough are not yet validated. No sound or haptics included.

## Intended authoritative presentation contract (not all implemented)

Target input is an immutable round snapshot plus ordered server events `{matchId, roundId, sequence, eventId, kind, actorSlot, targetSlots, before, after, trigger, resultHash}`. IDs are opaque and not user copy. Queue sorts/validates contiguous sequence and ignores exact duplicate event IDs. Missing events pause; request snapshot/replay recovery. Out-of-order recovery never runs damage twice. Shop locks after authoritative ready acknowledgment, not after local button press alone. Reconnect restores the same snapshot and cursor. Skip applies all remaining confirmed deltas in order before result; never recompute combat in the view. Speed has no effect on health, placements or clocks. The local HTML only illustrates ordered presentation; it does not implement this network contract. Current room code at 179e65c also uses board-frame/re-resolution adapters; it must not be described as already implementing this exact event envelope. See IMPLEMENTATION-MAP.md for that boundary.

Required production states absent from study: invitation pending/rejected/failed, lobby full, guest left, ready pending/rejected, authority timeout, reconnect, missing-event recovery, defeat/draw, elimination/spectate, 8-seat placements, practice difficulty, unit merge/food/target selection, audio settings, replay history, replay reset and portrait rotate prompt. These are explicit product/release blockers where required by the approved scope. They do not prohibit substantive independent design-basis approval with the gaps recorded.

## Formation consistency correction

Preparation reads rear → front from left to right, matching the native right-side front convention. The highest occupied player slot is the current front, even when empty slots exist. Battle keeps that companion nearest the center; the enemy first occupied fixture slot faces it nearest the center. The first attack fixture event (sequence 003, after lock/start events) highlights those exact front actors and moves each toward the center. Data attributes expose fixture actor identity for DOM geometry assertions; they do not claim production authority.

Normal owned-card selection only inspects. Reordering requires the explicit Adjust position control and a target; Cancel exits without changing order. This mitigates accidental strategic mutations while original source behavior remains unverified.
