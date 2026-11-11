import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameData } from '../data/load'
import { budget, levelName, money, t, useGame } from '../store'

// Step 0 is the welcome; steps 1-4 point at a part of the screen. The highlight is decoration: every step is also plain text.
const TARGETS = ['', '.toolkit', '.play > .scene', '.toolkit .tiles', 'header .budget']

export default function Intro({ d, open, onClose }: { d: GameData; open: boolean; onClose: () => void }) {
  const { lang, level, setLevel, visit } = useGame()
  const ref = useRef<HTMLDialogElement>(null)
  const go = useRef<HTMLButtonElement>(null)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const last = TARGETS.length - 1

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) { setStep(0); el.showModal(); go.current?.focus({ preventScroll: true }); el.scrollTop = 0 }
    if (!open && el.open) el.close()
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const el = TARGETS[step] ? document.querySelector(TARGETS[step]) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    if (TARGETS[step]) document.querySelector(TARGETS[step])?.scrollIntoView({ block: 'nearest' })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, step, lang])

  // Place the card beside the highlighted area, measured after it renders so its real size is used.
  useLayoutEffect(() => {
    const el = ref.current
    const { innerWidth: vw, innerHeight: vh } = window
    if (!open || !el || !rect || vw <= 700) { setPos(null); return }
    el.style.cssText = ''
    const { width: w, height: h } = el.getBoundingClientRect()
    const side = rect.left > vw * 0.6, bar = rect.bottom < 160
    const left = side ? rect.left - w - 16 : bar ? rect.left : rect.left + 16
    const top = bar ? rect.bottom + 12 : side ? rect.top + 16 : rect.bottom - h - 16
    setPos({ left: Math.max(8, Math.min(left, vw - w - 8)), top: Math.max(8, Math.min(top, vh - h - 8)) })
  }, [open, rect, lang])

  const vp = d.personas.find((p) => p.id === visit.personaId), vs = d.situations.find((x) => x.id === visit.situationId)
  const pn = vp && ((lang === 'fi' && vp.nameFi) || vp.name), sn = vs && ((lang === 'fi' && vs.nameFi) || vs.name)
  const title = step === 0 ? t(d, lang, 'intro_title') : t(d, lang, 'intro_step', { n: String(step), total: String(last) })
  return (
    <>
      {open && rect && <div className="spot" aria-hidden="true" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <dialog ref={ref} className={pos ? 'intro tour' : 'intro'} style={pos ?? undefined} aria-labelledby="intro-h" onClose={onClose}>
        <div aria-live="polite">
          <h2 id="intro-h">{title}</h2>
          <p>{step === 0 ? t(d, lang, 'intro_goal') : t(d, lang, `intro_${step}`)}</p>
          {step === 0 && <>
            <fieldset className="levels">
              <legend>{t(d, lang, 'level')}</legend>
              {d.levels.map((l) => (
                <label key={l.id}>
                  <input type="radio" name="level" value={l.id} checked={level === l.id} onChange={() => setLevel(l.id)} />
                  {levelName(lang, l)} · {money(lang, l.budgetEur)}
                </label>
              ))}
              <p className="note">{t(d, lang, 'level_hint')}</p>
            </fieldset>
            <p><strong>{t(d, lang, 'challenge', { budget: money(lang, budget(d)) })}</strong></p>
            {pn && sn && <p><strong>{t(d, lang, 'intro_visitor', { persona: pn, situation: sn })}</strong></p>}
            <p>{t(d, lang, 'visitors')}: {d.personas.map((p) => (lang === 'fi' && p.nameFi) || p.name).join('; ')}.</p>
            <p className="note">{t(d, lang, 'model_disclaimer')}</p>
          </>}
        </div>
        <div className="intro-nav">
          {step < last && <button type="button" className="link" onClick={() => ref.current?.close()}>{t(d, lang, 'intro_skip')}</button>}
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)}>{t(d, lang, 'intro_back')}</button>}
          <button type="button" ref={go} onClick={() => (step < last ? setStep(step + 1) : ref.current?.close())}>{t(d, lang, step < last ? 'intro_next' : 'intro_start')}</button>
        </div>
      </dialog>
    </>
  )
}
