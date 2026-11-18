import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Icon-only header button that opens a small popup. Esc or an outside click closes it. */
export default function Menu({ id, label, icon, children }: { id: string; label: string; icon: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="a11y" ref={root}>
      <button type="button" ref={btn} className="icon" aria-label={label} title={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{icon}</button>
      {open && <div id={id} className="a11y-panel" role="group" aria-label={label}>{children(() => setOpen(false))}</div>}
    </div>
  )
}
