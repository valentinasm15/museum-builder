# Museum Builder — Claude Code prompts (personas, situations, visit, debrief)

## How to use

Work from the `museum-builder` repo. **One prompt per fresh Claude Code session.** After a phase is accepted, **commit**, then **`/clear`** before pasting the next fence. Do not paste two phases at once.

This file is `/workspace/claude-code-prompts.md` (outside the repo). Point Claude at that path, or copy this file into the repo for the session.

Token rules (also in `CLAUDE.md`): read **only** the files a prompt lists; never open `docs/DESIGN.md` in full; after one SheetJS write/verify of the xlsx, do not dump it again; run only the test command given.

**Decision:** retire generic `low_vision`. Its role is covered by the more specific low-vision rows (central / tunnel / glare / no-phone / with-touch). Keep the two existing blind personas and add the new ones below.

**Team sign-off:** `CLAUDE.md` says the scoring *model structure* is a team decision. Phase A’s situation/attr logic is framed as a **thin filter** on existing `reach()` / `usable()` / `channels()` (optional `VisitContext`; default `score(data, placements)` unchanged; no new Scoring-sheet parameters). Still, editing `src/engine/score.ts` **may need team sign-off** before that session. If the team has not agreed, stop after the xlsx + loader and report; do not change the model.

---

## Workbook rows

Paste these **exactly**. Do not invent shares, attrs, or names. `visitorShare` sums to **1.00**. Booleans as `TRUE`/`FALSE`. `status` = `placeholder`. Leave `validated_by` blank. New Personas columns are extra attrs; `load.ts` already treats any non-meta header as an attribute.

### Decision and share notes (for the `source` column and the team)

Finnish Register of Visual Impairment, Annual Statistics 2024 (N = 17 745 living; THL / Näkövammaisten liitto): low vision **75.2%**, blindness **19.9%**, severity unspecified **~5%**. Causes among all diagnoses: AMD **41%**, hereditary retinal dystrophies **10.3%**, glaucoma **9%**, visual-pathway diseases **8.6%**, congenital **5%**, diabetic retinopathy **3.1%**. Cataract is not a leading register cause (usually operated). URLs:

- EN: https://cms.nkl.fi/sites/default/files/2026-04/Annual%20Statistics%202024%20web.pdf
- FI: https://cms.nkl.fi/sites/default/files/2026-04/Nakovammarekisterin%20vuosikirja%202024.pdf

**Blind 0.20 / low vision 0.80:** register 19.9% / 75.2%; the ~5% unspecified is **allocated to low vision** (assumption: not classified as blind).

**Braille 0.06 of all visitors (0.04 + 0.02):** no official Finnish braille-literacy rate ([Aineeton kulttuuriperintö](https://wiki.aineetonkulttuuriperinto.fi/wiki/Use_and_teaching_of_braille); [EBU 2023](https://www.euroblind.org/sites/default/files/documents/EBU%20Position%20paper%20on%20Braille%202023.pdf)). **Assumption**, aligned with Terhi (“braille only reaches a fragment”) and the fact that ~80% of registrants have residual vision and rarely use braille. Split of braille readers who prefer not to touch: **assumption**.

**No-smartphone 0.22 (0.04 blind + 0.18 LV):** no Finland-wide figure. UK RNIB *Sight Loss and Technology Briefing* 2024: **28%** of blind and partially sighted people never use the internet / have no access; among those who go online, **64%** use a smartphone, but only **37%** of internet users aged 75+ do ([PDF](https://www.tavip.org.uk/wp-content/uploads/2024/06/Sight_loss_and_technology_briefing_2024_FINALHB11Oct2024.pdf), [RNIB page](https://www.rnib.org.uk/professionals/research-and-data/reports-and-insight/sight-loss-and-technology-briefing/)). Finnish registrants’ mean age is **79** (71% are 65+), which would suggest a *higher* no-phone share, but **museum visitors are a more active subset** — **assumption** that ~78% of visitors use a smartphone.

**Central 0.28:** scaled from AMD = 41% of diagnoses, mostly remaining low vision (register text: blindness from AMD is uncommon). Other LV shares are **designed partitions** so each mechanic is visible, not a clinical census: tunnel 0.12 (glaucoma 9% plus other field-loss; slight upward **assumption**), glare 0.10 (Health 2000 found unoperated cataract in 27% of people with VA ≤ 0.25 — [Laitinen et al. 2010](https://onlinelibrary.wiley.com/doi/10.1111/j.1755-3768.2009.01566.x) — but that is not the 2024 register; **assumption**), with-touch 0.12 (**assumption**; Terhi: not everyone is comfortable touching).

Situations are **not** part of `visitorShare`. Draw them independently (uniform).

### Personas sheet

Replace all current data rows. Keep row 1 headers; add the three new attr columns anywhere among the other attrs (not in the meta set `id, name, visitorShare, status, source, name_fi, validated_by`).

| id | name | name_fi | readsBraille | usesSmartphone | residualVision | comfortableWithTouch | needsMagnification | glareSensitive | needsContinuousRoute | visitorShare | status | source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| blind_non_braille | Blind, does not read braille | Sokea, ei lue pistekirjoitusta | FALSE | TRUE | FALSE | TRUE | FALSE | FALSE | FALSE | 0.10 | placeholder | Largest blind group. Register 2024: blindness 19.9%. Terhi: braille reaches only a fragment. Braille/phone split: assumption (see notes). |
| blind_no_smartphone | Blind, no smartphone | Sokea, ei käytä älypuhelinta | FALSE | FALSE | FALSE | TRUE | FALSE | FALSE | FALSE | 0.04 | placeholder | Makes museum audio-guide devices matter. Phone split: assumption (RNIB 2024 digital exclusion; see notes). |
| blind_braille | Blind, reads braille | Sokea, lukee pistekirjoitusta | TRUE | TRUE | FALSE | TRUE | FALSE | FALSE | FALSE | 0.04 | placeholder | Braille share 0.06 of all is an assumption: no Finnish official rate (EBU 2023; Terhi). |
| blind_braille_no_touch | Blind, reads braille, prefers not to touch exhibits | Sokea, lukee pistekirjoitusta, ei mieluusti koske näyttelyesineisiin | TRUE | TRUE | FALSE | FALSE | FALSE | FALSE | FALSE | 0.02 | placeholder | Gameplay split so replicas are not automatic for every braille reader. Touch comfort: assumption (Terhi). |
| low_vision_central | Low vision, central vision loss (needs magnification) | Heikkonäköinen, keskeisen näön heikentymä (tarvitsee suurennusta) | FALSE | TRUE | TRUE | FALSE | TRUE | FALSE | FALSE | 0.28 | placeholder | AMD-like. Register 2024: AMD 41% of diagnoses, usually low vision not blindness. |
| low_vision_tunnel | Low vision, tunnel vision (wayfinding-critical) | Heikkonäköinen, putkinäkö (reitti on ratkaiseva) | FALSE | TRUE | TRUE | FALSE | FALSE | FALSE | TRUE | 0.12 | placeholder | Glaucoma-like. Register 2024: glaucoma 9% of diagnoses; share nudged up for other field-loss (assumption). |
| low_vision_glare | Low vision, glare-sensitive | Heikkonäköinen, häikäisylle herkkä | FALSE | TRUE | TRUE | FALSE | FALSE | TRUE | FALSE | 0.10 | placeholder | Cataract-like / cloudy media. Not a leading 2024 register cause. Share is an assumption (cf. Laitinen et al. 2010). |
| low_vision_no_smartphone | Low vision, no smartphone | Heikkonäköinen, ei käytä älypuhelinta | FALSE | FALSE | TRUE | FALSE | TRUE | FALSE | FALSE | 0.18 | placeholder | Older visitor who needs large print and/or museum devices. Phone split: assumption (see notes). |
| low_vision_with_touch | Low vision, comfortable with touch | Heikkonäköinen, koskettelu sopii | FALSE | TRUE | TRUE | TRUE | FALSE | FALSE | FALSE | 0.12 | placeholder | So tactile replicas are not “not for low vision”. Touch comfort: assumption (Terhi). |

### Situations sheet (new)

Header row, then these four rows. Draw **uniformly**, independent of persona, **not** weighted into `visitorShare`.

| id | name | name_fi | hasMuseumDevice | phoneWorks | staffAvailable | status | source |
|---|---|---|---|---|---|---|---|
| with_audio_guide | Has a museum audio guide today | Käyttää museon audio-opasta tänään | TRUE | TRUE | TRUE | placeholder | Day condition, not a prevalence weight. |
| without_audio_guide | No museum audio guide today | Ilman museon audio-opasta tänään | FALSE | TRUE | TRUE | placeholder | Devices may be placed but this visitor did not pick one up. |
| phone_battery_dead | Phone battery is dead | Puhelimen akku on tyhjä | TRUE | FALSE | TRUE | placeholder | Smartphone channels off for this visit only; a museum device can still work. |
| unstaffed_hours | Visiting outside staffed hours | Vierailu henkilökunnan työajan ulkopuolella | TRUE | TRUE | FALSE | placeholder | No staff-guided reach or guided touch tour today. |

### New Texts keys

Add these rows; **do not edit existing keys**. Finnish is a draft (check later).

| key | en | fi |
|---|---|---|
| attr_needsMagnification | Visitors who need magnification or large print | Kävijät, jotka tarvitsevat suurennusta tai isoa kirjasinta |
| attr_glareSensitive | Visitors who are sensitive to glare | Kävijät, jotka ovat herkkiä häikäisylle |
| attr_needsContinuousRoute | Visitors who need a continuous route to find their way | Kävijät, joiden suunnistaminen vaatii yhtenäisen reitin |
| drawn_visitor | Today’s visitor | Tämän päivän kävijä |
| drawn_situation | Today’s situation | Tämän päivän tilanne |
| intro_visitor | Your first visitor today is {persona}. {situation} Plan with them in mind — when the museum opens you will also see how the same layout works for everyone else. | Ensimmäinen kävijäsi tänään on {persona}. {situation} Suunnittele häntä ajatellen — kun museo avataan, näet myös, miten sama layout toimii muille. |
| switch_visitor | Other visitors | Muut kävijät |
| walk_next | Next step | Seuraava vaihe |
| walk_prev | Previous step | Edellinen vaihe |
| walk_skip | Skip walkthrough | Ohita vierailu |
| deb_no_perfect | There is no perfect score. The budget cannot fund everything, and a choice that helps one visitor can fail another. | Täydellistä pistemäärää ei ole. Budjetti ei riitä kaikkeen, ja valinta, joka auttaa yhtä kävijää, voi jättää toisen vaille apua. |
| deb_band | Access band: {band} | Saavutettavuuden taso: {band} |
| deb_band_partial | Partial | Puutteellinen |
| deb_band_good | Good | Hyvä |
| deb_band_strong | Strong | Vahva |
| deb_focal | How today’s visitor fared | Miten tämän päivän kävijä pärjäsi |
| deb_who_else | Who else came today | Ketkä muut tulivat tänään |
| deb_reach | Wayfinding / reach | Suunnistaminen / saavutettavuus |
| deb_info | Information access | Tiedon saanti |
| deb_richness | Multimodal redundancy | Useita aistikanavia |
| deb_comfort | Comfort and enabler items (not part of the access score) | Mukavuus- ja mahdollistavat kohteet (eivät kuulu saavutettavuuspisteisiin) |
| deb_unspent | Unspent budget: {amount} | Käyttämättä jäänyt budjetti: {amount} |

---

## Phase A — data, loader, thin situation/attr filter, tests

```
Build Phase A only (follow CLAUDE.md). Read ONLY: CLAUDE.md; src/data/load.ts; src/engine/score.ts; src/engine/score.test.ts; the “Workbook rows” and “Phase A” sections of /workspace/claude-code-prompts.md. Do not read DESIGN.md. Do not dump the xlsx more than once (one write + one verify). Do not open other src files.

Goal: Exact workbook rows from that file. Retire persona id low_vision. Thin filters only. Default score(data, placements) must be unchanged.

Change:
- museum-builder-data.xlsx: replace Personas data rows; add attr columns needsMagnification, glareSensitive, needsContinuousRoute; add Situations sheet (headers+rows as given); append only the listed new Texts keys.
- load.ts: parse Situations (id, name, name_fi, hasMuseumDevice, phoneWorks, staffAvailable; bools as in Personas) onto GameData. Load optional Items.kind onto Item (must not fail if the column exists). New persona attrs come from extra columns automatically.
- score.ts: optional 3rd arg ctx?: VisitContext. Omit ctx → today’s behaviour.
  • hasMuseumDevice===false: audio_guide_devices not usable.
  • phoneWorks===false: treat usesSmartphone as false for this call only; do not mutate the persona.
  • staffAvailable===false: staff_guided grants false; guided_touch_tour (staffed human) not usable.
  • attrs.needsContinuousRoute: skip staff_guided in reach(); route + plan_only unchanged.
  • attrs.glareSensitive: do not apply lighting_reach_factor or lighting enhance_factor; if lighting is in the zone, divide visual and visual_enhanced values by lighting_reach_factor (reuse that parameter; no new Scoring key).
  • attrs.needsMagnification: if the zone has no usable visual_enhanced channel, omit exhibit_view.
  CLAUDE.md: this is a thin filter, but editing score.ts may need team sign-off. If you cannot change score.ts, stop after xlsx+loader and report. Do not change the scoring model structure or Scoring-sheet values.
- score.test.ts: point P.lv at low_vision_central; add tests for each bullet above; visitorShare sums to 1; score(d,ps) equals score(d,ps,undefined) on a sample plan.

Don’t touch: App, store, UI, scene, benchmark.ts (except a retired id), item costs, Scoring values.

Test: npx vitest run src/engine/score.test.ts --reporter=dot
Stop when tests pass. Report ≤5 lines.
```

## Phase B — draw visit, store, intro

```
Build Phase B only (follow CLAUDE.md). Read ONLY: src/data/load.ts (types), src/store.ts, src/store.test.ts, src/ui/Intro.tsx, src/App.tsx, and new Texts keys already in memory from Phase A. Do not read the xlsx, DESIGN.md, or the engine.

Goal: At init (and on level change / new round) draw a Visit: one persona weighted by visitorShare, plus one situation uniformly and independently. Show them on the intro. Overall scoring still uses all personas (do not filter the plan by the draw). Round 2 (Settings.rounds, already 2) excludes the round-1 persona id, then redraws; redraw the situation independently (it may repeat).

Change:
- store.ts: add visit: { personaId, situationId }, round (start at 1), phase: 'planning' (visiting/debrief come in C/D). Helpers: drawVisit(data, excludePersonaId?: string) — weighted persona, uniform situation. Call from init, setLevel, and a startRound(n) you will use in D. Keep announcement via existing t() + new keys drawn_visitor / intro_visitor / drawn_situation.
- Intro.tsx: on step 0, show the drawn persona name (EN/FI) and situation name, plus t(..., 'intro_visitor', { persona, situation }). Still list that all visitor types will be assessed. Keep level picker and model_disclaimer.
- store.test.ts: add tests — shares used as weights (mock Math.random or run many draws and check every persona can appear); excludePersonaId never returned when others exist; situation is independent; init and setLevel produce a visit; placements still reset on setLevel.

Don’t touch: score.ts, load.ts, xlsx, scene, Catalogue, Room, Budget (except if a type import is required).

Test: npx vitest run src/store.test.ts src/engine/score.test.ts --reporter=dot
Stop when tests pass and the intro shows the drawn visitor in both EN and FI. Report ≤5 lines.
```

## Phase C — visit.ts and “Open the museum” walkthrough

```
Build Phase C only (follow CLAUDE.md). Read ONLY: src/engine/score.ts (exports), src/data/load.ts (types), src/store.ts, src/App.tsx, src/ui/Budget.tsx, src/ui/Intro.tsx (only if a type is needed). Do not read the xlsx or DESIGN.md. Use existing Texts keys walk_*, ch_*, open_museum, walkthrough, not_reachable plus Phase A keys switch_visitor, walk_next, walk_prev, walk_skip.

Goal: “Open the museum” runs a text walkthrough of the current plan for the drawn Visit (persona + situation as score ctx). After the focal walk, tabs/select switch to any other persona and replay the same placements (same situation ctx). Step list is the default and the accessible view (keyboard, screen reader, prefers-reduced-motion). No 3D walker in this phase.

New:
- src/engine/visit.ts: pure function visit(data, placements, persona, ctx) → ordered events from score() + Plan.chain only. Fill walk_enter, walk_plan, walk_reach_route|_staff|_plan, walk_info / walk_no_info / walk_one_channel, walk_inactive, walk_end. If a zone exhibits cell is empty, use “the exhibits in {zone}” (localise via a short existing or new fallback in the function, no xlsx edit unless a key is already missing). Unreachable zones are skipped, not walked, and called out.
- src/engine/visit.test.ts: events mention the persona; inactive replica appears as walk_inactive; no-route back zone uses walk_reach_plan or staff as the engine dictates; situation without device blocks audio_guide_devices in the narrative.
- src/ui/Visit.tsx: dialog/panel. Step list with Next/Back/Skip (focus management, aria-live for the current step). Persona tabs after (or beside) the focal walk; changing tab rebuilds events for that persona, same plan + ctx. No auto-playing animation.

Change: store phase 'planning'|'visiting'; openMuseum() / closeVisit(). Budget or HUD: button t(..., 'open_museum') → openMuseum. App.tsx: render Visit when phase==='visiting'.

Don’t touch: score.ts logic, benchmark.ts, xlsx, scene/, Debrief (that is Phase D).

Test: npx vitest run src/engine/visit.test.ts src/engine/score.test.ts src/store.test.ts --reporter=dot
Stop when a keyboard-only visit works in EN and FI and reduced-motion users only see the step list. Report ≤5 lines.
```

## Phase D — debrief (no 3D walker)

```
Build Phase D only (follow CLAUDE.md). Read ONLY: src/engine/score.ts (exports), src/engine/benchmark.ts (moneyEfficiency, marginalContributions, benchmark), src/engine/visit.ts (types), src/store.ts, src/App.tsx, src/ui/Visit.tsx, src/data/load.ts (types, Item.kind). Do not read the xlsx or DESIGN.md. Use existing Texts (left_out, access_achieved, money_efficiency, benchmark, inactive_items, deb_*, next_round, export_log if present) plus Phase A deb_no_perfect, deb_band*, deb_focal, deb_who_else, deb_reach, deb_info, deb_richness, deb_comfort, deb_unspent.

Goal: After the walkthrough, show a debrief. Bands (Partial / Good / Strong) not a precise percent, plus deb_no_perfect. Open with the drawn visitor’s story (score that persona with the situation ctx; use visit events or zone results). Then “who else came today”: all personas, standard score(data, placements) with no situation — overall remains visitorShare-weighted across ALL personas. Then six dimensions: (1) wayfinding/reach, (2) information, (3) multimodal richness / single-channel penalty, (4) who was left out, (5) money efficiency = player overall ÷ greedy benchmark at FULL budget (also show same-spend benchmark + unspent; call moneyEfficiency, do not reimplement), (6) comfort/enabler items (Item.kind comfort|enabler|undecided) listed separately with cost, “not part of the access score”. Use real item costs when citing trade-offs (braille catalogue vs audio; devices vs smartphone audio; replica vs low-vision no-touch; lighting vs glare-sensitive and vs extending route s4–s7; staff training vs unstaffed situation; robot_guide). No live value-per-euro during planning.

New: src/ui/Debrief.tsx (keyboard, EN/FI). Optional src/engine/feedback.ts: 3–5 templated sentences from engine output only (no LLM).
Change: store phase 'debrief', startRound(2) keeps budget, clears or keeps placements per existing Settings.rounds intent (same budget, player may revise), excludes round-1 persona when redrawing. Wire Visit → Debrief, Next round, and announce.

Don’t touch: score model, Catalogue, scene/, item costs, Scoring sheet. Do not build a 3D walker in this session.

Test: npx vitest run src/engine/score.test.ts src/engine/visit.test.ts src/store.test.ts --reporter=dot
Stop when a 2-round keyboard session shows bands, the focal story, who else, efficiency vs benchmark, and comfort listed apart. Report ≤5 lines.

Later (not this session): optional skippable Walker in src/scene/Walker.tsx interpolating Route x1,y1,x2,y2; never the only way to see the visit; respect prefers-reduced-motion (keep the step list).
```
