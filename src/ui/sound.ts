// Short generated tones for button feedback (no audio files). Never the only feedback: text and aria-live stay.
export type Cue = 'placed' | 'removed' | 'refused'
const NOTES: Record<Cue, { f: number[]; type: OscillatorType }> = {
  placed: { f: [523, 784], type: 'sine' }, removed: { f: [784, 523], type: 'sine' }, refused: { f: [200, 200], type: 'square' },
}
let ctx: AudioContext | null = null
export function play(cue: Cue) {
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
