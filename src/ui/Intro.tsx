import { useEffect, useRef } from 'react'
import type { GameData } from '../data/load'
import { t, useGame } from '../store'

export default function Intro({ d, open, onClose }: { d: GameData; open: boolean; onClose: () => void }) {
  const lang = useGame((s) => s.lang)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el && open && !el.open) el.showModal()
    if (el && !open && el.open) el.close()
  }, [open])
  return (
    <dialog ref={ref} className="intro" aria-labelledby="intro-h" onClose={onClose}>
      <h2 id="intro-h">{t(d, lang, 'intro_title')}</h2>
      <p>{t(d, lang, 'intro_goal')}</p>
      <ol>{[1, 2, 3, 4].map((n) => <li key={n}>{t(d, lang, `intro_${n}`)}</li>)}</ol>
      <button type="button" autoFocus onClick={onClose}>{t(d, lang, 'intro_start')}</button>
    </dialog>
  )
}
