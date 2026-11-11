import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { loadData } from '../data/load'
import { money, type Visit } from '../store'
import { moneyEfficiency } from './benchmark'
import { band, debrief, efficiency, tradeoffs } from './feedback'
import { score } from './score'

const d = loadData(readFileSync('src/data/museum-builder-data.xlsx'))
const sit = (id: string) => d.situations.find((s) => s.id === id)!.id
const v = (situationId: string): Visit => ({ personaId: d.personas[0].id, situationId: sit(situationId) })
const cost = (id: string) => d.items.find((i) => i.id === id)!.costEur

it('bands rise with access; no precise percent is shown', () => {
  expect(band(d, 0)).toBe('partial'); expect(band(d, 1)).toBe('strong')
  const order = ['partial', 'good', 'strong']
  let last = 0
  for (let x = 0; x <= 1; x += 0.05) { const i = order.indexOf(band(d, x)); expect(i).toBeGreaterThanOrEqual(last); last = i }
})

it('who else uses the standard day for all personas, whatever situation was drawn', () => {
  const ps = [{ item: 'braille_label', at: d.zones[0].id }, { item: 'audio_guide_devices', at: '' }]
  const a = debrief(d, ps, v('with_audio_guide'), 'en'), b = debrief(d, ps, v('without_audio_guide'), 'en')
  expect(a.others).toEqual(b.others)
  expect(a.band).toBe(b.band)
  expect(a.others.length).toBe(d.personas.length)
  expect(a.band).toBe(band(d, score(d, ps).overall))
})

it('comfort / enabler items are listed apart with cost and stay out of the value list', () => {
  const ps = [{ item: 'seating', at: d.zones[0].id }, { item: 'visitor_wifi', at: '' }, { item: 'braille_label', at: d.zones[0].id }]
  const x = debrief(d, ps, v('with_audio_guide'), 'en')
  expect(x.side).toHaveLength(2)
  expect(x.side.some((s) => s.includes(money('en', cost('seating'))))).toBe(true)
  expect(x.values.some((s) => /Seating|Wi-?Fi/i.test(s))).toBe(false)
  expect(x.values).toHaveLength(1)
})

it('trade-offs cite real item costs in EN and FI', () => {
  const ps = [{ item: 'lighting', at: d.zones[0].id }, { item: 'robot_guide', at: '' }, { item: 'staff_training', at: '' }, { item: 'audio_guide_devices', at: '' }]
  for (const lang of ['en', 'fi'] as const) {
    const n = tradeoffs(d, lang, ps, v('unstaffed_hours'))
    expect(n.length).toBeGreaterThan(0); expect(n.length).toBeLessThanOrEqual(5)
    const all = n.join(' ')
    for (const id of ['lighting', 'robot_guide', 'staff_training', 'audio_guide_devices']) expect(all).toContain(money(lang, cost(id)))
    expect(all).not.toMatch(/[{}]|NaN|undefined/)
  }
  expect(tradeoffs(d, 'en', [], v('with_audio_guide'))).toEqual([])
})

it('money efficiency = player ÷ full-budget benchmark, plus same-spend benchmark and unspent', () => {
  const ps = [{ item: 'braille_label', at: d.zones[0].id }]
  const me = moneyEfficiency(d, ps)
  const e = efficiency(d, 'en', ps, me)
  expect(me.efficiency).toBeCloseTo(me.player.overall / me.benchmark.result.overall)
  expect(e.band).toBe(band(d, me.efficiency))
  expect(e.unspent).toContain(money('en', me.unspent))
  expect(e.diff).not.toMatch(/[{}]/)
}, 60000)
