import { useEffect, useMemo, useRef } from 'react'
import type { GameData } from '../data/load'
import { stops, type StopStatus } from '../engine/visit'
import { itemName, t, useGame, visitCtx, type Lang } from '../store'

// One panel per stop: what works and what does not at this moment of the visit. The scene shows the same stop; this text is the full equivalent.
const L = {
  works: { en: 'Works', fi: 'Toimii' }, fails: { en: 'Does not work', fi: 'Ei toimi' },
  via: { en: 'thanks to {items} at the entrance', fi: '{items} sisäänkäynnillä' }, more: { en: 'More', fi: 'Lisää' },
  visitor: { en: 'Visitor', fi: 'Kävijä' }, summary: { en: 'See the summary', fi: 'Näytä yhteenveto' }, stop: { en: 'Stop {n} of {total}', fi: 'Pysäkki {n}/{total}' },
  full: { en: 'Reached, something to use', fi: 'Perillä, käytettävää' }, partial: { en: 'Only partly', fi: 'Vain osittain' },
  empty: { en: 'Reached, nothing to use', fi: 'Perillä, ei käytettävää' }, none: { en: 'Cannot reach', fi: 'Ei pääse perille' },
  ok: { en: 'Works', fi: 'Toimii' }, mixed: { en: 'Partly works', fi: 'Toimii osittain' }, idle: { en: 'Not working yet', fi: 'Ei vielä toimi' },
}
const word = (lang: Lang, k: keyof typeof L, v: Record<string, string | number> = {}) => L[k][lang].replace(/\{(\w+)\}/g, (m, n) => (n in v ? String(v[n]) : m))
export const ICON: Record<StopStatus, string> = { full: '●', partial: '◐', empty: '○', none: '✕', ok: '●', mixed: '◐', idle: '○' }

export default function Visit({ d }: { d: GameData }) {
  const { lang, placements, visit: v, walk, setWalk, setWalkView, setFocus, closeVisit, openDebrief } = useGame()
  const next = useRef<HTMLButtonElement>(null)
  const persona = d.personas.find((p) => p.id === walk.pid) ?? d.personas[0]
  const pname = (p: typeof persona) => (lang === 'fi' && p.nameFi) || p.name
  const list = useMemo(() => stops(d, placements, persona, visitCtx(d, v), lang), [d, placements, persona, v, lang])
  const last = list.length - 1, i = Math.min(walk.i, last), s = list[i]

  // Tell the scene where the visitor stands and what has been seen so far.
  useEffect(() => {
    const entrance: [number, number] = [d.settings.entrance_x, d.settings.entrance_y]
    // Polyline from the entrance along the route segments to where the visitor ends up at this stop.
    const walked = (ids: string[]): [number, number][] => [entrance, ...ids.map((id) => d.route.find((r) => r.id === id)).filter((g) => !!g).map((g) => [g!.x2, g!.y2] as [number, number])]
    const cut = s.kind === 'room' && s.breakAt && (s.status === 'none' || s.status === 'partial') ? d.route.find((r) => r.id === s.breakAt) : undefined
    const marks = Object.fromEntries(list.slice(0, i + 1).filter((x) => x.zoneId).map((x) => [x.zoneId!, { icon: ICON[x.status], text: word(lang, x.status) }]))
    setWalkView({ path: s.kind !== 'room' ? [entrance] : walked(cut ? s.path.slice(0, s.path.indexOf(cut.id)) : s.path), barrier: cut ? [cut.x1, cut.y1] : undefined, marks })
    setFocus(s.zoneId ?? null)
  }, [d, list, i, s, lang, setWalkView, setFocus])
  useEffect(() => () => { setWalkView(null); setFocus(null) }, [setWalkView, setFocus])
  useEffect(() => { next.current?.focus({ preventScroll: true }) }, [])

  const names = (ids?: string[]) => (ids ?? []).map((id) => itemName(lang, d.items.find((x) => x.id === id)!)).join(', ')
  const close = lang === 'fi' ? 'Sulje' : 'Close'
  return (
    <section className="walk" role="region" aria-labelledby="walk-h" onKeyDown={(e) => e.key === 'Escape' && closeVisit()}>
      <button type="button" className="xbtn" aria-label={close} title={close} onClick={closeVisit}><span aria-hidden="true">✕</span></button>
      <p className="note">{word(lang, 'stop', { n: i + 1, total: list.length })} · <label>{word(lang, 'visitor')}:{' '}
        <select value={persona.id} onChange={(e) => setWalk({ pid: e.target.value, i: 0 })}>{d.personas.map((p) => <option key={p.id} value={p.id}>{pname(p)}</option>)}</select>
      </label></p>
      <div role="status" aria-live="polite">
        <h2 id="walk-h"><span aria-hidden="true">{ICON[s.status]}</span> {s.name} <span className="st">· {word(lang, s.status)}</span></h2>
        {s.works.length > 0 && <><h3>{word(lang, 'works')}</h3><ul className="ok">{s.works.map((w, k) => <li key={k}>✓ {w.text}{w.via?.length ? <span className="note"> ({word(lang, 'via', { items: names(w.via) })})</span> : null}</li>)}</ul></>}
        {s.fails.length > 0 && <><h3>{word(lang, 'fails')}</h3><ul className="no">
          {s.fails.slice(0, 3).map((f, k) => <li key={k}>✕ {f.text}{f.fix && <strong className="fix"> → {f.fix.text}</strong>}</li>)}
        </ul>
        {s.fails.length > 3 && <details><summary>{word(lang, 'more')}</summary><ul className="no">{s.fails.slice(3).map((f, k) => <li key={k}>✕ {f.text}{f.fix && <strong className="fix"> → {f.fix.text}</strong>}</li>)}</ul></details>}</>}
      </div>
      <div className="intro-nav">
        {i < last && <button type="button" className="link" onClick={() => setWalk({ i: last })}>{t(d, lang, 'walk_skip')}</button>}
        <button type="button" onClick={() => setWalk({ i: i - 1 })} disabled={i === 0}>{t(d, lang, 'walk_prev')}</button>
        {i < last ? <button type="button" onClick={() => setWalk({ i: i + 1 })} ref={next}>{t(d, lang, 'walk_next')}</button>
          : <button type="button" onClick={openDebrief} ref={next}>{word(lang, 'summary')}</button>}
      </div>
    </section>
  )
}
