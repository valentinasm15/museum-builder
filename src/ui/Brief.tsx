import type { GameData } from '../data/load'
import { budget, money, t, useGame } from '../store'

export default function Brief({ d }: { d: GameData }) {
  const lang = useGame((s) => s.lang)
  return (
    <section aria-labelledby="brief-h" className="brief">
      <h2 id="brief-h" className="sr">{t(d, lang, 'brief')}</h2>
      <p>{t(d, lang, 'challenge', { budget: money(lang, budget(d)) })}</p>
      <details>
        <summary>{t(d, lang, 'visitors')}</summary>
        <ul>{d.personas.map((p) => <li key={p.id}>{(lang === 'fi' && p.nameFi) || p.name}</li>)}</ul>
        <p className="note">{t(d, lang, 'model_disclaimer')}</p>
      </details>
    </section>
  )
}
