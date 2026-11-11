import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameData } from '../data/load'
import { moneyEfficiency } from '../engine/benchmark'
import { bandText, debrief, efficiency, local } from '../engine/feedback'
import { money, t, useGame } from '../store'

// Plain headings, lists and text: reads in order with a screen reader, no animation.
export default function Debrief({ d }: { d: GameData }) {
  const { lang, placements, visit: v, round, startRound, closeVisit } = useGame()
  const ref = useRef<HTMLDialogElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  const [me, setMe] = useState<ReturnType<typeof moneyEfficiency> | null>(null)
  const x = useMemo(() => debrief(d, placements, v, lang), [d, placements, v, lang])
  const eff = useMemo(() => (me ? efficiency(d, lang, placements, me) : null), [d, lang, placements, me])
  const more = round < (d.settings.rounds ?? 1)
  const b = (k: Parameters<typeof bandText>[2]) => bandText(d, lang, k)
  const close = lang === 'fi' ? 'Sulje' : 'Close'

  useEffect(() => { const el = ref.current; if (el && !el.open) { el.showModal(); (nextBtn.current ?? el).focus({ preventScroll: true }) } }, [])
  useEffect(() => { const id = setTimeout(() => setMe(moneyEfficiency(d, placements)), 30); return () => clearTimeout(id) }, [d, placements])
  const next = () => { startRound(round + 1); requestAnimationFrame(() => document.getElementById('main')?.focus()) }

  return (
    <dialog ref={ref} className="intro visit debrief" aria-labelledby="deb-h" onClose={closeVisit}>
      <h2 id="deb-h">{t(d, lang, 'debrief')} · {t(d, lang, 'round')} {round}</h2>
      <p><strong>{t(d, lang, 'access_achieved')}: {b(x.band)}</strong></p>
      <p className="note">{t(d, lang, 'deb_no_perfect')}</p>

      <section aria-labelledby="deb-focal">
        <h3 id="deb-focal">{t(d, lang, 'deb_focal')}</h3>
        <p>{x.focal.persona}. {x.focal.situation}.</p>
        <p>{t(d, lang, 'deb_band', { band: b(x.focal.band) })}</p>
        <p>{x.focal.end}</p>
        {x.focal.skipped.length > 0 && <ul>{x.focal.skipped.map((s, i) => <li key={i}>{s}</li>)}</ul>}
      </section>

      <section aria-labelledby="deb-else">
        <h3 id="deb-else">{t(d, lang, 'deb_who_else')}</h3>
        <ul>{x.others.map((p) => <li key={p.id}>{p.name}: {b(p.band)}</li>)}</ul>
      </section>

      <section aria-labelledby="deb-dims">
        <h3 id="deb-dims">{local(lang, 'dims')}</h3>
        <dl>
          <dt>{t(d, lang, 'deb_reach')}</dt><dd>{b(x.dims.reach)}</dd>
          <dt>{t(d, lang, 'deb_info')}</dt><dd>{b(x.dims.info)}</dd>
          <dt>{t(d, lang, 'deb_richness')}</dt><dd>{b(x.dims.richness)}<br /><span className="note">{local(lang, 'richHint')}</span></dd>
          <dt>{t(d, lang, 'left_out')}</dt><dd>{x.leftOut.length ? x.leftOut.join('; ') : local(lang, 'nobody')}</dd>
        </dl>
        {x.inactiveTotal > 0 && <p><strong>{t(d, lang, 'inactive_items')}</strong>: {t(d, lang, 'deb_inactive_total', { amount: money(lang, x.inactiveTotal) })}</p>}
      </section>

      <section aria-labelledby="deb-money" aria-busy={!eff}>
        <h3 id="deb-money">{t(d, lang, 'money_efficiency')}</h3>
        {!eff ? <p role="status">{t(d, lang, 'loading')}</p> : (
          <dl>
            <dt>{t(d, lang, 'money_efficiency')}</dt><dd>{b(eff.band)}</dd>
            <dt>{local(lang, 'full')}</dt><dd>{b(eff.fullBand)}</dd>
            <dt>{t(d, lang, 'benchmark')}</dt><dd>{b(eff.atSpendBand)} ({local(lang, 'bench')} {eff.benchSpent}; {local(lang, 'you')} {eff.spent})</dd>
          </dl>
        )}
        {eff && <p>{eff.unspent}</p>}
        {eff?.diff && <p>{eff.diff}</p>}
      </section>

      {x.notes.length > 0 && <section aria-labelledby="deb-trade"><h3 id="deb-trade">{local(lang, 'trade')}</h3><ul>{x.notes.map((s, i) => <li key={i}>{s}</li>)}</ul></section>}

      <section aria-labelledby="deb-side">
        <h3 id="deb-side">{t(d, lang, 'deb_comfort')}</h3>
        {x.side.length ? <ul>{x.side.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p>{local(lang, 'none')}</p>}
      </section>

      {x.values.length > 0 && <details><summary>{t(d, lang, 'placed_items')}</summary><ul>{x.values.map((s, i) => <li key={i}>{s}</li>)}</ul></details>}

      <div className="intro-nav">
        <button type="button" onClick={() => ref.current?.close()}>{close}</button>
        {more && <button type="button" ref={nextBtn} onClick={next}>{t(d, lang, 'next_round')}</button>}
      </div>
    </dialog>
  )
}
