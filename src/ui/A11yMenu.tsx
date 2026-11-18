import { useEffect, useState } from 'react'
import Menu from './Menu'
import { t, useGame } from '../store'
import type { GameData } from '../data/load'

const KEY = 'mb-contrast'
const STEPS = [1, 1.15, 1.3, 1.5, 1.75] // CSS contrast() filter per step; step 0 = as designed
const saved = () => { try { return Math.min(STEPS.length - 1, Math.max(0, Number(localStorage.getItem(KEY)) || 0)) } catch { return 0 } }

export default function A11yMenu({ d }: { d: GameData }) {
  const { lang, sound, setSound } = useGame()
  const [level, setLevel] = useState(saved)

  useEffect(() => {
    const h = document.documentElement
    if (level) { h.dataset.contrast = String(level); h.style.setProperty('--contrast', String(STEPS[level])) }
    else { delete h.dataset.contrast; h.style.removeProperty('--contrast') }
    try { localStorage.setItem(KEY, String(level)) } catch { /* ignore */ }
  }, [level])

  const name = t(d, lang, `a11y_contrast_${level}`)
  const icon = (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor"><circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="6.2" r="1.7" /><path d="M6 9.2c3.9 1.1 8.1 1.1 12 0l.4 1.4c-1.2.4-2.4.6-3.6.8v2.5l1.6 5.3-1.5.5L12 14.6l-2.9 5.1-1.5-.5 1.6-5.3v-2.5c-1.2-.2-2.4-.4-3.6-.8z" /></svg>
  )
  return (
    <Menu id="a11y-panel" label={t(d, lang, 'a11y_menu')} icon={icon}>
      {(close) => (
        <>
          <a href="#room-h" onClick={close}>{t(d, lang, 'room_view')}</a>
          <button type="button" onClick={() => setSound(!sound)}>{t(d, lang, sound ? 'sound_on' : 'sound_off')}</button>
          <label htmlFor="a11y-contrast">{t(d, lang, 'a11y_contrast')}: <strong>{name}</strong></label>
          <input id="a11y-contrast" type="range" min={0} max={STEPS.length - 1} step={1} value={level}
            aria-valuetext={name} onChange={(e) => setLevel(Number(e.target.value))} />
          <div className="a11y-ticks" aria-hidden="true">{STEPS.map((_, i) => <span key={i} />)}</div>
        </>
      )}
    </Menu>
  )
}
