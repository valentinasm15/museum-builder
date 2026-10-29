# Museum Builder — working rules

Serious game for museum curators: allocate a limited budget to accessibility items for visitors with visual impairment in Postimuseo (Tampere), then see who was helped and how efficiently the money was used. Full design: `docs/DESIGN.md`. **Read only the numbered section a task needs, never the whole file.**

## Stack
Vite + React + TypeScript · SheetJS (`xlsx`, reads the data workbook) · @react-three/fiber + drei (from phase 3 only) · Zustand · Vitest (engine only). No backend. Hosting: GitHub Pages via GitHub Actions; the xlsx is bundled at build (set Vite `base` to the repo name).

## Structure (do not add folders or layers)
```
src/data/      museum-builder-data.xlsx (team-edited), load.ts
src/engine/    score.ts, score.test.ts, benchmark.ts, visit.ts, feedback.ts
src/scene/     3D only
src/ui/        panels
src/store.ts   src/log.ts   src/App.tsx
```

## Non-negotiables
- Score comes from the rule engine only; AI (later) only writes feedback text.
- All costs, weights, personas, zones and rules live in `src/data/museum-builder-data.xlsx`, never in code. Never hard-code a number from it. `load.ts` must fail with a clear message naming the sheet/column if a header is missing. Don't edit the xlsx unless asked; its `How to edit` sheet documents the `requires` syntax (`;` = all, `|` = any).
- Accessibility of the game overrules visuals: keyboard-only play, a text view of the room, `aria-live` announcements, no drag-only actions, WCAG 2.2 AA. Details: DESIGN §7.
- Priority when time is short: correct logic → accessibility → visual polish.

## Token efficiency (important: budget is limited)
- **One phase per session.** Stop when the phase's acceptance criteria pass, then summarise in ≤5 lines. Phases: DESIGN §10.
- Make **targeted edits**; never rewrite whole files to change a few lines. Don't re-read files you just wrote.
- Keep files short. No boilerplate, no long comments, no README beyond a short "Assumptions to validate" list.
- **Don't open `docs/DESIGN.md` in full**; grep or read the needed section.
- Run tests with minimal output (`npx vitest run --reporter=dot`). Don't run the dev server or take screenshots unless asked.
- Number tuning is done by the team directly in the Excel; no Claude session is needed for that.
- **Ask before** adding a dependency, creating new files outside the structure, or changing the scoring model's structure.
- Report briefly: what changed, and anything blocked. No recaps of the plan.
