import type { GameData, Moment, Persona, Zone } from '../data/load'
import { helpsText, itemName, money, needsText, t, targetName, type Lang } from '../store'
import { bundles, candidates } from './benchmark'
import { Plan, score, usable, zoneScore, type Placement, type VisitContext } from './score'

export interface VisitEvent { key: string; text: string; zoneId?: string }

const zoneName = (z: Zone, lang: Lang) => (lang === 'fi' && z.nameFi) || z.nameEn
// Fallback when a zone has no exhibits listed; the Texts sheet has no key for it.
const unnamed = (zone: string, lang: Lang) => (lang === 'fi' ? `alueen ${zone} esineet` : `the exhibits in ${zone}`)

/** Ordered walkthrough of `placements` for one persona under today's ctx. Narrates what score() computes; adds no scoring of its own. */
export function visit(d: GameData, placements: Placement[], persona: Persona, ctx: VisitContext = {}, lang: Lang = 'en'): VisitEvent[] {
  const plan = new Plan(d, placements, ctx)
  const sc = score(d, placements, ctx)
  const memo = new Map<string, boolean>()
  const ev: VisitEvent[] = []
  const say = (key: string, vars: Record<string, string | number> = {}, zoneId?: string) => ev.push({ key, text: t(d, lang, key, vars), zoneId })
  const grants = (grant: string) => plan.placements.some((pl) => plan.items.get(pl.item)?.reachGrant === grant && usable(plan, pl.item, pl.at, persona, memo))
  const pname = (lang === 'fi' && persona.nameFi) || persona.name
  const inactive = (at: (a: string) => boolean, zoneId?: string) => {
    for (const x of sc.inactive) if (at(x.placement.at))
      say('walk_inactive', { item: itemName(lang, plan.items.get(x.placement.item)!), missing: needsText(d, lang, x.missing.map((g) => g.split(' or '))) }, zoneId)
  }

  say('walk_enter', { persona: pname })
  if (grants('plan_only')) say('walk_plan')
  let seen = 0, partial = 0 // partial: found only through the floor plan
  for (const z of d.zones) {
    const zn = zoneName(z, lang)
    const how = plan.routeComplete(z) ? 'route'
      : !persona.attrs.needsContinuousRoute && ctx.staffAvailable !== false && grants('staff_guided') ? 'staff'
      : grants('plan_only') ? 'plan' : ''
    if (!how) { say('not_reachable', {}, z.id); ev[ev.length - 1].text = `${zn}: ${ev[ev.length - 1].text}`; inactive((a) => a === z.id, z.id); continue }
    say(`walk_reach_${how}`, { zone: zn }, z.id)
    const r = zoneScore(plan, z, persona, memo)
    const chans = r.channels.filter((c) => d.texts[`ch_${c}`]).map((c) => t(d, lang, `ch_${c}`))
    if (!chans.length) say('walk_no_info', { zone: zn, exhibits: cap(z.exhibits.join(', ') || unnamed(zn, lang)) }, z.id)
    else {
      say('walk_info', { zone: zn, channels: chans.join(', ') }, z.id)
      if (r.channels.filter((c) => c !== 'visual').length < d.scoring.min_channels_full_value) say('walk_one_channel', { zone: zn }, z.id)
    }
    if (r.score > 0) { seen++; if (how === 'plan') partial++ }
    inactive((a) => a === z.id, z.id)
  }
  inactive((a) => !d.zones.some((z) => z.id === a))
  if (partial) say('walk_end_partial', { n: seen - partial, m: partial, total: d.zones.length })
  else say('walk_end', { n: seen, total: d.zones.length })
  return ev
}

// ---- stops: the visit as a sequence of moments, each with what works and what does not (phase 1 of the visual walkthrough) ----
export type StopStatus = 'full' | 'partial' | 'empty' | 'none' | 'ok' | 'mixed' | 'idle'
export interface StopFix { text: string; cost: number; items: Placement[] }
/** via = venue items (ids) this line relies on, so the scene can point back to the entrance. */
export interface StopLine { text: string; fix?: StopFix; via?: string[] }
export interface Stop {
  id: string; kind: Moment; zoneId?: string; name: string; status: StopStatus
  works: StopLine[]; fails: StopLine[]
  path: string[] // route segments walked to get here (rooms only)
  breakAt?: string // first segment of that path that does not exist yet
}

const S = {
  before: { en: 'Before the visit', fi: 'Ennen vierailua' },
  entrance: { en: 'Entrance', fi: 'Sisäänkäynti' },
  exit: { en: 'Exit', fi: 'Uloskäynti' },
  notForThem: { en: '{item} does not help this visitor (it is for: {who}).', fi: '{item} ei auta tätä kävijää (se on tarkoitettu: {who}).' },
  notToday: { en: "{item} is not available in today's conditions.", fi: '{item} ei ole käytettävissä tämän päivän olosuhteissa.' },
  waiting: { en: '{item} is waiting: nothing you placed uses it yet (it carries {needs}).', fi: '{item} odottaa: mikään sijoittamasi ei käytä sitä vielä (se tarvitsee: {needs}).' },
  fixRoute: { en: 'Continue the tactile route to here: {cost}.', fi: 'Jatka opaslinjaa tänne: {cost}.' },
  fixAdd: { en: 'Add {what} ({cost}) so this visitor can take it in.', fi: 'Lisää {what} ({cost}), niin kävijä voi kokea sen.' },
}
const sx = (lang: Lang, k: keyof typeof S, v: Record<string, string | number> = {}) =>
  S[k][lang].replace(/\{(\w+)\}/g, (m, n) => (n in v ? String(v[n]) : m))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function stops(d: GameData, placements: Placement[], persona: Persona, ctx: VisitContext = {}, lang: Lang = 'en'): Stop[] {
  const plan = new Plan(d, placements, ctx), bare = new Plan(d, placements, {}) // bare = a normal day
  const sc = score(d, placements, ctx), memo = new Map<string, boolean>()
  const events = visit(d, placements, persona, ctx, lang)
  const route = d.items.find((i) => i.scope === 'path')
  const nm = (id: string) => itemName(lang, plan.items.get(id)!)
  const key = (p: Placement) => `${p.item}@${p.at}`
  const dependents = (id: string) => d.items.filter((i) => i.requires.some((g) => g.includes(id)))
  const viaOf = (id: string) => (plan.items.get(id)?.requires.flat() ?? []).filter((r) => plan.items.get(r)?.scope === 'venue' && plan.has(r, ''))

  /** One placed item: does it work for this persona today, and if not, why. */
  const verdict = (pl: Placement): { ok: boolean; line: StopLine } => {
    const it = plan.items.get(pl.item)!, miss = sc.inactive.find((x) => key(x.placement) === key(pl))
    if (miss) return { ok: false, line: { text: t(d, lang, 'walk_inactive', { item: nm(it.id), missing: needsText(d, lang, miss.missing.map((g) => g.split(' or '))) }) } }
    if (!usable(plan, it.id, pl.at, persona, memo))
      return { ok: false, line: { text: usable(bare, it.id, pl.at, persona) ? sx(lang, 'notToday', { item: nm(it.id) }) : sx(lang, 'notForThem', { item: nm(it.id), who: helpsText(d, lang, it) }) } }
    const deps = dependents(it.id)
    if (it.scope === 'venue' && deps.length && !deps.some((i) => plan.placements.some((p) => p.item === i.id)))
      return { ok: false, line: { text: sx(lang, 'waiting', { item: nm(it.id), needs: deps.slice(0, 2).map((i) => itemName(lang, i)).join(', ') }) } }
    return { ok: true, line: { text: nm(it.id), via: viaOf(it.id) } }
  }

  const out: Stop[] = []
  for (const m of ['before', 'entrance'] as const) {
    const here = plan.placements.filter((p) => plan.items.get(p.item)?.moment === m && p.at === '')
    if (here.length) out.push(venueStop(m, here))
  }
  function venueStop(m: Moment & ('before' | 'entrance' | 'exit'), here: Placement[]): Stop {
    const r = here.map(verdict), works = r.filter((x) => x.ok).map((x) => x.line), fails = r.filter((x) => !x.ok).map((x) => x.line)
    return { id: m, kind: m, name: sx(lang, m), status: !fails.length ? 'ok' : works.length ? 'mixed' : 'idle', works, fails, path: [] }
  }

  d.zones.forEach((z) => {
    const keys = events.filter((e) => e.zoneId === z.id).map((e) => e.key)
    const noInfo = keys.includes('walk_no_info') // reach decides the status; "nothing to use" is added on top
    const status: StopStatus = keys.includes('not_reachable') ? 'none' : keys.includes('walk_reach_plan') ? 'partial' : noInfo ? 'empty' : 'full'
    const path = plan.chain(z.routeSegment), breakAt = path.find((s) => !plan.segmentExists(s))
    const r = zoneScore(plan, z, persona, memo)
    const mine = plan.placements.filter((p) => p.at === z.id && plan.items.get(p.item)?.moment === 'room')
    const verdicts = mine.map((p) => ({ p, v: verdict(p) }))
    const works: StopLine[] = r.channels.filter((c) => d.texts[`ch_${c}`]).map((c) => ({
      text: cap(t(d, lang, `ch_${c}`)),
      via: [...new Set(verdicts.filter((x) => x.v.ok && plan.items.get(x.p.item)?.channel === c).flatMap((x) => x.v.line.via ?? []))],
    }))
    const fails: StopLine[] = []
    const missing = path.filter((s) => !plan.segmentExists(s))
    const routeFix: StopFix | undefined = route && missing.length
      ? { text: sx(lang, 'fixRoute', { cost: money(lang, missing.length * route.costEur) }), cost: missing.length * route.costEur, items: missing.map((s) => ({ item: route.id, at: s })) } : undefined
    const zn = targetName(d, lang, z.id)
    if (status === 'none') fails.push({ text: `${zn}: ${t(d, lang, 'not_reachable')}`, fix: routeFix })
    else if (status === 'partial') fails.push({ text: t(d, lang, 'walk_reach_plan', { zone: zn }), fix: routeFix })
    if (noInfo) {
      const cur = r.score, base = plan.cost()
      let best: { add: Placement[]; cost: number; ratio: number } | null = null
      for (const c of candidates(d).filter((c) => c.at === z.id || c.at === ''))
        for (const add of bundles(plan, c)) {
          if (!add.length) continue
          const next = new Plan(d, [...placements, ...add], ctx), cost = next.cost() - base
          const gain = zoneScore(next, z, persona).score - cur
          if (cost > 0 && gain > 1e-9 && (!best || gain / cost > best.ratio)) best = { add, cost, ratio: gain / cost }
        }
      fails.push({
        text: t(d, lang, 'walk_no_info', { zone: zn, exhibits: cap(z.exhibits.join(', ') || unnamed(zn, lang)) }),
        fix: best ? { text: sx(lang, 'fixAdd', { what: [...new Set(best.add.map((p) => p.item))].map(nm).join(' + '), cost: money(lang, best.cost) }), cost: best.cost, items: best.add } : undefined,
      })
    }
    for (const x of verdicts) if (!x.v.ok) fails.push(x.v.line)
    if (status === 'full' && r.channels.filter((c) => c !== 'visual').length < d.scoring.min_channels_full_value) fails.push({ text: t(d, lang, 'walk_one_channel', { zone: zn }) })
    out.push({ id: z.id, kind: 'room', zoneId: z.id, name: `${zn}`, status, works: status === 'full' || status === 'partial' ? works : [], fails, path, breakAt })
  })

  const exitHere = plan.placements.filter((p) => plan.items.get(p.item)?.moment === 'exit' && p.at === '')
  if (exitHere.length) out.push(venueStop('exit', exitHere))
  return out
}
