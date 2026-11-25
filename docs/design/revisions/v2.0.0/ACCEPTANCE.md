# v2.0.0 acceptance and evidence contract

Design status: **Proposed**. Product/release decision: **NO-GO**; these are separate axes. A passing HTML study does not satisfy native/runtime, source-reuse, multiplayer, license, balance or release gates. Evidence records must use actual observations and immutable artifact references. Never replace `not_run` with an inferred pass.

## Independent design-basis review

An independent reviewer may approve the exact design as the implementation basis while official-device checks remain pending. Bind the review to full Git SHA, design fingerprint, source references and reviewed artifacts. Assess the complete intended design, observed-source mapping, justified Miliastra adaptations, implementation-map accuracy, screen/state coverage, causal clarity, usability and honest limitations. Record substantive findings and resolutions; a mere document presence check or HTML smoke pass is insufficient. Clearly state whether approval covers the design basis, the implemented candidate or release; never conflate them.

Pending physical runs and incomplete current-client access must remain explicit in the approval. The reviewer can accept a bounded design assumption with a named follow-up and risk, but cannot call it source-verified. Later manifest activation is a separate authorized lifecycle action under repository policy. No status is activated here. An independently reviewed Proposed revision may be selected for isolated implementation according to that policy. Selection/approval does not close the product gates below.

## Product/release gates

| ID | Acceptance | Required independent evidence |
|---|---|---|
| D01 | All three entries distinguish player counts and destination; 1v1 waits, eight-seat shows bot-fill | PC + mobile native recordings from menu through lobby/start; pending/failure/retry invites |
| D02 | Five team slots, recruitment inventory and costs, selected trigger/target/value, buy/roll/freeze/sell/reorder are readable and operable | Official trailer source mapping with its limits, justified platform deviations and current-client gaps; both-device uncut candidate transaction trace |
| D03 | Confirmed ordered events → damage/trigger/death → final result; speed/skip do not change outcome | Same authoritative round at each speed, skip, late/duplicate/gap recovery, before/after state hashes |
| D04 | Result reflects real round/lives/placements; continue/replay/restart work | Practice complete 10-win or 5-life run; two-device 1v1; 8-seat real/bot/odd-survivor/quit matrix |
| D05 | Wide PC and mobile landscape have no clipped text, inaccessible primary actions or horizontal overflow; no precision-only drag | Native viewport capture, measured text/target sizes, keyboard/touch run; font fallback/offline run |
| D06 | Original visual identity/assets; provenance and source ledgers complete | Asset-by-asset license/original evidence review; do not reuse source art |
| D07 | Every scored screen reaches requested quality bar independently | Same anchored rubric, actual baseline and current captures, reviewer/SHA, criterion-level scores |
| D08 | Source interactions/timing/info priority reused unless real platform constraint | Approved mapping of observed trailer actions versus unverified raw input/timing/current-client gaps; justified platform adaptations; further current-client trace when accessible. Stills cannot prove raw events or exact pacing |

## Visual rubric (0–10 per screen, five 0–2 criteria)

Judge menu, lobby, shop/detail/arrangement, battle, and result separately on both target surfaces. Each criterion: 0 absent/broken; 1 usable with noticeable flaws; 2 polished with only minor nits. Criteria: (1) hierarchy and information completeness, (2) readable type/contrast at actual viewport, (3) coherent original art and composition, (4) clear interactive feedback and states, (5) responsive/input fit. Anchors: 3–4 broken; 5 distracting; 6 acceptable roughness; 7 good with a visible flaw; 8 polished; 9 excellent; 10 best-in-class. Scores are judgments; viewport overflow, target size and state invariants are measurements. Benchmark is comparable clarity/usability to observed source, with an original identity, not visual imitation.

Do not invent a target score if the active brief has none; carry the root review's target verbatim. A target applies to every item, never just the average. Capture baseline before editing; this prototype has no historical baseline capture, so its before score is `not_available`, not zero. Native baseline belongs in the runtime evidence set. Independent reviewer must score actual captures and interactions, not infer from this spec. No self-awarded acceptance score is recorded here.

## Record format: one actual observation per device / case

Save JSON (or JSONL) at `qa/evidence/<revision>/<device>/<case>.json`; captures and traces should be immutable and hash-addressed. Required keys and realistic **sample** (not a run result):

```json
{
  "schema_version": 1,
  "design_revision": "2.0.0",
  "design_status": "Proposed",
  "case_id": "D02-buy-freeze-reorder",
  "git_sha": "FULL_40_CHAR_SHA",
  "observed_at_utc": "2026-11-25T00:00:00Z",
  "evidence_kind": "native-device",
  "device": {"platform": "PC", "model": "ACTUAL_MODEL", "os": "ACTUAL_OS", "viewport_css": [1440, 960], "input": "mouse-keyboard"},
  "mode": "practice",
  "steps": ["select recruit", "buy", "freeze next recruit", "roll", "reorder"],
  "expected": "authoritative currency and five-slot order match display",
  "actual": "WRITE OBSERVED OUTCOME",
  "result": "not_run",
  "artifacts": [{"path": "shop-pc.mp4", "sha256": "ACTUAL_HASH", "start_s": 0, "end_s": 35}],
  "source_mapping": "reference-ledger-case-ID OR unverified",
  "reviewer": "INDEPENDENT_REVIEWER",
  "limitations": []
}
```

Mobile uses the same schema with `platform: "mobile"`, actual phone/model/OS, `viewport_css: [844,390]`, `input: "touch"`. A desktop browser at that size is `evidence_kind: "browser-emulation"`, not native mobile. Multiplayer case additionally supplies two actual device records, anonymized match/round IDs, authority log hash, event/state hashes, join/ready/reconnect timestamps, and the bot-fill matrix. Never include account tokens or private invitation URLs.

Score record sample: `{"screen":"shop","device":"mobile-landscape","before":null,"after":null,"criteria":{"hierarchy":null,"type":null,"art":null,"feedback":null,"fit":null},"target":null,"reviewer":"PENDING","capture":"ACTUAL_PATH","git_sha":"FULL_SHA","result":"not_run"}`. Null means unscored, not failed. Include reasons for every point deduction and recapture after fixes.

## Actual local prototype verification

Browser: installed Chromium 154.0.8037.57, Playwright, headless; local HTTP; viewports 1440×960 and 844×390. This is **browser emulation**, not official PC/mobile runtime. Executed cases: three mode entry paths; 1v1 start disabled before guest; simulated invite feedback; buy through detail and target slot; reorder; freeze/roll/next-round preservation; gold changes; battle speed/skip; result; three-round fixture end; restart reset; sell; no horizontal landscape overflow; Ready inside the viewport; first attack highlights the right-side preparation front and both battle fronts face the center (measured DOM geometry); no uncaught page errors. Whole-screen fading was removed from state updates and the fixed victory is labeled a demonstration result. Final script run record is supplied separately with captures. This evidence does not verify production combat, abilities, original interaction timing, platform invitations, reconnection, sound, native performance, or full accessibility.

Captures under `/workspace/work/sap-evidence/prototype/`: `menu-wide.png`, `lobby-wide.png`, `shop-wide.png`, `shop-landscape.png`, `battle-wide.png`, `result-wide.png`. Full-page images are labeled accordingly and must not substitute for viewport-fit checks. A later independent visual review owns score conclusions and product/release remains NO-GO until applicable product gates close. Design-basis approval is assessed separately as above; it is not barred solely because physical-device runs remain pending.

## Separate decision record sample

`{"git_sha":"FULL_SHA","design_fingerprint":"ACTUAL_FINGERPRINT","independent_reviewer":"ACTUAL_REVIEWER","design_basis":"approved|changes_requested|not_reviewed","review_artifacts":["ACTUAL_IMMUTABLE_PATH"],"substantive_findings":["ACTUAL_FINDING_AND_RESOLUTION"],"accepted_assumptions":["BOUNDED_GAP_WITH_FOLLOWUP"],"official_pc":"pending","official_mobile":"pending","product_release":"NO-GO","manifest_status":"Proposed"}`. This is a schema example, not an approval. The reviewer owns the real decision and must justify it from actual evidence.
