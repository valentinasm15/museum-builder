import type { GameData } from '../data/load'
import { Plan, score, type Placement } from './score'

const MAX_DEPTH = 3
const MAX_OPTIONS = 40
const EPS = 1e-9

const dedupe = (ps: Placement[]) => [...new Map(ps.map((p) => [`${p.item}@${p.at}`, p])).values()]
const product = (a: Placement[][], b: Placement[][]) => a.flatMap((x) => b.map((y) => [...x, ...y])).slice(0, MAX_OPTIONS)

/** Alternative bundles: the placement plus its unmet requirements (one option per '|' choice). */
export function bundles(plan: Plan, p: Placement, depth = 0): Placement[][] {
  if (plan.has(p.item, p.at)) return [[]]
  const item = plan.items.get(p.item)
  if (!item || depth > MAX_DEPTH) return []
  const path = plan.data.items.find((i) => i.scope === 'path')
  const routeTo = (seg: string) => plan.chain(seg).filter((s) => !plan.segmentExists(s)).map((s) => ({ item: path!.id, at: s }))
  if (item.scope === 'path') return [dedupe([...routeTo(p.at), p])]
  const zone = plan.data.zones.find((z) => z.id === p.at)
  let opts: Placement[][] = [[p]]
  for (const group of item.requires) {
    const groupOpts: Placement[][] = []
    for (const t of group) {
      if (t === 'route') { if (zone && path) groupOpts.push(routeTo(zone.routeSegment)); continue }
      if (t === 'has_screen') { if (zone?.hasScreen) groupOpts.push([]); continue }
      const target = plan.items.get(t)
      if (!target) continue
      const ats = target.scope === 'venue' ? [''] : zone ? [zone.id] : plan.data.zones.map((z) => z.id)
      for (const at of ats) groupOpts.push(...bundles(plan, { item: t, at }, depth + 1))
    }
    if (!groupOpts.length) return []
    opts = product(opts, groupOpts)
  }
  return opts.map(dedupe)
}

export function candidates(data: GameData): Placement[] {
  return data.items.flatMap((i) =>
    i.scope === 'venue' ? [{ item: i.id, at: '' }]
      : i.scope === 'zone' ? data.zones.map((z) => ({ item: i.id, at: z.id }))
      : data.route.filter((s) => !s.existing).map((s) => ({ item: i.id, at: s.id })))
}

/** Greedy benchmark plan: repeatedly add the bundle with the best access gain per € until the budget is spent. */
export function benchmark(data: GameData, budget: number) {
  let placements: Placement[] = []
  let current = score(data, placements)
  for (;;) {
    const plan = new Plan(data, placements)
    const baseCost = plan.cost()
    let best: { add: Placement[]; ratio: number; gain: number } | null = null
    for (const c of candidates(data)) {
      for (const add of bundles(plan, c)) {
        if (!add.length) continue
        const next = [...placements, ...add]
        const cost = new Plan(data, next).cost() - baseCost
        if (cost <= 0 || baseCost + cost > budget) continue
        const gain = score(data, next).overall - current.overall
        if (gain <= EPS) continue
        const ratio = gain / cost
        if (!best || ratio > best.ratio + EPS || (Math.abs(ratio - best.ratio) <= EPS && gain > best.gain)) best = { add, ratio, gain }
      }
    }
    if (!best) break
    placements = dedupe([...placements, ...best.add])
    current = score(data, placements)
  }
  return { placements, result: current }
}

/** Money efficiency = player's access ÷ benchmark access at the same spend. */
export function moneyEfficiency(data: GameData, placements: Placement[]) {
  const player = score(data, placements)
  const bench = benchmark(data, player.spent)
  const efficiency = bench.result.overall > 0 ? player.overall / bench.result.overall : player.overall > 0 ? 1 : 0
  return { player, benchmark: bench, efficiency }
}

/** Drop in access (and personas that lose access) if one placement is removed, everything else kept. */
export function marginalContributions(data: GameData, placements: Placement[]) {
  const base = score(data, placements)
  const items = new Map(data.items.map((i) => [i.id, i]))
  return dedupe(placements).map((p) => {
    const without = score(data, placements.filter((q) => q.item !== p.item || q.at !== p.at))
    const helped = data.personas.filter((per) => base.personas[per.id] - without.personas[per.id] > EPS).map((per) => per.id)
    return { placement: p, cost: base.spent - without.spent, delta: base.overall - without.overall, helped, cost_eur: items.get(p.item)?.costEur ?? 0 }
  })
}
