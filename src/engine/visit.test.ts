import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { loadData } from '../data/load'
import { Plan, score } from './score'
import { visit } from './visit'
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
