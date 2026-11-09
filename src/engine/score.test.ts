import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadData, type GameData } from '../data/load'
import { benchmark, bundles, moneyEfficiency } from './benchmark'
import { Plan, score, type Placement } from './score'

const data = loadData(readFileSync('src/data/museum-builder-data.xlsx'))
const Z = 'viestinta' // route segment s1 exists today
const P = { nb: 'blind_non_braille', br: 'blind_braille', lv: 'low_vision' }
const at = (item: string, where = Z): Placement => ({ item, at: where })
const base = score(data, [])

describe('engine', () => {
  it('replica without label/audio is inactive and adds nothing', () => {
    const r = score(data, [at('tactile_replica')])
    expect(r.inactive.map((i) => i.placement.item)).toContain('tactile_replica')
    expect(r.overall).toBe(base.overall)
  })

  it('braille label helps only the braille reader', () => {
    const r = score(data, [at('braille_label')])
    expect(r.personas[P.br]).toBeGreaterThan(base.personas[P.br])
    expect(r.personas[P.nb]).toBe(base.personas[P.nb])
    expect(r.personas[P.lv]).toBe(base.personas[P.lv])
  })

  it('smartphone audio excludes the persona without a smartphone', () => {
    // every persona in the xlsx now has a smartphone, so switch it off for the braille reader
    const d2: GameData = { ...data, personas: data.personas.map((p) => (p.id === P.br ? { ...p, attrs: { ...p.attrs, usesSmartphone: false } } : p)) }
    const pl = [at('smartphone_audio', ''), at('audio_description')]
    const r = score(d2, pl)
    expect(r.personas[P.nb]).toBeGreaterThan(base.personas[P.nb])
    expect(r.personas[P.br]).toBe(score(d2, []).personas[P.br])
    expect(score(data, pl).personas[P.br]).toBeGreaterThan(base.personas[P.br])
  })

  it('a shared route segment is paid once', () => {
    const cost = data.items.find((i) => i.id === 'tactile_route')!.costEur
    const route = ['s4', 's5', 's6'].map((s) => at('tactile_route', s))
    expect(new Plan(data, [...route, at('tactile_route', 's4')]).cost()).toBe(3 * cost)
    const plan = new Plan(data, route.slice(0, 2))
    // Lajittelu (s6) needs only the one missing segment once s4,s5 are paid
    expect(bundles(plan, at('braille_label', 'lajittelu'))[0].filter((p) => p.item === 'tactile_route')).toHaveLength(1)
  })

  it('enhance_factor boosts large print', () => {
    const plain = score(data, [at('large_print_label')])
    const lit = score(data, [at('large_print_label'), at('lighting')])
    expect(lit.zones[Z][P.lv].info).toBeGreaterThan(plain.zones[Z][P.lv].info)
    expect(lit.personas[P.lv]).toBeGreaterThan(plain.personas[P.lv])
  })

  it('benchmark beats braille-everywhere at equal spend', () => {
    const brailleAll = [at('braille_catalogue', ''), ...data.zones.flatMap((z) => [
      ...data.route.filter((s) => !s.existing).map((s) => at('tactile_route', s.id)),
      at('braille_label', z.id)])]
    const { player, benchmarkAtSpend: b, efficiency, efficiencyAtSpend } = moneyEfficiency(data, brailleAll)
    expect(b.result.spent).toBeLessThanOrEqual(player.spent)
    expect(b.result.overall).toBeGreaterThan(player.overall)
    expect(efficiencyAtSpend).toBeLessThan(1)
    expect(efficiency).toBeLessThanOrEqual(efficiencyAtSpend)
    const full = benchmark(data, data.settings.budget_eur)
    expect(full.result.spent).toBeLessThanOrEqual(data.settings.budget_eur)
  })

  it('lighting raises low-vision reach and exhibit_view value, nothing for blind personas', () => {
    const lit = score(data, [at('lighting', 'lajittelu'), at('lighting')])
    const r0 = base.zones.lajittelu[P.lv].reach, r1 = lit.zones.lajittelu[P.lv].reach
    expect(r1).toBeCloseTo(Math.min(1, r0 * data.scoring.lighting_reach_factor))
    expect(r1).toBeGreaterThan(r0)
    expect(lit.zones[Z][P.lv].channels).toContain('visual')
    expect(lit.zones[Z][P.lv].info).toBeGreaterThan(base.zones[Z][P.lv].info)
    for (const k of [P.nb, P.br]) expect(lit.zones.lajittelu[k]).toEqual(base.zones.lajittelu[k])
    expect(lit.zones[Z][P.nb]).toEqual(base.zones[Z][P.nb])
  })

  it('reach_grant drives staff-guided reach, even after renaming the item', () => {
    const plan = [at('staff_training', ''), at('touch_permission'), at('guided_touch_tour', '')]
    const reachOf = (d: GameData, pl: Placement[]) => score(d, pl).zones.lajittelu[P.nb].reach
    expect(reachOf(data, plan)).toBe(data.scoring.reach_staff_guided)
    expect(base.zones.lajittelu[P.nb].reach).toBe(data.scoring.reach_plan_only)
    const ren = (id: string) => (id === 'staff_training' ? 'training_renamed' : id)
    const d2: GameData = {
      ...data,
      items: data.items.map((i) => ({ ...i, id: ren(i.id), requires: i.requires.map((g) => g.map(ren)) })),
    }
    expect(reachOf(d2, plan.map((p) => ({ ...p, item: ren(p.item) })))).toBe(data.scoring.reach_staff_guided)
  })

  it('efficiency at €0 is low against the full-budget benchmark', () => {
    const e = moneyEfficiency(data, [])
    expect(e.benchmark.result.overall).toBeGreaterThan(0.5)
    expect(e.efficiency).toBeLessThan(0.2)
    expect(e.unspent).toBe(data.settings.budget_eur)
  })

  it('low vision with audio alone stays below 100%', () => {
    const r = score(data, [at('smartphone_audio', ''), ...data.zones.map((z) => at('audio_description', z.id))])
    expect(r.personas[P.lv]).toBeLessThan(1)
  })

  it('staff training alone gives staff-guided reach to every zone', () => {
    const r = score(data, [at('staff_training', '')])
    for (const z of data.zones)
      if (!z.routeSegment || !new Plan(data, []).routeComplete(z))
        expect(r.zones[z.id][P.nb].reach).toBeGreaterThanOrEqual(data.scoring.reach_staff_guided)
    expect(r.zones.lajittelu[P.nb].reach).toBe(data.scoring.reach_staff_guided)
  })
})
