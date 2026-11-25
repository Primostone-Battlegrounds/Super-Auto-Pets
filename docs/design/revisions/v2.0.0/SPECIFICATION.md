# 苔原小队 / Moss & Might — v2.0.0

Status: **Proposed — not active**. Baseline: `ab73443adee5a2b5b37268779356c2fe67220886` (`develop`). This revision is a reviewable remediation proposal; an independent review, source-behavior verification and real-device acceptance must precede activation. It does not change the active release manifest or production rules.

## Product and scope

A legible five-companion auto-battler for Miliastra: one menu offers eight-seat elimination (P0), friend 1v1 (P0), and standalone AI practice (P1). Platform invitations and touch/native constraints are the only established reasons to introduce new interactions. Existing verified source interaction order, timing and information priority are the defaults. This document does **not** claim that unobserved source behavior is verified.

The official stills support a resource strip, five upper team positions, a distinct lower recruitment area, an adjacent name/price/ability panel, opposing battle groups, visible attack/health, and top playback controls. Source stills do not establish five equal recruitment slots, precise sequencing or animation timing. See `../../references/v2.0.0/reference-first.md` and its source ledger. Five recruitment positions are a project requirement; the deviation must be explicitly reconciled with the source before acceptance. Source art/layout are research only and are not distributed as product assets.

## Original identity

Working product identity: 苔原小队 / Moss & Might, a field journal about forest companions. Warm paper, deep evergreen, sage scenery, copper economy accents, original geometric creatures, generous type hierarchy, and thin botanical borders distinguish it visually. No source logos, sprites, sounds, copied character silhouettes, or proprietary UI assets are used. Project assets were not reused because no candidate was proven both original and suitable within this design pass. See `ASSET-PROVENANCE.md`.

Tokens: ink `#173d3d`, primary `#206258`, paper `#f6f3e8`, board `#dce8d4`, secondary text `#6b817b`, cost accent `#edb073`. State is communicated through words and numbers in addition to color. PC target 1440×960; mobile landscape 844×390; 48-pixel preferred touch targets, 44-pixel minimum for primary play controls. Compact slot buttons remain the full card rather than tiny numeric targets.

## Screen contract

- Menu: clearly distinguish eight seats, two friends, and practice. No account or network claim in the prototype.
- Lobby: show occupied/empty seats, readiness, invitation status, fill policy, and start availability. 1v1 waits for two ready players. Eight-seat permits one human and fills empty seats with bots. Real invitation failure/pending/retry and host loss remain mandatory runtime evidence.
- Shop: keep round, gold, wins/lives immediately visible; team precedes recruitment; five positions in each; selected details include name, tier/level, attack, health, ability trigger, target, value and cost. Keep buy/roll/freeze/sell consequences visible and actionable. Preparation front is on the right; the highest occupied team slot is the current front. In battle the player front remains nearest the center on the left lane; the enemy front is nearest the center on the right lane. Every economic mutation must derive from authoritative state in production.
- Battle: locked teams oppose toward center; present authoritative sequence, causal trigger, attack/damage, death and effects before result. Playback speed/skip may change presentation only. A missing sequence pauses and requests recovery; never fabricate a result.
- Results: show round outcome, cumulative progress, life changes, next-round grant, continuation or final placement, replay/restart and return. Practice production target remains 10 wins / 5 lives, not the prototype's three-round demonstration.

## Authority boundary

`prototype/index.html` is a deterministic local interaction study, not runtime integration, matchmaking, AI, a balance simulation, or proof of multiplayer. It uses five invented creatures, fixed ability copy, fixed shop refresh and a six-event scripted victory. Ability descriptions are presentation samples and are **not executed**. The fixture always wins and completes after three rounds. This is labeled on battle and result screens. Production must use the approved pool, economy and engine outcomes, and must implement full mode-specific elimination and final placement rules.

## Migration and review gate

Keep v1 references and archived design intact. Activate only a complete, independently reviewed revision manifest once source interaction gaps, prototype review, native device captures and multiplayer authority evidence are closed. No score based solely on code or this specification can close a visual gate. `ACCEPTANCE.md` defines measured and judged evidence; review must record exact SHA and observed captures. Current status remains NO-GO until these gates are met.
