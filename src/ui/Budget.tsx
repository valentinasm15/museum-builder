import type { GameData } from '../data/load'
import { budget, money, remaining, spent, t, useGame } from '../store'

export default function Budget({ d }: { d: GameData }) {
  const { lang, placements, announcement } = useGame()
  const b = budget(d), s = spent(d, placements)
  return (
    <section aria-labelledby="budget-h" className="budget">
      <h2 id="budget-h" className="sr">{t(d, lang, 'budget')}</h2>
      <dl>
        <div><dt>{t(d, lang, 'budget')}</dt><dd>{money(lang, b)}</dd></div>
        <div><dt>{t(d, lang, 'spent')}</dt><dd>{money(lang, s)}</dd></div>
        <div className="left"><dt>{t(d, lang, 'remaining')}</dt><dd>{money(lang, remaining(d, placements))}</dd></div>
      </dl>
      <progress max={b} value={s} aria-label={t(d, lang, 'spent')}>{money(lang, s)}</progress>
      <p role="status" aria-live="polite" className="announce">{announcement}</p>
    </section>
  )
}
