import type { GameData, Item, Persona, Zone } from '../data/load'

/** at = zone id (zone items), segment id (path items) or '' (venue items). */
export interface Placement { item: string; at: string }
export interface ZoneResult { reach: number; info: number; channels: string[]; score: number }
export interface ScoreResult {
  zones: Record<string, Record<string, ZoneResult>> // zone → persona
  personas: Record<string, number>
  overall: number
  leftOut: string[] // personas with zoneScore 0 somewhere
  inactive: { placement: Placement; missing: string[] }[]
  spent: number
}

/** Today's conditions for one visit. Omitted fields (or no ctx) = normal day; scoring is unchanged. */
export interface VisitContext { hasMuseumDevice?: boolean; phoneWorks?: boolean; staffAvailable?: boolean }
// Items with a special role in the situation/attr filters (ids as in the Items sheet).
const DEVICE = 'audio_guide_devices', STAFFED_TOUR = 'guided_touch_tour', LIGHTING = 'lighting', VIEW = 'exhibit_view'

const key = (p: Placement) => `${p.item}@${p.at}`

export class Plan {
  readonly set = new Set<string>()
  readonly placements: Placement[] = []
  readonly items: Map<string, Item>
  constructor(readonly data: GameData, player: Placement[], readonly ctx: VisitContext = {}) {
    this.items = new Map(data.items.map((i) => [i.id, i]))
    for (const e of data.existing) this.add({ item: e.itemId, at: e.zoneId }, true)
    for (const p of player) this.add(p, false)
  }
  readonly free = new Set<string>()
  private add(p: Placement, existing: boolean) {
    const k = key(p)
    if (existing) this.free.add(k)
    if (this.set.has(k)) return
    this.set.add(k)
    this.placements.push(p)
  }
  has = (item: string, at: string) => this.set.has(`${item}@${at}`)
  segmentExists = (seg: string) =>
    this.data.route.find((s) => s.id === seg)?.existing === true ||
    this.data.items.some((i) => i.scope === 'path' && this.has(i.id, seg))
  /** Segments from the entrance to `seg`, entrance side first. */
  chain(seg: string): string[] {
    const out: string[] = []
    for (let s = seg; s && s !== 'entrance'; s = this.data.route.find((r) => r.id === s)?.from ?? '') {
      if (out.includes(s)) break
      out.unshift(s)
    }
    return out
  }
  routeComplete = (zone: Zone) => this.chain(zone.routeSegment).every(this.segmentExists)
  cost(): number {
    let sum = 0
    for (const p of this.placements) {
      const item = this.items.get(p.item)
      if (!item || this.free.has(key(p))) continue
      if (item.scope === 'path' && this.data.route.find((s) => s.id === p.at)?.existing) continue
      sum += item.costEur
    }
    return sum
  }
}

/** Is item placed at `at` working for persona p? p = null ignores the reach attribute (pure requirement check). */
export function usable(plan: Plan, itemId: string, at: string, p: Persona | null, memo = new Map<string, boolean>(), stack = new Set<string>()): boolean {
  const k = `${itemId}@${at}#${p?.id ?? '*'}`
  if (memo.has(k)) return memo.get(k)!
  if (stack.has(k)) return false
  const item = plan.items.get(itemId)
  let ok = !!item && plan.has(itemId, at) && (p === null || item.reach === 'all' || p.attrs[item.reach] === true)
  const c = plan.ctx // today's conditions apply to a persona's visit only, not to the persona-free requirement check
  if (ok && p !== null && ((c.hasMuseumDevice === false && itemId === DEVICE) || (c.staffAvailable === false && itemId === STAFFED_TOUR) ||
    (c.phoneWorks === false && item!.reach === 'usesSmartphone'))) ok = false
  if (ok) {
    stack.add(k)
    ok = item!.requires.every((g) => g.some((t) => tokenMet(plan, t, at, p, memo, stack)))
    stack.delete(k)
  }
  memo.set(k, ok)
  return ok
}

function tokenMet(plan: Plan, t: string, at: string, p: Persona | null, memo: Map<string, boolean>, stack: Set<string>): boolean {
  const zone = plan.data.zones.find((z) => z.id === at)
  if (t === 'route') return !!zone && plan.routeComplete(zone)
  if (t === 'has_screen') return !!zone?.hasScreen
  const target = plan.items.get(t)
  if (!target) return false
  if (target.scope === 'path') return !!zone && plan.routeComplete(zone)
  if (target.scope === 'venue') return usable(plan, t, '', p, memo, stack)
  if (target.scope === 'zone' && !zone) return plan.data.zones.some((z) => usable(plan, t, z.id, p, memo, stack))
  return usable(plan, t, at, p, memo, stack)
}

/** Requirement groups of a placement that are not met (ignoring persona). */
export function missingRequirements(plan: Plan, p: Placement): string[][] {
  const memo = new Map<string, boolean>()
  return (plan.items.get(p.item)?.requires ?? []).filter((g) => !g.some((t) => tokenMet(plan, t, p.at, null, memo, new Set())))
}

/** Does a placed, usable item carry this reach_grant (Items sheet) for p? */
function grants(plan: Plan, grant: string, p: Persona, memo: Map<string, boolean>): boolean {
  if (grant === 'staff_guided' && plan.ctx.staffAvailable === false) return false
  return plan.placements.some((pl) => plan.items.get(pl.item)?.reachGrant === grant && usable(plan, pl.item, pl.at, p, memo))
}

export function reach(plan: Plan, zone: Zone, p: Persona, memo = new Map<string, boolean>()): number {
  const s = plan.data.scoring
  let r = 0
  if (plan.routeComplete(zone)) r = s.reach_full
  else if (!p.attrs.needsContinuousRoute && grants(plan, 'staff_guided', p, memo)) r = s.reach_staff_guided
  else if (grants(plan, 'plan_only', p, memo)) r = s.reach_plan_only
  if (p.attrs.residualVision && !p.attrs.glareSensitive && plan.has(LIGHTING, zone.id)) r = Math.min(1, r * s.lighting_reach_factor)
  return r
}

/** Usable information channels at a zone for a persona: channel → best (enhanced) value. */
export function channels(plan: Plan, zone: Zone, p: Persona, memo = new Map<string, boolean>()): Map<string, number> {
  const here = (pl: Placement) => pl.at === zone.id || pl.at === ''
  const glare = !!p.attrs.glareSensitive && plan.has(LIGHTING, zone.id) // lighting hurts instead of helps
  const build = (skip: string) => {
    const out = new Map<string, number>()
    for (const pl of plan.placements) {
      const item = plan.items.get(pl.item)!
      if (!here(pl) || item.id === skip || !item.channel || item.infoValue <= 0 || !usable(plan, pl.item, pl.at, p, memo)) continue
      let v = item.infoValue
      for (const e of plan.placements) {
        const enh = plan.items.get(e.item)!
        if (here(e) && enh.enhances.includes(item.id) && !(glare && enh.id === LIGHTING) && usable(plan, e.item, e.at, p, memo)) v *= enh.enhanceFactor
      }
      v = Math.min(1, v)
      if (glare && (item.channel === 'visual' || item.channel === 'visual_enhanced')) v /= plan.data.scoring.lighting_reach_factor
      out.set(item.channel, Math.max(out.get(item.channel) ?? 0, v))
    }
    return out
  }
  const out = build('')
  // someone who needs magnification gets nothing from plain looking: drop exhibit_view unless large print works here
  return p.attrs.needsMagnification && !out.has('visual_enhanced') ? build(VIEW) : out
}

export function zoneScore(plan: Plan, zone: Zone, p: Persona, memo = new Map<string, boolean>()): ZoneResult {
  const s = plan.data.scoring
  const ch = channels(plan, zone, p, memo)
  const r = reach(plan, zone, p, memo)
  const info = ch.size ? Math.max(...ch.values()) : 0
  // 'visual' (plain looking at the exhibit) is a baseline, not a channel for richness or the single-channel penalty
  const n = [...ch.keys()].filter((c) => c !== 'visual').length
  const richness = Math.min(s.richness_cap, s.richness_per_extra_channel * Math.max(0, n - 1))
  let value = Math.min(1, info + richness)
  if (info > 0 && n < s.min_channels_full_value) value *= s.single_channel_penalty
  return { reach: r, info, channels: [...ch.keys()], score: r * value }
}

export function personaScore(plan: Plan, p: Persona, memo = new Map<string, boolean>()): number {
  const zs = plan.data.zones
  return zs.length ? zs.reduce((a, z) => a + zoneScore(plan, z, p, memo).score, 0) / zs.length : 0
}

export function overall(data: GameData, personaScores: Record<string, number>): number {
  const total = data.personas.reduce((a, p) => a + p.visitorShare, 0)
  return total ? data.personas.reduce((a, p) => a + p.visitorShare * (personaScores[p.id] ?? 0), 0) / total : 0
}

export function score(data: GameData, placements: Placement[], ctx?: VisitContext): ScoreResult {
  const plan = new Plan(data, placements, ctx)
  const zones: ScoreResult['zones'] = {}
  const personas: Record<string, number> = {}
  const leftOut = new Set<string>()
  for (const p of data.personas) {
    const memo = new Map<string, boolean>()
    let sum = 0
    for (const z of data.zones) {
      const r = zoneScore(plan, z, p, memo)
      ;(zones[z.id] ??= {})[p.id] = r
      if (r.score === 0) leftOut.add(p.id)
      sum += r.score
    }
    personas[p.id] = data.zones.length ? sum / data.zones.length : 0
  }
  const inactive = plan.placements
    .map((placement) => ({ placement, missing: missingRequirements(plan, placement).map((g) => g.join(' or ')) }))
    .filter((x) => x.missing.length > 0)
  return { zones, personas, overall: overall(data, personas), leftOut: [...leftOut], inactive, spent: plan.cost() }
}
