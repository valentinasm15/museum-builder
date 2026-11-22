import { useEffect, useRef, useState } from 'react'
import type { GameData, Item, Scope } from '../data/load'
import { channelKey, lookOf } from '../scene/look'
import Room from './Room'
import {
  canPlace, cue, enables, helpsText, isExisting, isPlaced, itemName, money, needsText, remaining, t, targetName, useGame,
} from '../store'

type Tab = Scope | 'room'
const TABS: { scope: Tab; key: string }[] = [
  { scope: 'zone', key: 'zone' }, { scope: 'path', key: 'route_segment' }, { scope: 'venue', key: 'whole_museum' }, { scope: 'room', key: 'room_tab' },
]
const HINT: Record<Scope, string> = { zone: 'scope_zone_hint', path: 'scope_path_hint', venue: 'scope_venue_hint' }
const targetsFor = (d: GameData, i: Item) =>
  i.scope === 'venue' ? [''] : i.scope === 'path' ? d.route.map((s) => s.id) : d.zones.map((z) => z.id)
const focusId = (id: string) => setTimeout(() => document.getElementById(id)?.focus())

function Targets({ d, item }: { d: GameData; item: Item }) {
  const { lang, placements, place, remove, select } = useGame()
  const ref = useRef<HTMLFieldSetElement>(null)
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button:not([aria-disabled="true"])')?.focus() }, [])
  const cancel = () => { select(null); focusId(`sel-${item.id}`) }
  const list = targetsFor(d, item)
  const afterPlace = (at: string) => { // venue items are one-shot; zone/path items stay selected, so move to the next free target
    if (item.scope === 'venue') return focusId(`sel-${item.id}`)
    const st = useGame.getState(), k = list.indexOf(at)
    for (let n = 1; n <= list.length; n++) {
      const x = list[(k + n) % list.length]
      if (canPlace(d, st.placements, item.id, x)) return focusId(`tgt-${x}`)
    }
    focusId('tgt-cancel')
  }
  return (
    <fieldset ref={ref} className="targets" onKeyDown={(e) => e.key === 'Escape' && cancel()}>
      <legend>{t(d, lang, 'targets')}</legend>
      {list.map((at) => {
        const mine = isPlaced(placements, item.id, at) // placed by the player: pressing it again removes it
        const ok = canPlace(d, placements, item.id, at)
        const why = isExisting(d, item.id, at) ? 'existing' : 'unaffordable'
        return mine ? (
          <button key={at} id={`tgt-${at}`} type="button" aria-pressed="true" onClick={() => remove({ item: item.id, at })}>
            {targetName(d, lang, at)} ({t(d, lang, 'already_placed')}: {t(d, lang, 'remove')})
          </button>
        ) : (
          <button key={at} id={`tgt-${at}`} type="button" aria-disabled={!ok} onClick={() => (ok ? place(item.id, at) && afterPlace(at) : cue('refused'))}>
            {targetName(d, lang, at)}{!ok && <> ({t(d, lang, why)})</>}
          </button>
        )
      })}
      <button type="button" id="tgt-cancel" className="cancel" onClick={cancel}>{t(d, lang, 'cancel')}</button>
    </fieldset>
  )
}

function Detail({ d, item }: { d: GameData; item: Item }) {
  const lang = useGame((s) => s.lang)
  const key = `ch_${channelKey(item)}`
  const en = enables(d, item.id)
  return (
    <div className="detail">
      <h3>{itemName(lang, item)} · {money(lang, item.costEur)}</h3>
      {d.texts[key] && <p className="tag">+ {t(d, lang, key)}</p>}
      <p><b>{t(d, lang, 'helps')}:</b> {helpsText(d, lang, item)}</p>
      <p><b>{t(d, lang, 'requires')}:</b> {needsText(d, lang, item.requires)}</p>
      {en.length > 0 && <p><b>{t(d, lang, 'enables')}:</b> {en.map((i) => itemName(lang, i)).join(', ')}</p>}
      {item.benefit && <p><b>{t(d, lang, 'source')}:</b> {(lang === 'fi' && item.benefitFi) || item.benefit}</p>}
      <Targets d={d} item={item} />
    </div>
  )
}

export default function Catalogue({ d }: { d: GameData }) {
  const { lang, placements, selected, select, focus } = useGame()
  const [tab, setTab] = useState<Tab>('zone')
  useEffect(() => { // the skip link in the Accessibility menu points at #room-h
    const go = () => { if (location.hash === '#room-h') { setTab('room'); setTimeout(() => document.getElementById('room-h')?.focus()) } }
    go(); window.addEventListener('hashchange', go)
    return () => window.removeEventListener('hashchange', go)
  }, [])
  const left = remaining(d, placements)
  const picked = d.items.find((i) => i.id === selected)
  const fz = d.zones.find((z) => z.id === focus), about = fz && ((lang === 'fi' && fz.aboutFi) || fz.about)
  return (
    <section aria-labelledby="cat-h" className="toolkit">
      <h2 id="cat-h" className="sr">{t(d, lang, 'catalogue')}</h2>
      <div role="group" aria-label={t(d, lang, 'catalogue')} className="tabs">
        {TABS.map((x) => (
          <button key={x.scope} type="button" aria-pressed={tab === x.scope} onClick={() => setTab(x.scope)}>{t(d, lang, x.key)}</button>
        ))}
      </div>
      {tab === 'room' ? <Room d={d} /> : <>
      <p className="hint">{t(d, lang, HINT[tab])}</p>
      <div aria-live="polite" className="aboutwrap">{fz && about && <div className="detail about"><h3>{(lang === 'fi' && fz.nameFi) || fz.nameEn} · {t(d, lang, 'about_room')}</h3><p>{about}</p></div>}</div>
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
                onClick={() => (off ? cue('refused') : select(selected === i.id ? null : i.id))}>
                <span className="ico" aria-hidden="true">{lookOf(i).glyph}</span>
                <span className="tname">{itemName(lang, i)}</span>
                <span className="tcost">{money(lang, i.costEur)}{flag && <><br />{t(d, lang, flag)}</>}{mine && <><br />{t(d, lang, 'already_placed')}</>}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {picked && <Detail key={picked.id} d={d} item={picked} />}
      </>}
    </section>
  )
}
