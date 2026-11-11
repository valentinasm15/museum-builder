// Short generated tones for button feedback (no audio files). Never the only feedback: text and aria-live stay.
export type Cue = 'placed' | 'removed' | 'refused' | 'click'
const NOTES: Record<Cue, { f: number[]; type: OscillatorType }> = {
  placed: { f: [523, 784], type: 'sine' }, removed: { f: [784, 523], type: 'sine' }, refused: { f: [200, 200], type: 'square' }, click: { f: [660], type: 'sine' },
}
let ctx: AudioContext | null = null
let lastSpecific = -1e9 // when a placed/removed/refused cue last played, so the generic click tick does not double it
export function play(cue: Cue) {
  if (cue !== 'click') lastSpecific = performance.now()
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const { f, type } = NOTES[cue]
    f.forEach((hz, i) => {
      const t0 = ctx!.currentTime + i * 0.09
      const o = ctx!.createOscillator(), g = ctx!.createGain()
      o.type = type; o.frequency.value = hz
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.085)
      o.connect(g).connect(ctx!.destination); o.start(t0); o.stop(t0 + 0.09)
    })
  } catch { /* no audio available: silent */ }
}

/** One tick for every button or link press in the game (refused tone on aria-disabled ones), unless a specific cue just played. */
export function installClickCues(isOn: () => boolean) {
  const h = (e: MouseEvent) => {
    if (!isOn() || performance.now() - lastSpecific < 80) return
    const el = (e.target as Element | null)?.closest?.('button, a[href], summary, [role="button"]')
    if (el) play(el.getAttribute('aria-disabled') === 'true' ? 'refused' : 'click')
  }
  document.addEventListener('click', h)
  return () => document.removeEventListener('click', h)
}
