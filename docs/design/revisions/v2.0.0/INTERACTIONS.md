# v2.0.0 interaction ledger

Status: Proposed. All sequences and timings below are prototype hypotheses unless explicitly marked as observed. The official screenshots verify information hierarchy only. Under the user's strict reuse requirement, unverified sequences cannot become active defaults. Capture original behavior, retain its defaults, and justify changes only for a real Miliastra invite/practice/touch/native constraint.

| Surface | Prototype behavior | Source status / decision required |
|---|---|---|
| Mode entry | Practice → shop; friend/eight-seat → lobby | Project mode requirement; source mapping unverified |
| Invite | click Invite → simulated accepted guest; no platform call | Miliastra-specific adaptation; real pending/error/cancel/retry evidence required |
| Start | 1v1 disabled until guest; 8-seat starts with bot fill | Product requirement, fixture only |
| Inspect | click recruitment/team card → adjacent detail, persistent selection outline | Panel observed; actual input sequence unverified |
| Buy | selected recruit → Buy → first empty team; or selected recruit → empty team | Provisional; reconcile with observed original sequence |
| Reorder | selected team → explicit Adjust position → second team/empty slot swaps; toggle Cancel exits move mode | Provisional; no claim that source uses this sequence |
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

## Production authoritative presentation contract

Input is an immutable round snapshot plus ordered server events `{matchId, roundId, sequence, eventId, kind, actorSlot, targetSlots, before, after, trigger, resultHash}`. IDs are opaque and not user copy. Queue sorts/validates contiguous sequence and ignores exact duplicate event IDs. Missing events pause; request snapshot/replay recovery. Out-of-order recovery never runs damage twice. Shop locks after authoritative ready acknowledgment, not after local button press alone. Reconnect restores the same snapshot and cursor. Skip applies all remaining confirmed deltas in order before result; never recompute combat in the view. Speed has no effect on health, placements or clocks. The local HTML only illustrates ordered presentation; it does not implement this network contract.

Required production states absent from study: invitation pending/rejected/failed, lobby full, guest left, ready pending/rejected, authority timeout, reconnect, missing-event recovery, defeat/draw, elimination/spectate, 8-seat placements, practice difficulty, unit merge/food/target selection, audio settings, replay history, replay reset and portrait rotate prompt. These are explicit release blockers where required by the approved scope.

## Formation consistency correction

Preparation reads rear → front from left to right, matching the native right-side front convention. The highest occupied player slot is the current front, even when empty slots exist. Battle keeps that companion nearest the center; the enemy first occupied fixture slot faces it nearest the center. The first attack fixture event (sequence 003, after lock/start events) highlights those exact front actors and moves each toward the center. Data attributes expose fixture actor identity for DOM geometry assertions; they do not claim production authority.

Normal owned-card selection only inspects. Reordering requires the explicit Adjust position control and a target; Cancel exits without changing order. This mitigates accidental strategic mutations while original source behavior remains unverified.
