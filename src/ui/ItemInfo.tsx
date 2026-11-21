import { useEffect, useMemo, useRef } from 'react'
import type { GameData } from '../data/load'
import { inactiveMap, itemName, money, needsText, t, targetName, useGame, waitingMap, type Lang } from '../store'

// Click a placed item on the map to read what it is for and what it still needs. Live: the card updates as soon as the missing piece is placed.
const L = {
  works: { en: 'Works', fi: 'Toimii' }, wait: { en: 'Not working yet', fi: 'Ei vielä toimi' },
  needs: { en: 'To work it needs {missing}.', fi: 'Toimiakseen se tarvitsee: {missing}.' },
  now: { en: '{item} works now.', fi: '{item} toimii nyt.' },
}
const say = (lang: Lang, k: keyof typeof L, v: Record<string, string> = {}) => L[k][lang].replace(/\{(\w+)\}/g, (m, n) => v[n] ?? m)

export default function ItemInfo({ d }: { d: GameData }) {
  const { lang, placements, inspect, setInspect, remove } = useGame()
  const gaps = useMemo(() => (inspect ? inactiveMap(d, placements).get(`${inspect.item}@${inspect.at}`) : undefined), [d, placements, inspect])
  const users = useMemo(() => (inspect ? waitingMap(d, placements).get(`${inspect.item}@${inspect.at}`) : undefined), [d, placements, inspect]) // carries other items, none placed yet
  const item = inspect ? d.items.find((i) => i.id === inspect.item) : undefined
  const was = useRef(false) // was it waiting a moment ago? Announce the change when it starts to work.
  useEffect(() => {
    if (!item) { was.current = false; return }
    if (was.current && !gaps && !users) useGame.setState({ announcement: say(lang, 'now', { item: itemName(lang, item) }) })
    was.current = !!gaps || !!users
  }, [gaps, users, item, lang])
  useEffect(() => { // Escape closes the card even when focus is still on the glyph that opened it (outside the card)
    if (!inspect) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setInspect(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [inspect, setInspect])
  const exists = !!inspect && (placements.some((p) => p.item === inspect.item && p.at === inspect.at) || d.existing.some((e) => e.itemId === inspect.item && e.zoneId === inspect.at))
  if (!inspect || !item || !exists) return null
  const close = lang === 'fi' ? 'Sulje' : 'Close'
  const mine = placements.some((p) => p.item === inspect.item && p.at === inspect.at)
  return (
    <section className={`iteminfo ${gaps || users ? 'wait' : 'ok'}`} role="region" aria-label={itemName(lang, item)} onKeyDown={(e) => e.key === 'Escape' && setInspect(null)}>
      <button type="button" className="xbtn" aria-label={close} title={close} onClick={() => setInspect(null)}><span aria-hidden="true">✕</span></button>
      <h3>{itemName(lang, item)}{inspect.at && <span className="note"> · {targetName(d, lang, inspect.at)}</span>}</h3>
      <p className="status"><span aria-hidden="true">{gaps || users ? '⚠' : '✓'}</span> {gaps ? say(lang, 'wait') : users ? t(d, lang, 'waiting_state') : say(lang, 'works')}</p>
      {gaps && <p>{say(lang, 'needs', { missing: needsText(d, lang, gaps) })}</p>}
      {!gaps && users && <p>{t(d, lang, 'waiting_needs', { needs: users.slice(0, 4).map((id) => itemName(lang, d.items.find((i) => i.id === id)!)).join(', ') })}</p>}
      {(lang === 'fi' && item.benefitFi) || item.benefit ? <p><b>{t(d, lang, 'source')}:</b> {(lang === 'fi' && item.benefitFi) || item.benefit}</p> : null}
      {mine && <button type="button" className="small" onClick={() => { remove({ item: inspect.item, at: inspect.at }); setInspect(null) }}>{t(d, lang, 'remove')} · {money(lang, item.costEur)}</button>}
    </section>
  )
}
