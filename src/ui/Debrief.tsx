import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameData } from '../data/load'
import { moneyEfficiency } from '../engine/benchmark'
import { bandText, debrief, efficiency, local, nextStep } from '../engine/feedback'
import { money, t, useGame, visitCtx } from '../store'

const VENUE_ICON = { ok: '✓', waiting: '○', idle: '○', missing: '⚠', unscored: '–' } as const // not colour alone: the text says it too

// Plain headings, lists and text: reads in order with a screen reader, no animation.
export default function Debrief({ d, onRestart }: { d: GameData; onRestart: () => void }) {
  const { lang, placements, visit: v, round, startRound, closeVisit, rounds, setRound, restart } = useGame()
  const ref = useRef<HTMLDialogElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  const [me, setMe] = useState<ReturnType<typeof moneyEfficiency> | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const x = useMemo(() => debrief(d, placements, v, lang), [d, placements, v, lang])
  const eff = useMemo(() => (me ? efficiency(d, lang, placements, me, visitCtx(d, v)) : null), [d, lang, placements, me, v])
  const more = round < (d.settings.rounds ?? 1)
  useEffect(() => { setRound({ n: round, visitor: x.focal.persona, focal: x.focal.band, overall: x.band }) }, [round, x.focal.persona, x.focal.band, x.band, setRound])
  const b = (k: Parameters<typeof bandText>[2]) => bandText(d, lang, k)
  const close = lang === 'fi' ? 'Sulje' : 'Close'

  useEffect(() => { const el = ref.current; if (el && !el.open) { el.showModal(); (nextBtn.current ?? el).focus({ preventScroll: true }) } }, [])
  useEffect(() => { const id = setTimeout(() => { setMe(moneyEfficiency(d, placements)); setNext(nextStep(d, lang, placements)) }, 30); return () => clearTimeout(id) }, [d, placements, lang])
  const nxt = () => { startRound(round + 1); requestAnimationFrame(() => document.getElementById('main')?.focus()) }

  const L = (k: Parameters<typeof local>[1], v: Record<string, string | number> = {}) => local(lang, k, v)
  const icon = { full: '●', partial: '◐', empty: '○', none: '✕' } as const
  const total = d.settings.rounds ?? 1
  return (
    <dialog ref={ref} className="intro visit debrief" aria-labelledby="deb-h" onClose={closeVisit}>
      <header className="deb-top">
        <h2 id="deb-h">{t(d, lang, 'debrief')} · {L('roundOf', { n: round, total })}</h2>
        <p className="verdict"><span className={`band ${x.band}`}>{b(x.band)}</span> {L('verdict', { n: x.verdict.works, total: x.verdict.total })}</p>
        {x.verdict.gap && <p>{x.verdict.gap}</p>}
        <p>{L('spentOf', { spent: money(lang, x.spent), budget: money(lang, x.budget) })}</p>
        <nav aria-label={t(d, lang, 'debrief')}><ul className="deb-nav">
          {([['a', 'navA'], ['b', 'navB'], ['c', 'navC'], ['d', 'navD']] as const).map(([id, k]) => <li key={id}><a href={`#deb-${id}`}>{L(k)}</a></li>)}
        </ul></nav>
      </header>

      <section aria-labelledby="deb-a-h" id="deb-a">
        <h3 id="deb-a-h">{L('titleA')}</h3>
        <p><strong>{x.focal.persona}</strong> · {x.focal.situation}</p>
        <p>{t(d, lang, 'deb_band', { band: '' })} <span className={`band ${x.focal.band}`}>{b(x.focal.band)}</span></p>
        <ol className="rooms">{x.focal.rooms.map((r, n) => (
          <li key={r.id} className={`st-${r.status}`}><span aria-hidden="true">{icon[r.status]}</span> {n + 1}. {r.name}<span className="st"> · {L(`st_${r.status}` as 'st_full')}</span></li>
        ))}</ol>
        <p className="note">{L('roomsLegend')}</p>
        {x.focal.gaps.length > 0 && <ul>{x.focal.gaps.map((s, i) => <li key={i}>{s}</li>)}</ul>}
      </section>

      <section aria-labelledby="deb-b-h" id="deb-b">
        <h3 id="deb-b-h">{L('titleB')}</h3>
        <details><summary>{L('showTable')}</summary>
        <table className="who">
          <thead><tr><th scope="col">{L('colType')}</th><th scope="col">{L('colShare')}</th><th scope="col">{L('colResult')}</th><th scope="col">{L('colRooms')}</th></tr></thead>
          <tbody>{x.others.map((p) => (
            <tr key={p.id}><th scope="row">{p.name}</th><td>{Math.round(p.share * 100)}%</td><td><span className={`band ${p.band}`}>{b(p.band)}</span></td><td>{p.rooms}/{p.total}</td></tr>
          ))}</tbody>
        </table>
        <h4>{L('checks')}</h4>
        <dl>
          <dt>{t(d, lang, 'deb_reach')}</dt><dd>{b(x.dims.reach)}</dd>
          <dt>{t(d, lang, 'deb_info')}</dt><dd>{b(x.dims.info)}</dd>
          <dt>{t(d, lang, 'deb_richness')}</dt><dd>{b(x.dims.richness)}<br /><span className="note">{local(lang, 'richHint')}</span></dd>
        </dl>
        </details>
      </section>

      <section aria-labelledby="deb-c-h" id="deb-c" aria-busy={!eff}>
        <h3 id="deb-c-h">{L('titleC')}</h3>
        <p><progress value={x.spent} max={x.budget || 1} aria-label={L('spentOf', { spent: money(lang, x.spent), budget: money(lang, x.budget) })} /> {money(lang, Math.max(0, x.budget - x.spent))} {L('left')}</p>
        <p>{L('wasted')}: <strong>{money(lang, x.inactiveTotal + x.idle.reduce((a, i) => a + i.cost, 0))}</strong></p>
        {x.idle.some((i) => !x.venue.some((v) => i.key.startsWith(v.key))) && <ul>{x.idle.filter((i) => !x.venue.some((v) => i.key.startsWith(v.key))).map((i) => <li key={i.key}>{i.text}</li>)}</ul>}
        {x.venue.length > 0 && <><h4>{t(d, lang, 'deb_venue')}</h4><ul className="venue">{x.venue.map((v) => <li key={v.key}><span aria-hidden="true">{VENUE_ICON[v.state]} </span>{v.text}</li>)}</ul></>}
        {x.values.length > 0 && <ul>
          <li>{L('bestBuy')}: {x.values[0]}</li>
          {x.values.length > 1 && <li>{L('weakBuy')}: {x.values[x.values.length - 1]}</li>}
        </ul>}
        {!eff ? <p role="status">{t(d, lang, 'loading')}</p> : <>
          <p><strong>{t(d, lang, 'money_efficiency')}: {b(eff.band)}</strong> · {L('benchLine', { band: b(eff.atSpendBand), bench: eff.benchSpent, you: eff.spent })}</p>
          {eff.diff && <p>{eff.diff}</p>}
          <p>{eff.unspent}</p>
        </>}
        {x.notes.length > 0 && <details><summary>{L('moreTrade')}</summary><ul>{x.notes.map((s, i) => <li key={i}>{s}</li>)}</ul></details>}
        {x.side.length > 0 && <details><summary>{t(d, lang, 'deb_comfort')}</summary><ul>{x.side.map((s, i) => <li key={i}>{s}</li>)}</ul></details>}
        {x.values.length > 0 && <details><summary>{t(d, lang, 'placed_items')}</summary><ul>{x.values.map((s, i) => <li key={i}>{s}</li>)}</ul></details>}
      </section>

      <section aria-labelledby="deb-d-h" id="deb-d" aria-busy={next === null}>
        <h3 id="deb-d-h">{L('titleD')}</h3>
        <p role="status">{next ?? t(d, lang, 'loading')}</p>
      </section>

      {!more && <section aria-labelledby="deb-game-h" id="deb-game">
        <h3 id="deb-game-h">{L('gameTitle')}</h3>
        <ol>{rounds.map((r) => <li key={r.n}>{L('roundLine', { n: r.n, visitor: r.visitor, focal: b(r.focal as Parameters<typeof bandText>[2]), overall: b(r.overall as Parameters<typeof bandText>[2]) })}</li>)}</ol>
      </section>}

      <p className="note">{t(d, lang, 'deb_no_perfect')}</p>
      {more && <p>{L('keepPlan')}</p>}
      <div className="intro-nav">
        <button type="button" onClick={() => ref.current?.close()}>{close}</button>
        {more ? <button type="button" ref={nextBtn} onClick={nxt}>{t(d, lang, 'next_round')}</button>
          : <button type="button" ref={nextBtn} onClick={() => { restart(); ref.current?.close(); onRestart() }}>{L('playAgain')}</button>}
      </div>
    </dialog>
  )
}
