import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadData, type GameData } from '../data/load'
import { benchmark, bundles, moneyEfficiency } from './benchmark'
import { Plan, score, usable, type Placement, type VisitContext } from './score'

const data = loadData(readFileSync('src/data/museum-builder-data.xlsx'))
const Z = 'viestinta' // route segment s1 exists today
const P = { nb: 'blind_non_braille', br: 'blind_braille', lv: 'low_vision_central', lw: 'low_vision_with_touch', tun: 'low_vision_tunnel', gl: 'low_vision_glare', nph: 'low_vision_no_smartphone', bns: 'blind_no_smartphone' }
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
    const r0 = base.zones.lajittelu[P.lw].reach, r1 = lit.zones.lajittelu[P.lw].reach
    expect(r1).toBeCloseTo(Math.min(1, r0 * data.scoring.lighting_reach_factor))
    expect(r1).toBeGreaterThan(r0)
    expect(lit.zones[Z][P.lw].channels).toContain('visual')
    expect(lit.zones[Z][P.lw].info).toBeGreaterThan(base.zones[Z][P.lw].info)
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

describe('personas and situations (thin filters)', () => {
  const persona = (id: string) => data.personas.find((p) => p.id === id)!
  const sc = (pl: Placement[], ctx?: VisitContext) => score(data, pl, ctx)
  const route = ['s4', 's5', 's6'].map((s) => at('tactile_route', s))

  it('visitorShare sums to 1 and low_vision is retired', () => {
    expect(data.personas.reduce((a, p) => a + p.visitorShare, 0)).toBeCloseTo(1)
    expect(data.personas.some((p) => p.id === 'low_vision')).toBe(false)
    expect(data.situations.map((s) => s.id)).toContain('phone_battery_dead')
  })

  it('no ctx, undefined ctx and {} give the same result', () => {
    const pl = [at('braille_label'), at('audio_description'), at('audio_guide_devices', ''), at('staff_training', ''), ...route]
    expect(sc(pl, undefined)).toEqual(score(data, pl))
    expect(sc(pl, {})).toEqual(score(data, pl))
  })

  it('hasMuseumDevice=false: audio guide devices stop working', () => {
    const pl = [at('audio_guide_devices', ''), at('audio_description')]
    expect(sc(pl).zones[Z][P.bns].channels).toContain('audio')
    const r = sc(pl, { hasMuseumDevice: false })
    expect(r.zones[Z][P.bns].channels).not.toContain('audio')
    expect(r.personas[P.bns]).toBeLessThan(sc(pl).personas[P.bns])
  })

  it('phoneWorks=false switches smartphone off for the call only', () => {
    const pl = [at('smartphone_audio', ''), at('audio_description')]
    expect(sc(pl).zones[Z][P.nb].channels).toContain('audio')
    expect(sc(pl, { phoneWorks: false }).zones[Z][P.nb].channels).not.toContain('audio')
    expect(persona(P.nb).attrs.usesSmartphone).toBe(true)
    expect(sc(pl).zones[Z][P.nb].channels).toContain('audio')
  })

  it('staffAvailable=false: no staff-guided reach, no guided touch tour', () => {
    const pl = [at('staff_training', ''), at('touch_permission'), at('guided_touch_tour', '')]
    expect(sc(pl).zones.lajittelu[P.nb].reach).toBe(data.scoring.reach_staff_guided)
    expect(sc(pl, { staffAvailable: false }).zones.lajittelu[P.nb].reach).toBe(data.scoring.reach_plan_only)
    expect(usable(new Plan(data, pl), 'guided_touch_tour', '', persona(P.nb))).toBe(true)
    expect(usable(new Plan(data, pl, { staffAvailable: false }), 'guided_touch_tour', '', persona(P.nb))).toBe(false)
  })

  it('needsContinuousRoute skips staff-guided reach; route and plan_only unchanged', () => {
    const staff = sc([at('staff_training', '')]).zones.lajittelu
    expect(staff[P.lw].reach).toBe(data.scoring.reach_staff_guided)
    expect(staff[P.tun].reach).toBe(data.scoring.reach_plan_only)
    expect(sc(route).zones.lajittelu[P.tun].reach).toBe(data.scoring.reach_full)
  })

  it('glareSensitive: lighting gives no reach or enhancement, and dims visual channels', () => {
    const pl = [at('large_print_label'), at('lighting')]
    const plain = sc([at('large_print_label')]), lit = sc(pl)
    expect(lit.zones[Z][P.lw].info).toBeGreaterThan(plain.zones[Z][P.lw].info) // control: others gain
    expect(lit.zones[Z][P.gl].reach).toBe(plain.zones[Z][P.gl].reach)
    expect(lit.zones[Z][P.gl].info).toBeCloseTo(plain.zones[Z][P.gl].info / data.scoring.lighting_reach_factor)
    expect(lit.personas[P.gl]).toBeLessThan(plain.personas[P.gl])
  })

  it('needsMagnification: exhibit_view only counts with working large print', () => {
    const zone = data.zones.find((z) => sc([]).zones[z.id][P.lw].channels.includes('visual'))!
    expect(zone).toBeDefined()
    expect(sc([]).zones[zone.id][P.lv].channels).not.toContain('visual')
    const lp = sc([at('large_print_label', zone.id)]).zones[zone.id][P.lv].channels
    expect(lp).toEqual(expect.arrayContaining(['visual', 'visual_enhanced']))
  })
})
