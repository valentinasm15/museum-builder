import type { GameData, Item, Moment, Persona, Zone } from '../data/load'
import { helpsText, itemName, money, needsText, t, targetName, type Lang } from '../store'
import { bundles, candidates } from './benchmark'
import { Plan, score, usable, zoneScore, type Placement, type VisitContext } from './score'

const SCREEN = 'video_screen' // the item that puts a screen in a room (Items sheet)
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

  const note = venueNoter({ d, plan, bare: new Plan(d, placements, {}), sc, persona, ctx, lang, memo })
  const tell = (m: Moment) => { // whole-museum items met at this moment of the visit (existing ones too)
    for (const pl of plan.placements) if (pl.at === '' && plan.items.get(pl.item)?.scope === 'venue' && plan.items.get(pl.item)?.moment === m) { const n = note(pl); ev.push({ key: n.key, text: n.text }) }
  }
  say('walk_enter', { persona: pname })
  tell('before'); tell('entrance')
  let seen = 0, partial = 0 // partial: found only through the floor plan
  for (const z of d.zones) {
    const zn = zoneName(z, lang)
    const how = plan.routeComplete(z) ? 'route'
      : !persona.attrs.needsContinuousRoute && ctx.staffAvailable !== false && grants('staff_guided') ? 'staff'
      : grants('plan_only') ? 'plan' : ''
    if (!how) { say('not_reachable', {}, z.id); ev[ev.length - 1].text = `${zn}: ${ev[ev.length - 1].text}`; inactive((a) => a === z.id, z.id); continue }
    say(how === 'plan' && persona.attrs.needsContinuousRoute ? 'walk_reach_plan_need' : `walk_reach_${how}`, { zone: zn }, z.id)
    const r = zoneScore(plan, z, persona, memo)
    const chans = r.channels.filter((c) => d.texts[`ch_${c}`]).map((c) => t(d, lang, `ch_${c}`))
    if (!chans.length) say('walk_no_info', { zone: zn, exhibits: cap(z.exhibits.join(', ') || unnamed(zn, lang)) }, z.id)
    else {
      say('walk_info', { zone: zn, channels: chans.join(', ') }, z.id)
      if (r.channels.filter((c) => c !== 'visual').length < d.scoring.min_channels_full_value) say('walk_one_channel', { zone: zn }, z.id)
    }
    if (r.score > 0) { seen++; if (how === 'plan') partial++ }
    for (const pl of plan.placements.filter((x) => x.at === z.id)) { // what makes room content work (or fail) through a whole-museum item
      const it = plan.items.get(pl.item)!, what = itemName(lang, it), via = new Set<string>()
      if (it.channel && it.infoValue > 0 && usable(plan, it.id, z.id, persona, memo))
        for (const v of it.requires.flat()) if (plan.items.get(v)?.scope === 'venue' && plan.has(v, '') && usable(plan, v, '', persona, memo) && !via.has(v)) { via.add(v); say('walk_v_via', { what, item: itemName(lang, plan.items.get(v)!) }, z.id) }
      const blocked = venueBlockers(plan, it, z.id, persona, memo)
      if (blocked.length) say('walk_v_via_fail', { what, item: blocked.map((v) => itemName(lang, plan.items.get(v)!)).join(', ') }, z.id)
    }
    inactive((a) => a === z.id, z.id)
  }
  inactive((a) => a !== '' && !d.zones.some((z) => z.id === a)) // route segments; whole-museum items were narrated at their moment
  tell('exit')
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
  notes: string[] // plain lines about the whole visit (the final stop)
  breakAt?: string // first segment of that path that does not exist yet
}

const S = {
  before: { en: 'Before the visit', fi: 'Ennen vierailua' },
  entrance: { en: 'Entrance', fi: 'Sisäänkäynti' },
  exit: { en: 'Exit', fi: 'Uloskäynti' },
  notForThem: { en: '{item} does not help this visitor (it is for: {who}).', fi: '{item} ei auta tätä kävijää (se on tarkoitettu: {who}).' },
  notToday: { en: "{item} is not available in today's conditions.", fi: '{item} ei ole käytettävissä tämän päivän olosuhteissa.' },
  waiting: { en: '{item} is waiting: nothing you placed uses it yet (it carries {needs}).', fi: '{item} odottaa: mikään sijoittamasi ei käytä sitä vielä (se tarvitsee: {needs}).' },
  fixRoute: { en: 'A tactile route to here ({cost}): easier to navigate, more independent.', fi: 'Opaslinja tänne ({cost}): helpompi liikkua, enemmän itsenäisyyttä.' },
  museum: { en: 'Whole museum', fi: 'Koko museo' },
  gapOne: { en: '{name} found something to experience in only {k} of {n} rooms.', fi: '{name} löysi koettavaa vain {k}/{n} huoneesta.' },
  gapMany: { en: '{c} visitor types found nothing to experience in any room.', fi: '{c} kävijätyyppiä ei löytänyt koettavaa yhdestäkään huoneesta.' },
  oneWay: { en: 'In {k} of {n} rooms there is only one way to take in the exhibits.', fi: '{k}/{n} huoneessa näyttelyn voi kokea vain yhdellä tavalla.' },
  film: { en: 'A film plays on this screen, but this visitor cannot follow it yet.', fi: 'Tällä näytöllä pyörii elokuva, mutta tämä kävijä ei voi vielä seurata sitä.' },
  fixFilm: { en: 'Add {what} ({cost}) so they can follow the film.', fi: 'Lisää {what} ({cost}), niin kävijä voi seurata elokuvaa.' },
  fixAdd: { en: 'Add {what} ({cost}) so this visitor can take it in.', fi: 'Lisää {what} ({cost}), niin kävijä voi kokea sen.' },
}
const sx = (lang: Lang, k: keyof typeof S, v: Record<string, string | number> = {}) =>
  S[k][lang].replace(/\{(\w+)\}/g, (m, n) => (n in v ? String(v[n]) : m))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A placed whole-museum item as the visitor meets it today: ok = works for them, wait = carries nothing used yet, missing = requirement unmet, no = not for them / not today. */
interface VenueNote { state: 'ok' | 'wait' | 'missing' | 'no'; key: string; text: string }
interface NoteEnv { d: GameData; plan: Plan; bare: Plan; sc: ReturnType<typeof score>; persona: Persona; ctx: VisitContext; lang: Lang; memo: Map<string, boolean> }
function venueNoter({ d, plan, bare, sc, persona, ctx, lang, memo }: NoteEnv) {
  const nm = (id: string) => itemName(lang, plan.items.get(id)!)
  return (pl: Placement): VenueNote => {
    const it = plan.items.get(pl.item)!, item = nm(it.id)
    const miss = sc.inactive.find((x) => x.placement.item === pl.item && x.placement.at === pl.at)
    if (miss) return { state: 'missing', key: 'walk_inactive', text: t(d, lang, 'walk_inactive', { item, missing: needsText(d, lang, miss.missing.map((g) => g.split(' or '))) }) }
    if (!usable(plan, it.id, '', persona, memo))
      return { state: 'no', key: 'walk_venue_no', text: sx(lang, usable(bare, it.id, '', persona) ? 'notToday' : 'notForThem', { item, who: helpsText(d, lang, it) }) }
    const ok = (key: string, vars: Record<string, string | number> = {}): VenueNote => ({ state: 'ok', key, text: t(d, lang, key, { item, ...vars }) })
    if (it.reachGrant === 'plan_only') return ok('walk_plan')
    if (it.reachGrant === 'staff_guided') {
      const k = ctx.staffAvailable === false ? 'walk_v_staff_no' : persona.attrs.needsContinuousRoute ? 'walk_v_staff_cont' : 'walk_v_staff'
      return { ...ok(k), state: k === 'walk_v_staff' ? 'ok' : 'no' }
    }
    const deps = d.items.filter((i) => i.requires.some((g) => g.includes(it.id)))
    if (deps.length && it.infoValue <= 0) { // carries other items (devices, Wi-Fi): only worth something through them
      const placed = deps.filter((i) => plan.placements.some((p) => p.item === i.id))
      if (!placed.length) return { state: 'wait', key: 'walk_venue_waiting', text: sx(lang, 'waiting', { item, needs: deps.slice(0, 2).map((i) => itemName(lang, i)).join(', ') }) }
      const used = placed.filter((i) => plan.placements.some((p) => p.item === i.id && usable(plan, i.id, p.at, persona, memo)))
      return used.length ? ok('walk_v_carrier', { what: used.map((i) => itemName(lang, i)).join(', ') }) : { ...ok('walk_v_unused'), state: 'wait' }
    }
    if (it.infoValue > 0 && it.channel) return ok('walk_v_info', { channel: d.texts[`ch_${it.channel}`] ? t(d, lang, `ch_${it.channel}`) : it.channel })
    return ok('walk_v_unscored')
  }
}
/** Venue items a room item relies on that this visitor cannot use today, when that (and nothing else) is why the room item fails for them. */
function venueBlockers(plan: Plan, it: Item, at: string, persona: Persona, memo: Map<string, boolean>): string[] {
  if (!(it.reach === 'all' || persona.attrs[it.reach] === true)) return []
  if (!usable(plan, it.id, at, null, memo) || usable(plan, it.id, at, persona, memo)) return []
  return [...new Set(it.requires.flat())].filter((r) => plan.items.get(r)?.scope === 'venue' && plan.has(r, '') && !usable(plan, r, '', persona, memo))
}

export function stops(d: GameData, placements: Placement[], persona: Persona, ctx: VisitContext = {}, lang: Lang = 'en'): Stop[] {
  const plan = new Plan(d, placements, ctx), bare = new Plan(d, placements, {}) // bare = a normal day
  const sc = score(d, placements, ctx), memo = new Map<string, boolean>()
  const events = visit(d, placements, persona, ctx, lang)
  const route = d.items.find((i) => i.scope === 'path')
  const nm = (id: string) => itemName(lang, plan.items.get(id)!)
  const key = (p: Placement) => `${p.item}@${p.at}`
  const viaOf = (id: string) => (plan.items.get(id)?.requires.flat() ?? []).filter((r) => plan.items.get(r)?.scope === 'venue' && plan.has(r, ''))

  const note = venueNoter({ d, plan, bare, sc, persona, ctx, lang, memo })
  /** One placed item: does it work for this persona today, and if not, why. */
  const verdict = (pl: Placement): { ok: boolean; line: StopLine } => {
    const it = plan.items.get(pl.item)!, miss = sc.inactive.find((x) => key(x.placement) === key(pl))
    if (it.scope === 'venue') { const n = note(pl); return { ok: n.state === 'ok', line: n.state === 'ok' ? { text: n.text, via: viaOf(it.id) } : { text: n.text } } }
    const blocked = venueBlockers(plan, it, pl.at, persona, memo)
    if (!miss && blocked.length) return { ok: false, line: { text: t(d, lang, 'walk_v_via_fail', { what: nm(it.id), item: blocked.map(nm).join(', ') }) } }
    if (miss && miss.missing.every((g) => g === 'route')) return { ok: false, line: { text: t(d, lang, 'walk_inactive_route', { item: nm(it.id) }) } }
    if (miss) return { ok: false, line: { text: t(d, lang, 'walk_inactive', { item: nm(it.id), missing: needsText(d, lang, miss.missing.map((g) => g.split(' or '))) }) } }
    if (!usable(plan, it.id, pl.at, persona, memo))
      return { ok: false, line: { text: usable(bare, it.id, pl.at, persona) ? sx(lang, 'notToday', { item: nm(it.id) }) : sx(lang, 'notForThem', { item: nm(it.id), who: helpsText(d, lang, it) }) } }
    return { ok: true, line: { text: nm(it.id), via: viaOf(it.id) } }
  }

  const out: Stop[] = []
  for (const m of ['before', 'entrance'] as const) {
    const here = plan.placements.filter((p) => plan.items.get(p.item)?.moment === m && p.at === '')
    if (here.length) out.push(venueStop(m, here))
  }
  function venueStop(m: Moment & ('before' | 'entrance' | 'exit'), here: Placement[]): Stop {
    const r = here.map(verdict), works = r.filter((x) => x.ok).map((x) => x.line), fails = r.filter((x) => !x.ok).map((x) => x.line)
    return { id: m, kind: m, name: sx(lang, m), status: !fails.length ? 'ok' : works.length ? 'mixed' : 'idle', works, fails, path: [], notes: [] }
  }

  let oneWay = 0
  d.zones.forEach((z) => {
    const keys = events.filter((e) => e.zoneId === z.id).map((e) => e.key)
    const noInfo = keys.includes('walk_no_info') // reach decides the status; "nothing to use" is added on top
    const status: StopStatus = keys.includes('not_reachable') ? 'none' : keys.some((k) => k.startsWith('walk_reach_plan')) ? 'partial' : noInfo ? 'empty' : 'full'
    const path = plan.chain(z.routeSegment), breakAt = path.find((s) => !plan.segmentExists(s))
    const r = zoneScore(plan, z, persona, memo)
    const mine = plan.placements.filter((p) => p.at === z.id && plan.items.get(p.item)?.moment === 'room')
    const verdicts = mine.map((p) => ({ p, v: verdict(p) }))
    const works: StopLine[] = r.channels.filter((c) => d.texts[`ch_${c}`]).map((c) => ({
      text: cap(t(d, lang, `ch_${c}`)),
      via: [...new Set(verdicts.filter((x) => x.v.ok && plan.items.get(x.p.item)?.channel === c).flatMap((x) => x.v.line.via ?? []))],
    }))
    const grantors = (g: string) => plan.placements.filter((p) => plan.items.get(p.item)?.reachGrant === g && usable(plan, p.item, p.at, persona, memo)).map((p) => p.item)
    const getsHere: StopLine[] = [ // how the visitor got here, and the whole-museum item behind it; shown even when the room itself has nothing to use
      ...(keys.includes('walk_reach_staff') ? [{ text: t(d, lang, 'walk_room_staff'), via: grantors('staff_guided') }] : []),
      ...(keys.includes('walk_reach_plan') ? [{ text: t(d, lang, 'walk_room_plan'), via: grantors('plan_only') }] : []),
    ]
    const fails: StopLine[] = []
    const missing = path.filter((s) => !plan.segmentExists(s))
    const routeFix: StopFix | undefined = route && missing.length
      ? { text: sx(lang, 'fixRoute', { cost: money(lang, missing.length * route.costEur) }), cost: missing.length * route.costEur, items: missing.map((s) => ({ item: route.id, at: s })) } : undefined
    const zn = targetName(d, lang, z.id)
    if (status === 'none') fails.push({ text: `${zn}: ${t(d, lang, 'not_reachable')}`, fix: routeFix })
    else if (status === 'partial') fails.push({ text: t(d, lang, persona.attrs.needsContinuousRoute ? 'walk_reach_plan_need' : 'walk_reach_plan', { zone: zn }), fix: routeFix })
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
    // A screen is only usable once something makes its film followable (description, captions, transcript); say so, and what is cheapest for this visitor.
    if (status !== 'none' && plan.has(SCREEN, z.id)) {
      const makers = d.items.filter((i) => i.infoValue > 0 && i.requires.some((g) => g.includes(SCREEN)))
      if (!plan.placements.some((p) => p.at === z.id && makers.some((m) => m.id === p.item) && usable(plan, p.item, p.at, persona, memo))) {
        let cheapest: { add: Placement[]; cost: number } | null = null
        for (const m of makers.filter((m) => m.reach === 'all' || persona.attrs[m.reach] === true))
          for (const add of bundles(plan, { item: m.id, at: z.id })) {
            const cost = add.length ? new Plan(d, [...placements, ...add], ctx).cost() - plan.cost() : 0
            if (add.length && (!cheapest || cost < cheapest.cost)) cheapest = { add, cost }
          }
        fails.push({ text: sx(lang, 'film'), fix: cheapest ? { text: sx(lang, 'fixFilm', { what: [...new Set(cheapest.add.map((p) => p.item))].map(nm).join(' + '), cost: money(lang, cheapest.cost) }), cost: cheapest.cost, items: cheapest.add } : undefined })
      }
    }
    for (const x of verdicts) if (!x.v.ok) fails.push(x.v.line)
    if (status === 'full' && r.channels.filter((c) => c !== 'visual').length < d.scoring.min_channels_full_value) { oneWay++; fails.push({ text: t(d, lang, 'walk_one_channel', { zone: zn }) }) }
    out.push({ id: z.id, kind: 'room', zoneId: z.id, name: `${zn}`, status, works: [...getsHere, ...(status === 'full' || status === 'partial' ? works : [])], fails, path, breakAt, notes: [] })
  })

  // The last stop is always there: the whole museum, with exit items (take-away catalogues) and a few lines about the visit as a whole.
  const exitHere = plan.placements.filter((p) => plan.items.get(p.item)?.moment === 'exit' && p.at === '')
  const end: Stop = exitHere.length ? venueStop('exit', exitHere) : { id: 'exit', kind: 'exit', name: '', status: 'ok', works: [], fails: [], path: [], notes: [] }
  end.name = sx(lang, 'museum')
  end.notes = [events[events.length - 1].text, museumGap(d, placements, lang), oneWay ? sx(lang, 'oneWay', { k: oneWay, n: d.zones.length }) : ''].filter(Boolean)
  out.push(end)
  return out
}

/** Across all visitor types on a normal day: who found something to experience in the fewest rooms (empty when everyone found something everywhere). */
export function museumGap(d: GameData, placements: Placement[], lang: Lang = 'en'): string {
  const std = score(d, placements)
  const rooms = d.personas.map((p) => ({ name: (lang === 'fi' && p.nameFi) || p.name, k: d.zones.filter((z) => std.zones[z.id][p.id].score > 0).length }))
  const zero = rooms.filter((r) => r.k === 0), weakest = [...rooms].sort((a, b) => a.k - b.k)[0]
  return zero.length > 1 ? sx(lang, 'gapMany', { c: zero.length }) : weakest && weakest.k < d.zones.length ? sx(lang, 'gapOne', { name: weakest.name, k: weakest.k, n: d.zones.length }) : ''
}
