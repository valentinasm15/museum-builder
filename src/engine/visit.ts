import type { GameData, Persona, Zone } from '../data/load'
import { itemName, needsText, t, type Lang } from '../store'
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
  let seen = 0
  for (const z of d.zones) {
    const zn = zoneName(z, lang)
    const how = plan.routeComplete(z) ? 'route'
      : !persona.attrs.needsContinuousRoute && ctx.staffAvailable !== false && grants('staff_guided') ? 'staff'
      : grants('plan_only') ? 'plan' : ''
    if (!how) { say('not_reachable', {}, z.id); ev[ev.length - 1].text = `${zn}: ${ev[ev.length - 1].text}`; inactive((a) => a === z.id, z.id); continue }
    say(`walk_reach_${how}`, { zone: zn }, z.id)
    const r = zoneScore(plan, z, persona, memo)
    const chans = r.channels.filter((c) => d.texts[`ch_${c}`]).map((c) => t(d, lang, `ch_${c}`))
    if (!chans.length) say('walk_no_info', { zone: zn, exhibits: z.exhibits.join(', ') || unnamed(zn, lang) }, z.id)
    else {
      say('walk_info', { zone: zn, channels: chans.join(', ') }, z.id)
      if (r.channels.filter((c) => c !== 'visual').length < d.scoring.min_channels_full_value) say('walk_one_channel', { zone: zn }, z.id)
    }
    if (r.score > 0) seen++
    inactive((a) => a === z.id, z.id)
  }
  inactive((a) => !d.zones.some((z) => z.id === a))
  say('walk_end', { n: seen, total: d.zones.length })
  return ev
}
