import { useEffect, useRef } from 'react'
import type { GameData } from '../data/load'
import { local } from '../engine/feedback'
import { budget, inactiveMap, itemName, money, spent, targetName, useGame, waitingMap } from '../store'

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
  const sp = spent(d, placements), empty = placements.length === 0
  const name = (k: string) => {
    const [item, at] = k.split('@'), it = d.items.find((i) => i.id === item)
    return `${it ? itemName(lang, it) : item}, ${targetName(d, lang, at)}`
  }
  const bad = [...inactiveMap(d, placements).keys()], idle = [...waitingMap(d, placements).keys()]
  const L = (k: Parameters<typeof local>[1], v: Record<string, string | number> = {}) => local(lang, k, v)
  return (
    <dialog ref={ref} className="intro" aria-labelledby="launch-h" onClose={onClose}>
      <h2 id="launch-h">{L('launchH')}</h2>
      {empty && <p><strong>{L('launchEmpty')}</strong></p>}
      <p>{L('launchSummary', { spent: money(lang, sp), budget: money(lang, budget(d)), n: placements.length })}</p>
      {bad.length > 0 && <><p>{L('launchInactive')}</p><ul>{bad.map((k) => <li key={k}>{name(k)}</li>)}</ul></>}
      {idle.length > 0 && <><p>{L('launchWaiting')}</p><ul>{idle.map((k) => <li key={k}>{name(k)}</li>)}</ul></>}
      <div className="intro-nav">
        <button type="button" ref={go} onClick={() => ref.current?.close()}>{L('launchBack')}</button>
        <button type="button" onClick={() => { ref.current?.close(); openMuseum() }}>{L('launchGo')}</button>
      </div>
    </dialog>
  )
}
