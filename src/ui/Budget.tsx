import type { GameData } from '../data/load'
import { budget, levelName, money, remaining, spent, t, useGame, visitNames } from '../store'

export default function Budget({ d }: { d: GameData }) {
  const { lang, placements, announcement, level, visit, round } = useGame()
  const vn = visitNames(d, lang, visit)
  const lv = d.levels.find((l) => l.id === level)
  const b = budget(d), s = spent(d, placements)
  return (
    <section aria-labelledby="budget-h" className="budget">
      <h2 id="budget-h" className="sr">{t(d, lang, 'budget')}</h2>
      <dl>
        <div><dt>{t(d, lang, 'budget')}{lv && ` (${levelName(lang, lv)})`}</dt><dd>{money(lang, b)}</dd></div>
        <div><dt>{t(d, lang, 'spent')}</dt><dd>{money(lang, s)}</dd></div>
        <div className="left"><dt>{t(d, lang, 'remaining')}</dt><dd>{money(lang, remaining(d, placements))}</dd></div>
      </dl>
      <p className="note">{t(d, lang, 'round')} {round}/{d.settings.rounds ?? 1} · {t(d, lang, 'drawn_visitor')}: {vn.persona} · {t(d, lang, 'drawn_situation')}: {vn.situation}</p>
      <progress max={b} value={s} aria-label={t(d, lang, 'spent')}>{money(lang, s)}</progress>
      <p role="status" aria-live="polite" className="announce">{announcement}</p>
    </section>
  )
}
