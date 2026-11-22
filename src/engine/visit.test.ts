import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { loadData, type GameData } from '../data/load'
import { Plan, score } from './score'
import { stops, visit } from './visit'
import { t } from '../store'

// Test-only variants (visitorShare 0): the shipped workbook has 4 personas, but these engine rules still need covering.
const withVariants = (g: GameData): GameData => {
  const by = (id: string) => g.personas.find((p) => p.id === id)!
  const mk = (id: string, from: string, attrs: Record<string, boolean>) => ({ ...by(from), id, visitorShare: 0, attrs: { ...by(from).attrs, ...attrs } })
  return { ...g, personas: [...g.personas, mk('low_vision_with_touch', 'low_vision_central', { comfortableWithTouch: true, needsMagnification: false }), mk('low_vision_glare', 'low_vision_central', { glareSensitive: true, needsMagnification: false }),
    mk('low_vision_no_smartphone', 'low_vision_central', { usesSmartphone: false }), mk('blind_no_smartphone', 'blind_non_braille', { usesSmartphone: false })] }
}
const d = withVariants(loadData(readFileSync('src/data/museum-builder-data.xlsx')))
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
const near0 = d.zones.find((z) => new Plan(d, []).routeComplete(z))!

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

it('stops: the audio guide alone is a general guide in the rooms; with audio description the room points back to it', () => {
  const alone = stops(d, [P('audio_guide_devices', '')], noPhone, { hasMuseumDevice: true })
  expect(alone.find((x) => x.kind === 'entrance')!.fails.some((f) => /waiting/.test(f.text))).toBe(false)
  expect(alone.find((x) => x.zoneId === near0.id)!.works.some((w) => /general audio guide/.test(w.text) && w.via?.includes('audio_guide_devices'))).toBe(true)
  const near = near0
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
    expect(end.name).toBe(lang === 'fi' ? 'Koko näyttely' : 'Whole exhibition')
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

it('an item that needs a route is explained as easy to miss, not as broken', () => {
  const room = stops(d, [P('braille_label', back.id)], d.personas.find((p) => p.attrs.readsBraille)!).find((x) => x.zoneId === back.id)!
  expect(room.fails.some((f) => /no way of knowing exactly where it is/.test(f.text))).toBe(true)
})

it('a screen with no followable film gets a line and a fix; with captions or description it does not', () => {
  const screen = d.zones.find((z) => z.hasScreen)!
  const low = d.personas.find((p) => p.attrs.residualVision && !p.attrs.glareSensitive)!
  const bare = stops(d, [], low).find((x) => x.zoneId === screen.id)!
  const line = bare.fails.find((f) => /film plays on this screen/.test(f.text))
  expect(line).toBeDefined()
  expect(line!.fix?.cost).toBeGreaterThan(0)
  const fixed = stops(d, [P('large_print_captions', screen.id)], low).find((x) => x.zoneId === screen.id)!
  expect(fixed.fails.some((f) => /film plays on this screen/.test(f.text))).toBe(false)
  const noScreen = d.zones.find((z) => !z.hasScreen)!
  expect(stops(d, [], low).find((x) => x.zoneId === noScreen.id)!.fails.some((f) => /film plays/.test(f.text))).toBe(false)
})

// ---- whole-museum (venue) items in the walkthrough ----
const near = near0
const walk = (ps: ReturnType<typeof P>[], ctx = {}, p = noPhone, lang: 'en' | 'fi' = 'en') => visit(d, ps, p, ctx, lang)
const DEV = d.items.find((i) => i.id === 'audio_guide_devices')!.name, AD = d.items.find((i) => i.id === 'audio_description')!.name // names live in the sheet
const clean = (texts: string[]) => expect(texts.join(' ')).not.toMatch(/[{}]|undefined|NaN|\[/)

it('venue: the entrance stop lists the floor plan and the audio guide; the guide alone is a general guide, not a description', () => {
  const ps = [P('audio_guide_devices', '')]
  const ent = stops(d, ps, noPhone, { hasMuseumDevice: true }).find((x) => x.kind === 'entrance')!
  expect(ent.works.some((w) => /floor plan/i.test(w.text))).toBe(true) // existing item, narrated at the entrance
  expect(ent.works.some((w) => w.text.includes(DEV))).toBe(true)
  expect(ent.fails.some((f) => f.text.includes(DEV))).toBe(false)
  const ev = walk(ps, { hasMuseumDevice: true })
  expect(ev.some((e) => e.key === 'walk_v_info' && e.text.includes(DEV) && /general audio guide/.test(e.text))).toBe(true)
  expect(ev.some((e) => e.key === 'walk_v_info_also' || e.key === 'walk_v_via')).toBe(false) // no room audio description to carry yet
  expect(ev.find((e) => e.zoneId === near.id && e.key === 'walk_info')?.text).toMatch(/general audio guide/)
  expect(ev.find((e) => e.zoneId === near.id && e.key === 'walk_info')?.text).not.toContain(t(d, 'en', 'ch_audio')) // not called a description
  expect(score(d, ps).overall).toBeGreaterThan(score(d, []).overall) // info_value 0.4: partial credit
})

it('venue: devices with audio description in a reachable room are narrated as working, at the entrance and in the room', () => {
  const ps = [P('audio_guide_devices', ''), P('audio_description', near.id)]
  const ev = walk(ps, { hasMuseumDevice: true })
  expect(ev.some((e) => e.key === 'walk_v_info_also' && e.text.includes(DEV) && e.text.includes(AD))).toBe(true)
  const inRoom = ev.find((e) => e.key === 'walk_v_via' && e.zoneId === near.id)
  expect(inRoom?.text).toContain(DEV)
  expect(ev.findIndex((e) => e.key === 'walk_v_carrier')).toBeLessThan(ev.findIndex((e) => e.key === 'walk_v_via')) // entrance before the room
  const s = stops(d, ps, noPhone, { hasMuseumDevice: true })
  expect(s.find((x) => x.kind === 'entrance')!.works.some((w) => w.text.includes(DEV))).toBe(true)
  expect(s.find((x) => x.zoneId === near.id)!.works.some((w) => w.via?.includes('audio_guide_devices'))).toBe(true)
})

it('venue: no device to lend today is named as the reason the room audio fails', () => {
  const ps = [P('audio_guide_devices', ''), P('audio_description', near.id)]
  const ev = walk(ps, { hasMuseumDevice: false })
  expect(ev.some((e) => e.key === 'walk_v_via_fail' && e.zoneId === near.id && e.text.includes(DEV))).toBe(true)
  expect(ev.some((e) => e.key === 'walk_v_via')).toBe(false)
  const room = stops(d, ps, noPhone, { hasMuseumDevice: false }).find((x) => x.zoneId === near.id)!
  expect(room.fails.some((f) => f.text.includes(`relies on ${DEV}`))).toBe(true)
})

it('venue: audio description with no device or phone is narrated as missing a requirement', () => {
  const ev = walk([P('audio_description', near.id)])
  expect(ev.some((e) => e.key === 'walk_inactive' && e.zoneId === near.id && e.text.includes(DEV))).toBe(true)
})

it('venue: staff training is narrated at the entrance and in the rooms it guides to; not when nobody is on duty', () => {
  const ps = [P('staff_training', '')]
  const ev = walk(ps)
  expect(ev.some((e) => e.key === 'walk_v_staff')).toBe(true)
  expect(ev.some((e) => e.key === 'walk_reach_staff' && e.zoneId === back.id)).toBe(true)
  const s = stops(d, ps, noPhone)
  expect(s.find((x) => x.kind === 'entrance')!.works.some((w) => /Staff training/.test(w.text))).toBe(true)
  expect(s.find((x) => x.zoneId === back.id)!.works.some((w) => w.via?.includes('staff_training'))).toBe(true)
  const off = walk(ps, { staffAvailable: false })
  expect(off.some((e) => e.key === 'walk_v_staff_no')).toBe(true)
  expect(off.some((e) => e.key === 'walk_reach_staff')).toBe(false)
  const need = d.personas.find((p) => p.attrs.needsContinuousRoute)!
  expect(walk(ps, {}, need).some((e) => e.key === 'walk_v_staff_cont')).toBe(true)
})

it('venue: website and take-aways are narrated at their moment; the website does not touch the score', () => {
  const ps = [P('website_info', ''), P('large_print_catalogue', '')]
  const low = d.personas.find((p) => p.attrs.residualVision)!
  const s = stops(d, ps, low)
  expect(s[0].kind).toBe('before')
  expect(s[0].works.some((w) => /website/i.test(w.text) && /does not change the access score/.test(w.text))).toBe(true)
  expect(s[s.length - 1].works.some((w) => /catalogue/i.test(w.text))).toBe(true)
  const ev = walk(ps, {}, low)
  const k = ev.map((e) => e.key)
  expect(k.indexOf('walk_v_unscored')).toBeLessThan(k.indexOf('walk_v_info')) // before the visit, then the exit item
  expect(k.indexOf('walk_v_info')).toBeGreaterThan(k.lastIndexOf('walk_no_info') - 1)
  expect(score(d, [P('website_info', '')]).overall).toBe(score(d, []).overall)
})

it('venue: every walkthrough line is filled in, EN and FI', () => {
  const all = [P('audio_guide_devices', ''), P('audio_description', near.id), P('staff_training', ''), P('website_info', ''), P('visitor_wifi', ''), P('braille_catalogue', '')]
  for (const lang of ['en', 'fi'] as const) for (const ctx of [{}, { hasMuseumDevice: false, staffAvailable: false }]) {
    clean(walk(all, ctx, noPhone, lang).map((e) => e.text))
    clean(stops(d, all, noPhone, ctx, lang).flatMap((x) => [...x.works.map((w) => w.text), ...x.fails.map((f) => f.text)]))
  }
})
