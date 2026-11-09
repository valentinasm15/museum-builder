# Phase prompts (paste one per fresh Claude Code session, from the museum-builder folder)

## Phase 1 — Engine + data
```
Build Phase 1 of Museum Builder (follow CLAUDE.md).
Read only DESIGN §4, §5, §10 row 1. All data is in src/data/museum-builder-data.xlsx; read its "How to edit" sheet first.
1. Scaffold Vite + React + TS with Zustand, Vitest, SheetJS. Nothing else.
2. src/data/load.ts: read all sheets (Settings, Items, Personas, Zones, Route, Existing, Scoring, Texts) into typed objects; fail clearly on a missing sheet/column.
3. src/engine/score.ts (pure functions): requirement checks (; = all, | = any, tokens route/has_screen), Existing items placed at €0, reach via shared Route segments, info, enhance_factor, richness, single-channel penalty, zoneScore, personaScore, overall.
4. src/engine/benchmark.ts: greedy benchmark using item+requirements bundles at equal spend; money efficiency; marginal contribution per item.
5. score.test.ts (loads the real xlsx): replica without label/audio inactive; braille helps only braille reader; smartphone audio excludes non-smartphone persona; shared route segment paid once; enhance_factor boosts large print; benchmark beats braille-everywhere at equal spend.
Stop when tests pass. No UI. Report in ≤5 lines and list rules you had to assume.
```

## Phase 1b — data-driven reach + lighting (short, run before Phase 2)
```
Follow CLAUDE.md. The Excel changed; update the engine only (read score.ts, load.ts, benchmark.ts; no need to read DESIGN).
1. Items has a new column reach_grant: replace the hard-coded ids 'guided_touch_tour' and 'tactile_floor_plan' in score.ts with lookups on reach_grant ('staff_guided', 'plan_only').
2. Scoring has a new parameter lighting_reach_factor: for a persona with residualVision, reach to a zone that has the 'lighting' item placed is multiplied by it (cap 1.0).
3. New item exhibit_view (channel 'visual', existing in every zone) and Texts key ch_visual: make sure the channel lookup handles 'visual'. Lighting now enhances large_print_label and exhibit_view via enhance_factor.
4. Update tests: lighting raises low-vision reach and exhibit_view value; blind personas get nothing from lighting; renaming guided_touch_tour in the xlsx still works when reach_grant moves with it.
Run tests (dot reporter). Report in ≤5 lines.
```

## Phase 1c — scoring fixes (run AFTER Phase 2, BEFORE Phase 3)
```
Follow CLAUDE.md. Engine only (score.ts, benchmark.ts, tests). The xlsx changed: costs x5; Personas: blind_braille usesSmartphone TRUE, new persona blind_no_smartphone, shares changed; reach_grant 'staff_guided' moved from guided_touch_tour to staff_training; new item 'headphones' (audio_guide_devices requires it); new Items column 'kind' (enabler/comfort/undecided); new Scoring parameter comfort_bonus. Loader must not fail on the new column; persona count is not fixed.
1. Money efficiency: compare the player's access with the benchmark built for the FULL budget (primary figure), so spending €0 does not give 100%. Also return the benchmark access at the player's own spend as a secondary figure, plus budget left unspent.
2. exhibit_view must not count as a usable channel for the richness bonus or the single-channel penalty (it still gives info value and is boosted by lighting).
3. Items with kind 'comfort' placed in a zone add Scoring.comfort_bonus (additive, cap 1.0) to that zone's score for every persona that already scores > 0 there. Never creates access on its own.
4. Tests: fix any that broke from the data changes (e.g. the reach_grant rename test must rename staff_training); add: staff training alone gives staff-guided reach to every zone; audio guide devices reach blind_no_smartphone but not without headphones; smartphone audio does not reach blind_no_smartphone; efficiency at €0 is low when the benchmark at full budget is high; low vision with audio alone is below 100%; seating adds the comfort bonus only where the score is > 0.
5. Re-run the compare script (re-create it if gone; do not commit it) for 4 plans: existing only; braille labels + route to all; audio descriptions + smartphone audio + route to all; benchmark. Print per-persona score, overall, efficiency, and the benchmark cost for full access vs the budget.
Run tests (dot reporter). Report in ≤5 lines plus the table.
```

## Phase 2 — Structured UI + EN/FI + deploy
```
Build Phase 2 (follow CLAUDE.md). Read only DESIGN §3, §7, §10 row 2.
1. src/ui: Catalogue (item cards: cost, needs, who it is for; no value-per-€), Room text view (zones with placed items and which work), Budget bar. Select item → select zone; keyboard-only; aria-live announcements; no drag.
2. Language toggle EN/FI from the Texts sheet and name_fi columns; set the lang attribute.
3. GitHub Actions workflow deploying to GitHub Pages (Vite base = repo name).
Engine tests may fail until Phase 1c because the Excel changed: do not touch score.ts, benchmark.ts or the tests in this phase. If load.ts fails on a new column or sheet row, fix only the loader. Stop when a full placement round works by keyboard in both languages and the build passes. Report in ≤5 lines.
```

## Phase 3 — Walkthrough + debrief + log (testing-ready)
```
Build Phase 3 (follow CLAUDE.md). Read only DESIGN §5 ("What the debrief must show"), §10 row 3.
1. src/engine/visit.ts: per persona, an ordered text walkthrough built only from Texts walk_*/ch_* templates and engine results (reach, usable channels, inactive items, zone exhibits). Items with kind enabler/comfort/undecided are listed separately in the debrief, e.g. 'Comfort items (seating): €X, not part of the access score'. If a zone's exhibits cell is blank, use "the exhibits in {zone}" (localised) instead.
2. "Open the museum" shows the walkthrough per persona (tabs/select), then the debrief in the §5 order, using deb_* templates; feedback.ts gives templated advice.
3. src/log.ts: record every place/remove/round/debrief view with timestamps; "Export session log" downloads JSON. Rounds: start round 2 with the same budget.
Stop when a full 2-round session works by keyboard and the log exports. Report in ≤5 lines.
```

Phases 4–6: write the prompt the same way from DESIGN §10 rows 4–6.


## Phase 3a — isometric scene (NOW: comes right after Phase 2, before Phase 1c)
```
Phase 3a: isometric scene (follow CLAUDE.md; this supersedes the phase order in DESIGN §10, the scene now comes right after Phase 2). Read only DESIGN §2, §7, §8. View docs/postimuseo-plan.jpg (the real tactile floor plan) and docs/style-reference.png (the look we want), once each.
Goal: it must feel like a videogame, not a form: a 3D isometric diorama of the Postimuseo ground floor that mirrors the game state.
1. Layout data first (the only xlsx edit this phase): Zones gets columns x, y, w, h (grid tiles, whole floor about 24x18); Route gets x1, y1, x2, y2 per segment (a path from the entrance through the zones, following the dashed line and corridors on the plan); add the entrance position. Keep to the 6 zones already listed; other plan areas are plain walls.
2. src/scene (react-three-fiber, orthographic camera at an isometric angle, rotate in 90-degree steps with Q/E and buttons, zoom with +/- and wheel): floor, outer walls, each zone as a low platform with its name, route segments as yellow ribbed strips (existing = solid, not yet built = outlined ghost), placed items as simple low-poly blocks on their zone (shape + colour by channel, plus a small icon), unreachable or inactive items visibly dimmed with an icon (never colour alone).
3. Style: warm toy-like diorama per the reference image: soft lighting, contact shadows, one consistent palette, rounded boxes, no textures, no external models. Labels are real HTML (drei Html) with WCAG AA contrast.
4. Two-way sync: selecting a zone in the scene (click or keyboard) selects it in the Room text view and vice versa; placing an item from the catalogue updates the scene immediately.
5. Accessibility overrules visuals: the whole game stays fully playable from the text view and keyboard; the canvas has a short aria-label pointing to the text view; respect prefers-reduced-motion.
Token guard: low-poly primitives only; at most two visual refinement passes, then stop and report. Don't touch the engine or its tests (pending Phase 1c). Report in <=5 lines.
```
Then Phase 3b (walker that walks the route per visitor type, skippable) and Phase 1c.
