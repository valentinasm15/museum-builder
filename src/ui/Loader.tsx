import { useEffect, useMemo, useRef, useState } from 'react'

const N = 12 // the logo is revealed as an N×N grid of pixels
const calm = () => document.documentElement.dataset.motion === 'reduce' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Fixed order in which the pixels light up (a seeded shuffle, so it looks the same every time). */
function pixelOrder() {
  const cells = Array.from({ length: N * N }, (_, i) => i)
  let s = 7
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]] }
  return cells
}

/**
 * Full-screen loading logo: grey at first, then filling with colour pixel by pixel. While loading it creeps towards 90%;
 * when `done` it fills the rest and calls `onFinished`. With reduced motion it shows the colour logo and finishes at once.
 */
export default function Loader({ done, onFinished }: { done: boolean; onFinished: () => void }) {
  const order = useMemo(pixelOrder, [])
  const [shown, setShown] = useState(0)
  const doneRef = useRef(done), fin = useRef(onFinished)
  doneRef.current = done; fin.current = onFinished
  const still = calm()

  useEffect(() => {
    if (still) { setShown(N * N); return }
    const t0 = performance.now(); let tDone = 0, raf = 0, ended = false
    const tick = (now: number) => {
      const creep = 0.9 * (1 - Math.exp(-(now - t0) / 1100)) // never quite finishes on its own
      if (doneRef.current && !tDone) tDone = now
      const p = doneRef.current ? Math.max(creep, Math.min(1, creep + (now - tDone) / 350)) : creep
      setShown(Math.round(p * N * N))
      if (p >= 1 && !ended) { ended = true; setTimeout(() => fin.current(), 250); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [still])
  useEffect(() => { if (still && done) fin.current() }, [still, done])

  const lit = useMemo(() => new Set(order.slice(0, shown)), [order, shown])
  const cell = 48 / N
  const mark = (
    <>
      <rect width="48" height="48" rx="12" fill="#f5e6c4" />
      <path d="M10 10h28v12h-8v16H10z" fill="none" stroke="#3b2f24" strokeWidth="3" strokeLinejoin="round" />
      <rect x="14" y="14" width="8" height="8" rx="1" fill="#2f6f85" />
      <rect x="14" y="26" width="8" height="8" rx="1" fill="#d98f94" />
      <rect x="26" y="26" width="8" height="8" rx="1" fill="#2f6f85" />
      <path d="M38 36v8" stroke="#f2c230" strokeWidth="5" />
    </>
  )
  const fi = typeof navigator !== 'undefined' && navigator.language.startsWith('fi')
  return (
    <main id="main" className="loader" aria-busy="true">
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="loader-logo">
        <defs>
          <mask id="loader-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
            {[...lit].map((i) => <rect key={i} x={(i % N) * cell} y={Math.floor(i / N) * cell} width={cell + 0.02} height={cell + 0.02} fill="#fff" />)}
          </mask>
        </defs>
        <g className="loader-grey">{mark}</g>
        <g mask="url(#loader-mask)">{mark}</g>
      </svg>
      <p role="status" className="sr">{fi ? 'Ladataan…' : 'Loading…'}</p>
    </main>
  )
}
