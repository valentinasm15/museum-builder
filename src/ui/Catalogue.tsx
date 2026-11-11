import { useEffect, useRef, useState } from 'react'
import type { GameData, Item, Scope } from '../data/load'
import { channelKey, lookOf } from '../scene/look'
import {
  canPlace, cue, helpsText, isExisting, isPlaced, itemName, money, needsText, remaining, t, targetName, useGame,
} from '../store'

const TABS: { scope: Scope; key: string }[] = [
  { scope: 'zone', key: 'zone' }, { scope: 'path', key: 'route_segment' }, { scope: 'venue', key: 'whole_museum' },
]
const targetsFor = (d: GameData, i: Item) =>
  i.scope === 'venue' ? [''] : i.scope === 'path' ? d.route.map((s) => s.id) : d.zones.map((z) => z.id)
const focusId = (id: string) => setTimeout(() => document.getElementById(id)?.focus())

function Targets({ d, item }: { d: GameData; item: Item }) {
  const { lang, placements, place, remove, select } = useGame()
  const ref = useRef<HTMLFieldSetElement>(null)
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button:not([aria-disabled="true"])')?.focus() }, [])
  const cancel = () => { select(null); focusId(`sel-${item.id}`) }
  return (
    <fieldset ref={ref} className="targets" onKeyDown={(e) => e.key === 'Escape' && cancel()}>
      <legend>{t(d, lang, 'targets')}</legend>
      {targetsFor(d, item).map((at) => {
        const mine = isPlaced(placements, item.id, at) // placed by the player: pressing it again removes it
        const ok = canPlace(d, placements, item.id, at)
        const why = isExisting(d, item.id, at) ? 'existing' : 'unaffordable'
        return mine ? (
          <button key={at} type="button" aria-pressed="true" onClick={() => remove({ item: item.id, at })}>
            {targetName(d, lang, at)} ({t(d, lang, 'already_placed')}: {t(d, lang, 'remove')})
          </button>
        ) : (
          <button key={at} type="button" aria-disabled={!ok} onClick={() => (ok ? place(item.id, at) && focusId(`sel-${item.id}`) : cue('refused'))}>
            {targetName(d, lang, at)}{!ok && <> ({t(d, lang, why)})</>}
          </button>
        )
      })}
      <button type="button" className="cancel" onClick={cancel}>{t(d, lang, 'cancel')}</button>
    </fieldset>
  )
}

function Detail({ d, item }: { d: GameData; item: Item }) {
  const lang = useGame((s) => s.lang)
  const key = `ch_${channelKey(item)}`
  return (
    <div className="detail">
      <h3>{itemName(lang, item)} · {money(lang, item.costEur)}</h3>
      {d.texts[key] && <p className="tag">+ {t(d, lang, key)}</p>}
      <p><b>{t(d, lang, 'helps')}:</b> {helpsText(d, lang, item)}</p>
      <p><b>{t(d, lang, 'requires')}:</b> {needsText(d, lang, item.requires)}</p>
      {item.source && <p className="src"><b>{t(d, lang, 'source')}:</b> {item.source}</p>}
      <Targets d={d} item={item} />
    </div>
  )
}

export default function Catalogue({ d }: { d: GameData }) {
  const { lang, placements, selected, select, place, remove } = useGame()
  const [tab, setTab] = useState<Scope>('zone')
  const left = remaining(d, placements)
  const picked = d.items.find((i) => i.id === selected)
  return (
    <section aria-labelledby="cat-h" className="toolkit">
      <h2 id="cat-h" className="sr">{t(d, lang, 'catalogue')}</h2>
      <div role="group" aria-label={t(d, lang, 'catalogue')} className="tabs">
        {TABS.map((x) => (
          <button key={x.scope} type="button" aria-pressed={tab === x.scope} onClick={() => setTab(x.scope)}>{t(d, lang, x.key)}</button>
        ))}
      </div>
      <ul className="tiles">
        {d.items.filter((i) => i.costEur > 0 && i.scope === tab).map((i) => {
          const venue = i.scope === 'venue'
          const mine = venue && isPlaced(placements, i.id, '') // venue item bought by the player: pressing it again removes it
          const done = venue && isExisting(d, i.id, '')
          const off = done || (!mine && i.costEur > left)
          const flag = done ? 'existing' : off ? 'unaffordable' : ''
          return (
            <li key={i.id}>
              <button type="button" id={`sel-${i.id}`} aria-disabled={off} aria-pressed={venue ? mine : selected === i.id}
                onClick={() => { if (off) return cue('refused'); if (mine) remove({ item: i.id, at: '' }); else if (venue) place(i.id, ''); else select(selected === i.id ? null : i.id) }}>
                <span className="ico" aria-hidden="true">{lookOf(i).glyph}</span>
                <span className="tname">{itemName(lang, i)}</span>
                <span className="tcost">{money(lang, i.costEur)}{flag && <><br />{t(d, lang, flag)}</>}{mine && <><br />{t(d, lang, 'already_placed')}: {t(d, lang, 'remove')}</>}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {picked && <Detail d={d} item={picked} />}
    </section>
  )
}
