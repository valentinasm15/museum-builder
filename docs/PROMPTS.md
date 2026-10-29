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

## Phase 2 — Structured UI + EN/FI + deploy
```
Build Phase 2 (follow CLAUDE.md). Read only DESIGN §3, §7, §10 row 2.
1. src/ui: Catalogue (item cards: cost, needs, who it is for; no value-per-€), Room text view (zones with placed items and which work), Budget bar. Select item → select zone; keyboard-only; aria-live announcements; no drag.
2. Language toggle EN/FI from the Texts sheet and name_fi columns; set the lang attribute.
3. GitHub Actions workflow deploying to GitHub Pages (Vite base = repo name).
Stop when a full placement round works by keyboard in both languages and the build passes. Report in ≤5 lines.
```

## Phase 3 — Walkthrough + debrief + log (testing-ready)
```
Build Phase 3 (follow CLAUDE.md). Read only DESIGN §5 ("What the debrief must show"), §10 row 3.
1. src/engine/visit.ts: per persona, an ordered text walkthrough built only from Texts walk_*/ch_* templates and engine results (reach, usable channels, inactive items, zone exhibits). If a zone's exhibits cell is blank, use "the exhibits in {zone}" (localised) instead.
2. "Open the museum" shows the walkthrough per persona (tabs/select), then the debrief in the §5 order, using deb_* templates; feedback.ts gives templated advice.
3. src/log.ts: record every place/remove/round/debrief view with timestamps; "Export session log" downloads JSON. Rounds: start round 2 with the same budget.
Stop when a full 2-round session works by keyboard and the log exports. Report in ≤5 lines.
```

Phases 4–6: write the prompt the same way from DESIGN §10 rows 4–6.
