# Museum Builder — Design Document

> Full reference. Claude Code: read only the section a task needs (sections are numbered). Working rules live in `/CLAUDE.md`.

> Status: DRAFT v0.1 (2026-10-27) for team review. Owners: Valentina Serrano (research lead), Lisa Thanh Thanh Lam (design lead).
> Course: Interdisciplinary Project (AI + accessibility), EMJM AI for Sustainable Societies, Tampere University.
> Partners: LOGI / Postimuseo (Olli), Finnish Federation of the Visually Impaired (Terhi).

---

## 1. Goal

Build a **serious game for museum curators and exhibition designers**. It teaches them how a space works, or fails, for **visitors with visual impairment (VI)**.

The player gets a real room with a real exhibition and a **limited budget**. They choose which accessibility measures to fund and where to place them. Then they watch a simulated visitor try to use the space. Two lessons should come through:

1. **Accessibility is a system, not a checklist.** Measures depend on each other. A tactile replica without a label or audio is wasted money. A braille label nobody can find is too.
2. **Cost and value are not the same thing.** The game separates *what an item costs* from *who it actually helps*. Example from the Terhi interview: audio reaches almost every VI visitor, while braille reaches only the fraction who read it. A braille catalogue is expensive and still excludes most people. **The core challenge is the best use of limited money.** The budget never covers everything, so the player has to prioritise, and to connect items so each euro unlocks the most access. The score rewards this directly through *money efficiency* (§5).

**This prototype tests whether the game logic is graspable. It must also look polished and rest on robust content.** Curators will judge credibility from both. A rough-looking game or an unsourced rule undermines the learning, as well as the partners' trust. Priorities, if time forces a choice: (1) correct, sourced logic; (2) accessibility of the game itself; (3) visual polish. Polish means a coherent, finished look within the low-poly style (§8), not more features. It supports a design-based research cycle: interviews before and after play, with 1–2 curators/designers. Partners told us that **how players reason about the design matters more than the score**, so the game has to make its reasoning visible.

### Research questions the prototype must serve
Source of truth: the latest project slides (ppt) in the team's Google Drive folder. If they differ from this list, the slides win.

**Main RQ:** How can a design game support curators' accessibility awareness for visitors with visual impairment in museums?
1. What barriers do visitors with visual impairment face in museum spaces? *Answered by literature and interviews (Terhi, VI visitors). The game encodes these barriers as items, rules and personas but does not answer this RQ.*
2. Which gaps in curators' accessibility awareness does the game reveal? *Answered by decision logs and the pre-play interview.*
3. How do curators' considerations change after playing? *Answered by pre/post interviews plus round 1 vs round 2 differences.*

→ Implication for the build: **log every player decision** (placements, removals, rounds, final state) and make the log exportable as JSON for analysis.

---

## 2. Level 1: Postimuseo, ground floor (Vapriikki, Tampere)

The source is the tactile floor plan photographed at the museum entrance (`IMG_3967`). Model it as a **simplified grid**, not to scale. The aim is a space a curator who knows Postimuseo would recognise.

| Zone (FI) | EN | Type |
|---|---|---|
| Sisäänkäynti | Entrance | start point |
| Viestintä | Communication | exhibit zone (two areas: south room + east corridor wall) |
| Älypuhelin | Smartphone | central island exhibit |
| Verkot | Networks | exhibit zone |
| Ammatit | Professions | exhibit zone |
| Katselupiste | Viewpoint | exhibit zone (west end) |
| Kuljetus | Transport | exhibit zone (long north-west wall) |
| Postilähetykset | Postal items | exhibit zone (north wall) |
| Lajittelu | Sorting | exhibit zone |
| Kirjeet ja paketit | Letters and parcels | exhibit zone |
| Historia ja nykypäivä | History and present day | exhibit zone |
| WC-tilat | Toilets (incl. accessible) | facility |
| Hissi | Lift | facility |
| Porras 2. kerrokseen | Stairs to 2nd floor | facility |
| Istuinalue | Seating area | facility (exists near Lajittelu) |
| Asiakaspalaute | Feedback point | facility |
| Hätäpoistumistie | Emergency exits (2) | facility |

**Already present in the real museum (pre-placed, cost €0, flagged "existing"):** the tactile/braille entrance floor plan itself, one seating area, and what looks like a dashed guidance line running from the entrance through Älypuhelin towards Verkot (**to verify with Olli**). This matters for the design: the player does not start from zero, which matches LOGI's "start from a finished exhibition" framing.

**Prototype scope:** pick **5–6 exhibit zones** at most (suggested: Viestintä, Älypuhelin, Verkot, Kirjeet ja paketit, Lajittelu, Historia ja nykypäivä). Each zone holds 1–2 exhibit objects. Leave the rest as walls/background.

---

## 3. Core mechanic

### Game loop (one round ≈ 10–15 min)
1. **Brief.** Room, budget, and the visitors who will come (personas, §4). One sentence on the challenge: *"You have €X to make this exhibition work for visitors with visual impairment."*
2. **Plan.** Pick items from a **structured catalogue** (this is what Figma Make did well) and place them on zones or slots in the 3D room. The budget updates live. Each item card shows cost, what it needs to work, and who it is for.
3. **Visit (simulation).** Press *Open the museum*. A visitor avatar walks from the entrance (this is what the Playground prototype did well). The player switches between personas. At each zone the avatar reacts in a short bubble, e.g. *"I can't find this label"* or *"The audio tells me what the letter scale looked like."* Unreachable zones are skipped and greyed.
4. **Debrief.** Score breakdown (§5), **value-per-euro per item**, broken dependencies, excluded visitors, and written feedback.
5. **Iterate.** Round 2 with the same budget. Show a diff against round 1.

### Placement interaction (must be accessible, see §7)
Use **select an item, then select a target zone/slot**, operable by mouse, keyboard and screen reader. Dragging is an *optional extra*, never the only way. Terhi stated explicitly: "dragging is not accessible."

### Systemic logic (the heart of the game)
Each item has:
- `requires`: conditions for it to work. If any is unmet, the item is **placed but inactive**: money spent, zero benefit, flagged in the debrief.
- `enhances`: items it amplifies, e.g. lighting raises large-print effectiveness.
- `channels`: which sensory/information channel it provides (audio, tactile, braille, visual-enhanced, human).
- `reach`: which persona attributes can use it (e.g. braille → only `readsBraille`).
- `scope`: zone-level, or venue-level (staff training, website, audio guide devices).

**Multimodal redundancy rule:** a zone gives full information value only with **≥ 2 usable channels** for a persona. Rationale: Terhi said touch-based options "have to be complementary because they can exclude someone"; Smithsonian guidance recommends combining raised labels and audio.

---

## 4. Personas (data-driven, not hard-coded)

> Source of truth: `Personas` sheet in `src/data/museum-builder-data.xlsx`.

Personas are attribute bundles in `personas.json`. The engine reads only the attributes, so the team can change them after the interviews.

| Persona | readsBraille | usesSmartphone | residualVision | comfortableWithTouch | Notes |
|---|---|---|---|---|---|
| Blind, non-braille reader | ✗ | ✓ | ✗ | ✓ | The most common VI profile per Terhi ("braille only reaches a fragment"). Uses apps like Be My Eyes |
| Blind, braille reader | ✓ | ✗ | ✗ | ✓ | |
| Low vision | ✗ | ✓ | ✓ | ✗ | Needs font size, contrast, lighting, low glare |

Optional `visitorShare` weights per persona feed the overall score. **These are placeholders until validated with Terhi.** Show them in the UI as an editable assumption, not as hidden truth.

---

## 5. Scoring model

Do **not** use additive points. Compute per **zone × persona**, then aggregate. The engine is pure and deterministic, with no AI inside it.

```
reach(z,p)   = 1.0  if every Route segment from the entrance to z's route_segment exists
                    (segments are shared: each is paid once, Route sheet)
             × lighting_reach_factor for residualVision if the zone has lighting (cap 1.0)
             Items with a reach_grant (staff_guided / plan_only) set the fallback reach values below
             = 0.6  if only staff-guided (requires staff training + guided tour)
             = 0.3  if only the entrance floor plan orients them
             = 0    otherwise
info(z,p)    = best usable channel at z for p  (audio 1.0, braille 1.0 if readsBraille,
               large-print 0.7 if residualVision, camera-readable label 0.6 if usesSmartphone,
               × enhance_factor of lighting / reference numbering in the zone (cap 1.0),
               exhibit_view 0.3 if residualVision (existing everywhere; lighting boosts it),
               tactile replica 0.8 if comfortableWithTouch AND has label/audio)
richness(z,p)= +0.2 per additional distinct usable channel, capped at +0.4
zoneScore    = reach × min(1, info + richness)
personaScore = mean over zones;  overall = weighted mean over personas
```
All numbers are **placeholders in the `Scoring` sheet of the Excel**. The model, not the numbers, is what we test.

### Money efficiency: "best use of the money"
The score has **two headline numbers, shown side by side**:
- **Access achieved:** the weighted overall score above.
- **Money efficiency** = access achieved ÷ access of a **benchmark plan** with the *same amount spent*. Example: *"You spent €42,000 and reached 58% access. A well-connected plan with €42,000 reaches 74%. Your efficiency is 78%."*

How the engine builds the benchmark plan (`engine/benchmark.ts`):
- Use greedy selection by **marginal access gain per €**.
- Evaluate each candidate together with its unmet `requires`, as a **bundle**. For example, a replica is evaluated together with its label, or with audio content plus a delivery channel. This makes the greedy step reward connected items, not cheap isolated ones.
- Repeat until the budget is spent.
- Call it a "benchmark", not "optimal". The greedy plan is a reference point, not a proven optimum.

**Marginal contribution per item** is the drop in access if that item is removed, given everything else placed. This is how dependencies show up in money terms. For example: *"Audio guide devices: €5,000. Removing them drops access by 22 points, because all 5 audio descriptions depend on them."* Or: *"Braille label at Lajittelu: €600, +2 points."*

**During planning, do not show value-per-€ live.** That would give the answer away and turn the game into sorting a list. While planning, cards show cost, requirements and who an item is *for*. Value is revealed in the debrief. Showing it live is an open design question to test in round 2.

### What the debrief must show (in this order)
1. **Who was left out.** Any persona with zoneScore = 0 somewhere, named explicitly.
2. **Best use of the money:** access achieved vs benchmark at the same spend (money efficiency). Show the 2–3 biggest differences between the player's plan and the benchmark, e.g. *"The benchmark skipped the braille catalogue (€6,000) and funded audio descriptions in 4 zones instead."*
3. **Per-item value:** cost, number of personas helped, and marginal contribution. Sort by value-per-€1k. This is where **braille vs audio** becomes visible: e.g. "Braille labels ×4: €2,400 → helped 1 of 3 visitors" next to "Audio description: €6,000 → helped 3 of 3 visitors."
4. **Inactive items** with the missing requirement. This is money spent for zero access, totalled in €.
5. Per-persona scores, then an overall score. Show it as a *band* ("Partial / Good / Strong"), not a precise %, and say it can never reach 100% within budget.
6. **Written feedback** (§9, AI component).

---

## 6. Item catalogue (v0, from team research + Terhi interview)

> **Source of truth: `src/data/museum-builder-data.xlsx`** (sheets: Settings, Items, Personas, Zones, Route, Scoring). The table below is the original snapshot; its costs were rescaled in the Excel (÷5) for the €10k budget. If the two differ, the Excel wins.

Costs are **indicative placeholders** and must be validated with LOGI. Set the budget so that roughly 30–50% of the full catalogue is affordable, which forces trade-offs. Default budget: **€10,000** (set in the Excel, `Settings` sheet), which currently covers ~36%. The workbook recomputes this when costs change.

| Item | Scope | Channel | Requires | Reach / note | Placeholder cost |
|---|---|---|---|---|---|
| Tactile floor route (segment) | path | tactile | continuity from entrance; lighting recommended | all | €1,500 / segment |
| Tactile floor plan at entrance | venue | tactile+braille | — | **existing** | €0 |
| Braille label | zone | braille | route reaching zone; consistent placement | readsBraille only | €600 |
| Large-print, high-contrast label | zone | visual-enhanced | low glare; lighting boosts | residualVision | €400 |
| Audio description (content) | zone | audio | delivery: audio guide devices OR smartphone audio; tactile trigger marker | all | €1,500 |
| Audio guide devices | venue | audio | signposted at entrance; staff to hand out | all | €5,000 |
| Smartphone audio via QR/NFC (+ Wi-Fi) | venue | audio | tactile marker at trigger point | usesSmartphone | €3,000 |
| Tactile replica | zone | tactile | route reaching it; braille label OR audio | comfortableWithTouch | €3,500 |
| Touch permission on originals | zone | tactile | staff training; conservation approval | comfortableWithTouch | €500 |
| Lighting upgrade | zone | — | — | enhances large print + route | €2,000 |
| Seating | zone | — | route reaching it | all (comfort, low score weight) | €800 |
| Staff training | venue | human | — | unlocks guided tour and on-demand help | €4,000 |
| Guided touch tour (scheduled) | venue | human+tactile | staff training; replica OR touch permission | all, **only at set times** (partial reach) | €2,500 |
| Audio-described video | zone (screens) | audio | existing screen at zone | all | €2,000 |
| Large-print take-away catalogue | venue | visual-enhanced | — | residualVision | €1,500 |
| Braille catalogue | venue | braille | — | readsBraille; **expensive, low reach** (Terhi) | €6,000 |
| Accessible pre-visit website info | venue | digital | — | all (non-spatial) | €2,000 |
| Conversational AI robot guide | venue | audio | Wi-Fi; staff to maintain | **"trap" item: high cost, low value** (validate; notes ambiguous) | €25,000 |

Sources in the team notes: Smithsonian Guidelines for Accessible Exhibition Design; Fortuna et al. (2023); Argyropoulos & Kanari (2015); Terhi interview (Oct 2026). Keep a `source` field on every item and show it in the item card. Curators should see where a rule comes from.

---

## 7. Accessibility of the game itself (non-negotiable)

A game that teaches accessibility and is itself inaccessible undermines the project. Terhi raised this directly.
- Every action is operable by **keyboard**. There is a visible focus state and a logical tab order.
- **Parallel text view of the room:** a list/table of zones with what is placed and what works. It is announced to screen readers and always available next to the 3D view. The 3D canvas is decorative/supportive; **no information exists only in the 3D view.** **Accessibility always overrules visual direction (§8)**, especially in this first prototype. Where a visual choice and an accessibility requirement conflict, the accessible option wins and the visual is adapted or dropped. Examples: contrast over palette, readable text size over a compact layout, a skippable walker over animation.
- Live region (`aria-live`) announcements for placement, budget changes and visit events.
- WCAG 2.2 AA contrast, scalable text, no colour-only meaning, `prefers-reduced-motion` respected (walker can be skipped and replaced by a step list).
- No time pressure.
- **Bilingual EN/FI.** All on-screen text comes from the `Texts` sheet; item, persona and zone names have `_fi` columns. Language toggle in the header; blank Finnish falls back to English. Set the `lang` attribute so screen readers switch pronunciation.

---

## 8. Visual direction

> Subordinate to §7. Pursue the look below only as far as it stays fully accessible.

- **Isometric 3D diorama** (reference: "Inclusive Gallery Curator" image, `INT DISCIPLINARY Museum Builder.png`): warm, tactile, toy-like, with a fixed orthographic camera, rotate in 90° steps, and zoom.
- Use **low-poly primitives done well**: boxes and cylinders with soft lighting, ambient occlusion/contact shadows, a consistent palette and rounded edges, aiming for the warmth of the reference image. No imported art assets in v1. Polish comes from lighting, palette, typography and micro-interactions (hover, placement feedback, budget animation), not from model detail. Tactile paths rendered as yellow ribbed strips, as in the reference image.
- Layout: 3D room centre-left. **Structured side panel** right, with tabs *Catalogue · Room (text view) · Budget*. Budget bar always visible on top.
- Item cards (Figma Make strength): icon, name, cost, channel tags, "needs:" chips, "helps:" persona chips.
- Postimuseo palette hint: the tactile plan's grey/white/black with yellow accents. Keep yellow for tactile/wayfinding items only, so it carries meaning.

---

## 9. Tech stack

Keep it small. The team has ~5 h/week (Val), and the code must stay easy to follow.

- **Vite + React + TypeScript**
- **three.js via @react-three/fiber + @react-three/drei** (isometric scene, simple walker animation)
- **Zustand** for game state (one store)
- **Vitest** for the scoring engine only
- No backend in v1. Deploy as a static site on **GitHub Pages** (GitHub Actions builds on every push), so testers open a link. The xlsx is bundled at build time: editing the Excel and pushing it to the repo updates the live game in ~1–2 min.

### Folder structure (keep to this; do not create extra layers)
```
museum-builder/
  CLAUDE.md                 ← short working rules (loaded every session)
  docs/DESIGN.md            ← this file (read on demand)
  src/
    data/
      museum-builder-data.xlsx ← ALL editable data (team edits in Excel)
      load.ts                  ← reads the xlsx with SheetJS, validates headers, returns typed data
    engine/
      score.ts              ← pure functions: dependencies, reach, info, zoneScore
      score.test.ts
      benchmark.ts          ← greedy bundle benchmark + marginal contribution per item
      visit.ts              ← builds the walker path + bubble events from score output
      feedback.ts           ← templated feedback (v1); prompt builder for LLM (v2)
    scene/                  ← 3D only (Room, Zone, ItemMesh, Walker)
    ui/                     ← panels (Catalogue, RoomTextView, Budget, Debrief)
    store.ts
    log.ts                  ← decision log + JSON export
    App.tsx
```

### AI component (course requirement, used only where it adds value)
- **The score is never produced by AI.** The rule engine is the single source of truth.
- AI is used for the **debrief feedback only**. It takes the structured engine output (inactive items, excluded personas, value-per-€) and turns it into 3–5 sentences of curator-facing advice. The advice must cite only items and sources present in the data.
- **Phase 3:** `feedback.ts` uses templates, so the prototype works offline and is testable.
- **Phase 4:** the same function builds a prompt and calls an LLM through a minimal serverless function, so no API key sits in the browser. Grounding material is the item `source` texts plus guidance documents requested from Terhi.

---

## 10. Build phases and acceptance criteria

| Phase | Deliverable | Done when |
|---|---|---|
| 1. Engine + data | `load.ts`, `score.ts`, `benchmark.ts`, tests | Tests cover: inactive replica without label/audio; braille helps only braille reader; smartphone audio excludes non-smartphone persona; shared route segment paid once; enhance_factor boosts large print; benchmark beats "braille everywhere" at equal spend |
| 2. Structured UI + EN/FI + deploy | Catalogue, room text view, budget, select→place, language toggle, GitHub Pages | Full round playable by keyboard only, in EN and FI; shareable link works |
| 3. Walkthrough + debrief + log | `visit.ts` text walkthrough per persona, debrief (§5 order), decision log + JSON export | **Ready for curator testing (target mid-Nov).** Walkthrough lets a player see the room from each visitor's side; curator can explain why braille scored low vs audio |
| 4. AI feedback | Serverless LLM call grounded in engine output + item sources | Feedback mentions only real placed/missing items; templated fallback when offline |
| 5. Isometric scene | Postimuseo grid, zones, item meshes, selection synced with panel | Placing in either view updates both; text view stays complete |
| 6. Animated walker + polish | Walker replays the phase-3 walkthrough, round diff, visual polish | Walker is skippable; nothing shown only in 3D |

---

## 11. Instructions for Claude Code

See `/CLAUDE.md` (working rules, incl. token efficiency). Not duplicated here.

---

## 12. Known limitations / open questions (to validate)

- Persona attributes, `visitorShare`, and all costs are placeholders. Validate with Terhi and LOGI.
- Grid is a simplification of Postimuseo; check that the guidance line and existing items are correct with Olli.
- The score can create a checklist mindset despite the systemic rules. Watch for this in post-play interviews (are players optimising the number or reasoning about visitors?).
- Organisational factors (staff attitude, booking policies) are only partly represented, via staff training and the website.
- The money-efficiency benchmark embeds our own weights. A curator who "loses" to it may be reasoning correctly about something the model leaves out. Ask about disagreements with the benchmark in post-play interviews; they are data, not player errors.
- The simulated visitor is a model, not lived experience. The game should say so in its intro and debrief.
- **Deafblind visitors are out of scope** for this prototype (Terhi raised audio guides for deafblind visitors); audio-centred items do not serve them. State this in the intro and report.
- Single disability group (VI) is a deliberate scope choice (LOGI recommendation), not a claim that the design is generally accessible.
