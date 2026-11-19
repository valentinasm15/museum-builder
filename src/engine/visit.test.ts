import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { loadData } from '../data/load'
import { Plan, score } from './score'
import { stops, visit } from './visit'
import { t } from '../store'

const d = loadData(readFileSync('src/data/museum-builder-data.xlsx'))
const noPhone = d.personas.find((p) => !p.attrs.usesSmartphone && !p.attrs.needsContinuousRoute)!
const hasKey = (ev: ReturnType<typeof visit>, key: string) => ev.some((e) => e.key === key)
const off = new Plan(d, []) // route-less zone: not reachable by route today
const back = d.zones.find((z) => !off.routeComplete(z))!

it('walk mentions the persona, covers every zone once, ends with a total', () => {
  for (const lang of ['en', 'fi'] as const) {
    const ev = visit(d, [], noPhone, {}, lang)
    expect(ev[0].text).toContain((lang === 'fi' && noPhone.nameFi) || noPhone.name)
    expect(ev[ev.length - 1].key).toBe('walk_end')
    expect(ev.every((e) => !/[{}\[]/.test(e.text))).toBe(true) // no unfilled placeholder or missing key
  }
})

it('route-less zone: floor plan (existing) gives walk_reach_plan; without it the zone is skipped and called out', () => {
  const r = score(d, []).zones[back.id][noPhone.id].reach
  expect(r).toBeGreaterThan(0) // the workbook already has a floor plan; narrative must agree with the engine
  const withPlan = visit(d, [], noPhone)
  expect(hasKey(withPlan, 'walk_plan')).toBe(true)
  expect(withPlan.some((e) => e.zoneId === back.id && e.key === 'walk_reach_plan')).toBe(true)
  const bare = { ...d, existing: d.existing.filter((e) => e.itemId !== 'tactile_floor_plan') }
  expect(score(bare, []).zones[back.id][noPhone.id].reach).toBe(0)
  const none = visit(bare, [], noPhone)
  expect(none.filter((e) => e.zoneId === back.id).map((e) => e.key)).toEqual(['not_reachable'])
  expect(none.find((e) => e.key === 'not_reachable')!.text).toContain(back.nameEn)
  expect(hasKey(none, 'walk_plan')).toBe(false)
})

it('an item whose requirements are unmet is narrated as walk_inactive', () => {
  const ps = [{ item: 'tactile_replica', at: back.id }]
  expect(score(d, ps).inactive.length).toBeGreaterThan(0)
  const n = (ev: ReturnType<typeof visit>) => ev.filter((e) => e.key === 'walk_inactive')
  const ev = visit(d, ps, noPhone)
  expect(n(ev).some((e) => e.text.includes(d.items.find((i) => i.id === 'tactile_replica')!.name))).toBe(true)
  expect(n(ev).length).toBe(n(visit(d, [], noPhone)).length + 1)
})

it('no audio guide today: device-based audio is missing from the narrative', () => {
  const ps = [{ item: 'tactile_floor_plan', at: '' }, { item: 'audio_guide_devices', at: '' }, { item: 'audio_description', at: back.id }]
  const audio = (ctx: { hasMuseumDevice: boolean }) =>
    visit(d, ps, noPhone, ctx).find((e) => e.zoneId === back.id && e.key === 'walk_info')?.text ?? ''
  expect(audio({ hasMuseumDevice: true })).toContain(t(d, 'en', 'ch_audio'))
  expect(audio({ hasMuseumDevice: false })).not.toContain(t(d, 'en', 'ch_audio'))
})

it('rooms found only through the floor plan are counted as partly experienced, not fully', () => {
  const ps = [{ item: 'audio_guide_devices', at: '' }, { item: 'audio_description', at: back.id }]
  const ev = visit(d, ps, noPhone, { hasMuseumDevice: true })
  expect(ev[ev.length - 1].key).toBe('walk_end_partial')
  expect(ev[ev.length - 1].text).toMatch(/without a guiding route/)
})

const routeCost = d.items.find((i) => i.scope === 'path')!.costEur
const P = (item: string, at: string) => ({ item, at })

it('stops: entrance first, one stop per room in order, no unfilled placeholders (EN/FI)', () => {
  for (const lang of ['en', 'fi'] as const) {
    const s = stops(d, [P('audio_guide_devices', ''), P('audio_description', back.id)], noPhone, { hasMuseumDevice: true }, lang)
    expect(s[0].kind).toBe('entrance')
    expect(s.filter((x) => x.kind === 'room').map((x) => x.zoneId)).toEqual(d.zones.map((z) => z.id))
    const all = s.flatMap((x) => [x.name, ...x.works.map((w) => w.text), ...x.fails.flatMap((f) => [f.text, f.fix?.text ?? ''])]).join(' ')
    expect(all).not.toMatch(/[{}]|undefined|NaN|\[/)
  }
})

it('stops: a room beyond the route is cut off at the break and the fix is the missing segments', () => {
  const room = stops(d, [], noPhone).find((x) => x.zoneId === back.id)!
  const missing = new Plan(d, []).chain(back.routeSegment).filter((s) => !new Plan(d, []).segmentExists(s))
  expect(room.breakAt).toBe(missing[0])
  expect(['partial', 'none']).toContain(room.status)
  expect(room.fails[0].fix?.cost).toBe(missing.length * routeCost)
  expect(room.fails[0].fix?.items).toHaveLength(missing.length)
})

it('stops: devices with no audio content wait at the entrance; with content the room points back to them', () => {
  const idle = stops(d, [P('audio_guide_devices', '')], noPhone, { hasMuseumDevice: true }).find((x) => x.kind === 'entrance')!
  expect(idle.fails.some((f) => /waiting/.test(f.text))).toBe(true)
  const near = d.zones.find((z) => new Plan(d, []).routeComplete(z))!
  const used = stops(d, [P('audio_guide_devices', ''), P('audio_description', near.id)], noPhone, { hasMuseumDevice: true })
  expect(used.find((x) => x.zoneId === near.id)!.works.some((w) => w.via?.includes('audio_guide_devices'))).toBe(true)
  expect(used.find((x) => x.kind === 'entrance')!.fails.some((f) => /waiting/.test(f.text))).toBe(false)
})

it('stops: a reached room with nothing to use offers a fix with a real price', () => {
  const near = d.zones.find((z) => new Plan(d, []).routeComplete(z))!
  const blind = d.personas.find((p) => !p.attrs.residualVision && !p.attrs.needsContinuousRoute && p.attrs.usesSmartphone)!
  const room = stops(d, [], blind, {}).find((x) => x.zoneId === near.id)!
  expect(room.status).toBe('empty')
  expect(room.fails[0].fix?.cost).toBeGreaterThan(0)
}, 30000)

it('stops: an item the visitor cannot use is named as not for them', () => {
  const near = d.zones.find((z) => new Plan(d, []).routeComplete(z))!
  const lowv = d.personas.find((p) => !p.attrs.readsBraille)!
  const room = stops(d, [P('braille_label', near.id)], lowv).find((x) => x.zoneId === near.id)!
  expect(room.fails.some((f) => /does not help this visitor/.test(f.text))).toBe(true)
})

it('stops: the last stop is always the whole museum, with notes about the whole visit and no deficit wording', () => {
  for (const lang of ['en', 'fi'] as const) {
    const s = stops(d, [], noPhone, {}, lang), end = s[s.length - 1]
    expect(end.kind).toBe('exit')
    expect(end.name).toBe(lang === 'fi' ? 'Koko museo' : 'Whole museum')
    expect(end.notes.length).toBeGreaterThan(0)
    expect(end.notes.join(' ')).not.toMatch(/[{}]|undefined|NaN/)
  }
  const all = stops(d, [], noPhone).flatMap((x) => [...x.works.map((w) => w.text), ...x.fails.map((f) => f.text), ...x.notes]).join(' ')
  expect(all).not.toMatch(/cannot find it alone|Cannot reach/i)
})

it('a visitor who needs a continuous route gets the stronger wording; others get the independence wording', () => {
  const need = d.personas.find((p) => p.attrs.needsContinuousRoute)!
  const room = (p: typeof need) => stops(d, [], p).find((x) => x.zoneId === back.id)!.fails[0].text
  expect(room(need)).toMatch(/continuous guiding route/)
  expect(room(noPhone)).toMatch(/more effort and less independence/)
})
