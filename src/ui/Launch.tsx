import { useEffect, useRef } from 'react'
import type { GameData } from '../data/load'
import { local } from '../engine/feedback'
import { budget, inactiveMap, isPlaced, itemName, money, spent, t, targetName, useGame, waitingMap } from '../store'

/** Confirm before the visit starts: spend, placements, and items that are placed but do not work. */
export default function Launch({ d, open, onClose }: { d: GameData; open: boolean; onClose: () => void }) {
  const { lang, placements, openMuseum } = useGame()
  const ref = useRef<HTMLDialogElement>(null)
  const go = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = ref.current
    if (open && el && !el.open) { el.showModal(); go.current?.focus({ preventScroll: true }) }
    if (!open && el?.open) el.close()
  }, [open])
  const sp = spent(d, placements)
  const name = (k: string) => {
    const [item, at] = k.split('@'), it = d.items.find((i) => i.id === item)
    return `${it ? itemName(lang, it) : item}, ${targetName(d, lang, at)}`
  }
  const mine = (k: string) => { const [item, at] = k.split('@'); return isPlaced(placements, item, at) } // existing (free) items are not the player's
  const bad = [...inactiveMap(d, placements).keys()].filter(mine), idle = [...waitingMap(d, placements).keys()].filter(mine)
  const L = (k: Parameters<typeof local>[1], v: Record<string, string | number> = {}) => local(lang, k, v)
  return (
    <dialog ref={ref} className="intro" aria-labelledby="launch-h" onClose={onClose}>
      <h2 id="launch-h">{t(d, lang, 'open_museum')}?</h2>
      <p>{L('launchSummary', { spent: money(lang, sp), budget: money(lang, budget(d)), n: placements.length })}</p>
      {bad.length > 0 && <><p>{L('launchInactive')}</p><ul>{bad.map((k) => <li key={k}>{name(k)}</li>)}</ul></>}
      {idle.length > 0 && <><p>{L('launchWaiting')}</p><ul>{idle.map((k) => <li key={k}>{name(k)}</li>)}</ul></>}
      <div className="intro-nav">
        <button type="button" ref={go} onClick={() => ref.current?.close()}>{L('launchBack')}</button>
        <button type="button" onClick={() => { ref.current?.close(); openMuseum() }}>{t(d, lang, 'open_museum')}</button>
      </div>
    </dialog>
  )
}
