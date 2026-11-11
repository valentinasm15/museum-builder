import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameData } from '../data/load'
import { visit } from '../engine/visit'
import { t, useGame, visitCtx } from '../store'

// Plain text step list: no animation, so prefers-reduced-motion needs no special case.
export default function Visit({ d }: { d: GameData }) {
  const { lang, placements, visit: v, closeVisit } = useGame()
  const ref = useRef<HTMLDialogElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const [pid, setPid] = useState(v.personaId)
  const [step, setStep] = useState(0)
  const [unlocked, setUnlocked] = useState(false) // other visitors are offered once the focal walk is over
  const persona = d.personas.find((p) => p.id === pid) ?? d.personas[0]
  const name = (p: typeof persona) => (lang === 'fi' && p.nameFi) || p.name
  const events = useMemo(() => visit(d, placements, persona, visitCtx(d, v), lang), [d, placements, persona, v, lang])
  const last = events.length - 1, at = Math.min(step, last)
  const go = (n: number) => { setStep(n); if (n >= last) setUnlocked(true) }
  const close = lang === 'fi' ? 'Sulje' : 'Close'

  useEffect(() => { const el = ref.current; if (el && !el.open) { el.showModal(); next.current?.focus({ preventScroll: true }) } }, [])
  useEffect(() => { if (unlocked) next.current?.focus({ preventScroll: true }) }, [unlocked])

  return (
    <dialog ref={ref} className="intro visit" aria-labelledby="visit-h" onClose={closeVisit}>
      <h2 id="visit-h">{t(d, lang, 'walkthrough')}: {name(persona)}</h2>
      <p className="note">{t(d, lang, 'intro_step', { n: String(at + 1), total: String(events.length) })}</p>
      {at > 0 && <ol>{events.slice(0, at).map((e, i) => <li key={i}>{e.text}</li>)}</ol>}
      <p role="status" aria-live="polite"><strong>{events[at].text}</strong></p>
      {unlocked && (
        <p>
          <label>{t(d, lang, 'switch_visitor')}{' '}
            <select value={pid} onChange={(e) => { setPid(e.target.value); setStep(0) }}>
              {d.personas.map((p) => <option key={p.id} value={p.id}>{name(p)}</option>)}
            </select>
          </label>
        </p>
      )}
      <div className="intro-nav">
        {at < last && <button type="button" className="link" onClick={() => go(last)}>{t(d, lang, 'walk_skip')}</button>}
        <button type="button" onClick={() => go(at - 1)} disabled={at === 0}>{t(d, lang, 'walk_prev')}</button>
        <button type="button" onClick={() => go(at + 1)} disabled={at === last} ref={next}>{t(d, lang, 'walk_next')}</button>
        <button type="button" onClick={() => ref.current?.close()}>{close}</button>
      </div>
    </dialog>
  )
}
