import { useMemo } from 'react'
import type { GameData } from '../data/load'
import type { Placement } from '../engine/score'
import { inactiveMap, isExisting, itemName, needsText, t, targetName, useGame, waitingMap } from '../store'

export default function Room({ d }: { d: GameData }) {
  const { lang, placements, remove, focus, setFocus } = useGame()
  const missing = useMemo(() => inactiveMap(d, placements), [d, placements])
  const waiting = useMemo(() => waitingMap(d, placements), [d, placements])
  const all: Placement[] = [...d.existing.map((e) => ({ item: e.itemId, at: e.zoneId })), ...placements].filter((p) => (d.items.find((i) => i.id === p.item)?.costEur ?? 0) > 0) // zero-cost existing items are baseline, as on the map
  const route = d.items.find((i) => i.scope === 'path')

  const entry = (p: Placement) => {
    const item = d.items.find((i) => i.id === p.item)!
    const gaps = missing.get(`${p.item}@${p.at}`), wait = waiting.get(`${p.item}@${p.at}`)
    const mine = placements.some((x) => x.item === p.item && x.at === p.at)
    return (
      <li key={`${p.item}@${p.at}`}>
        <span className="name">{itemName(lang, item)}</span>{' — '}
        {gaps ? <span className="bad"><span aria-hidden="true">⚠ </span>{t(d, lang, 'needs_missing', { missing: needsText(d, lang, gaps) })}</span>
          : wait ? <span className="bad"><span aria-hidden="true">⚠ </span>{t(d, lang, 'waiting_state')} ({wait.slice(0, 3).map((id) => itemName(lang, d.items.find((i) => i.id === id)!)).join(', ')})</span>
          : <span className="good"><span aria-hidden="true">✓ </span>{t(d, lang, 'active')}</span>}
        {!mine && <> · {t(d, lang, 'existing')}</>}
        {mine && <button type="button" className="small" onClick={() => { remove(p); document.getElementById('room-h')?.focus() }}>
          {t(d, lang, 'remove')}<span className="sr"> {itemName(lang, item)}, {targetName(d, lang, p.at)}</span>
        </button>}
      </li>
    )
  }
  const segment = (seg: string) => {
    const existing = route && isExisting(d, route.id, seg)
    const placed = all.filter((p) => p.at === seg)
    return (
      <div className="seg">{t(d, lang, 'route_segment')}:{' '}
        {existing ? `${route && itemName(lang, route)} · ${t(d, lang, 'existing')}` : !placed.length && t(d, lang, 'nothing_placed')}
        {placed.length > 0 && <ul>{placed.map(entry)}</ul>}
      </div>
    )
  }
  const block = (key: string, title: string, at: string, seg?: string) => {
    const here = all.filter((p) => p.at === at)
    const sel = focus === key
    return (
      <li key={key} id={`room-${key}`} className={sel ? 'sel' : undefined}>
        <h3><button type="button" className="link" aria-pressed={sel} onClick={() => setFocus(sel ? null : key)}>{title}</button></h3>
        {seg && segment(seg)}
        {at !== seg && (here.length ? <ul>{here.map(entry)}</ul> : <p>{t(d, lang, 'nothing_placed')}</p>)}
      </li>
    )
  }
  return (
    <section aria-labelledby="room-h" className="roomtab">
      <h2 id="room-h" className="sr" tabIndex={-1}>{t(d, lang, 'room_view')}</h2>
      <ul className="room">
        {block('venue', t(d, lang, 'whole_museum'), '')}
        {d.route.map((s) => {
          const z = d.zones.find((x) => x.routeSegment === s.id)
          return z ? block(z.id, `${d.zones.indexOf(z) + 1}. ${targetName(d, lang, z.id)}`, z.id, s.id) // walking order: zones and zone-less segments interleave by route
            : block(s.id, targetName(d, lang, s.id), s.id, s.id)
        })}
      </ul>
    </section>
  )
}
