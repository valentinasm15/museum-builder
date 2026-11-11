import type { GameData, Persona } from '../data/load'
import { itemName, money, t, targetName, visitCtx, visitNames, type Lang, type Visit } from '../store'
import { marginalContributions, type moneyEfficiency } from './benchmark'
import { Plan, score, type Placement } from './score'
import { visit as walk } from './visit'

export type Band = 'partial' | 'good' | 'strong'
/** Band edges come from the Scoring sheet (band_good, band_strong) when present; the defaults are an assumption to validate. */
export const band = (d: GameData, v: number): Band =>
  v >= (d.scoring.band_strong ?? 0.7) ? 'strong' : v >= (d.scoring.band_good ?? 0.4) ? 'good' : 'partial'
export const bandText = (d: GameData, lang: Lang, b: Band) => t(d, lang, `deb_band_${b}`)

const SIDE = new Set(['comfort', 'enabler', 'undecided']) // Item.kind values listed apart, not part of the access score
const nameOf = (p: Persona, lang: Lang) => (lang === 'fi' && p.nameFi) || p.name

// Short labels the Texts sheet has no key for yet (move to Texts when convenient).
const LOCAL = {
  nobody: { en: 'Nobody', fi: 'Ei kukaan' },
  full: { en: 'Benchmark plan (full budget)', fi: 'Vertailusuunnitelma (koko budjetti)' },
  trade: { en: 'Trade-offs in your plan', fi: 'Suunnitelmasi valinnat' },
  none: { en: 'None', fi: 'Ei yhtään' },
  dims: { en: 'Six dimensions', fi: 'Kuusi ulottuvuutta' },
  richHint: { en: 'Share of zone visits with two or more non-visual ways to take in the exhibit.', fi: 'Osuus alueiden vierailuista, joissa näyttelyn voi kokea vähintään kahdella ei-visuaalisella tavalla.' },
  bench: { en: 'benchmark', fi: 'vertailu' },
  you: { en: 'you', fi: 'sinä' },
}
export const local = (lang: Lang, k: keyof typeof LOCAL) => LOCAL[k][lang]

/** Weighted (visitorShare) mean of f over personas, each persona's value being the mean over zones. */
function weighted(d: GameData, f: (p: Persona, zoneId: string) => number) {
  const total = d.personas.reduce((a, p) => a + p.visitorShare, 0)
  if (!total || !d.zones.length) return 0
  return d.personas.reduce((a, p) => a + p.visitorShare * (d.zones.reduce((s, z) => s + f(p, z.id), 0) / d.zones.length), 0) / total
}

/** 0–5 templated sentences about the plan's real trade-offs, with real item costs. Engine output and sheet data only. */
export function tradeoffs(d: GameData, lang: Lang, placements: Placement[], v: Visit): string[] {
  const plan = new Plan(d, placements, visitCtx(d, v))
  const has = (id: string) => plan.placements.some((p) => p.item === id)
  const placed = (id: string) => placements.some((p) => p.item === id)
  const item = (id: string) => d.items.find((i) => i.id === id)
  const c = (id: string) => item(id)?.costEur ?? 0
  const m = (n: number) => money(lang, n)
  const nm = (id: string) => (item(id) ? itemName(lang, item(id)!) : id)
  const n = (f: (p: Persona) => boolean) => d.personas.filter(f).length
  const total = d.personas.length
  const tx = (en: string, fi: string) => (lang === 'fi' ? fi : en)
  const out: string[] = []

  if (plan.ctx.staffAvailable === false && (placed('staff_training') || placed('guided_touch_tour'))) {
    const sum = ['staff_training', 'guided_touch_tour'].filter(placed).reduce((a, id) => a + c(id), 0)
    out.push(tx(`${m(sum)} went on ${nm('staff_training')} and ${nm('guided_touch_tour')}, which need staff on duty; today nobody is, so it did not help this visitor.`,
      `${m(sum)} meni kohteisiin ${nm('staff_training')} ja ${nm('guided_touch_tour')}, jotka vaativat henkilökuntaa; tänään sitä ei ole, joten se ei auttanut tätä kävijää.`))
  }
  const sp = n((p) => !!p.attrs.usesSmartphone)
  if (has('audio_guide_devices') && !has('smartphone_audio'))
    out.push(tx(`${nm('audio_guide_devices')} (${m(c('audio_guide_devices'))}) work for everyone but only on days the museum can lend them; ${nm('smartphone_audio')} would cost ${m(c('smartphone_audio'))} and reaches only ${sp} of ${total} visitor types.`,
      `${nm('audio_guide_devices')} (${m(c('audio_guide_devices'))}) palvelevat kaikkia, mutta vain päivinä, jolloin museo voi lainata niitä; ${nm('smartphone_audio')} maksaisi ${m(c('smartphone_audio'))} ja tavoittaa vain ${sp}/${total} kävijätyyppiä.`))
  else if (has('smartphone_audio') && !has('audio_guide_devices'))
    out.push(tx(`${nm('smartphone_audio')} (${m(c('smartphone_audio'))}) reaches only ${sp} of ${total} visitor types; ${nm('audio_guide_devices')} cost ${m(c('audio_guide_devices'))} and reach everyone.`,
      `${nm('smartphone_audio')} (${m(c('smartphone_audio'))}) tavoittaa vain ${sp}/${total} kävijätyyppiä; ${nm('audio_guide_devices')} maksaisivat ${m(c('audio_guide_devices'))} ja tavoittaisivat kaikki.`))
  if (placed('braille_catalogue')) {
    const br = n((p) => !!p.attrs.readsBraille)
    out.push(tx(`${nm('braille_catalogue')} cost ${m(c('braille_catalogue'))} and helps ${br} of ${total} visitor types; ${nm('audio_description')} costs ${m(c('audio_description'))} per zone and does not depend on braille.`,
      `${nm('braille_catalogue')} maksoi ${m(c('braille_catalogue'))} ja auttaa ${br}/${total} kävijätyyppiä; ${nm('audio_description')} maksaa ${m(c('audio_description'))} aluetta kohti eikä vaadi pistekirjoituksen lukutaitoa.`))
  }
  if (placed('tactile_replica')) {
    const r = item('tactile_replica')!.reach // who the sheet says it is for; no hard-coded attribute
    const ok = r === 'all' ? total : n((p) => !!p.attrs[r])
    if (ok < total) out.push(tx(`${nm('tactile_replica')} cost ${m(c('tactile_replica'))} and works for only ${ok} of ${total} visitor types.`,
      `${nm('tactile_replica')} maksoi ${m(c('tactile_replica'))} ja toimii vain ${ok}/${total} kävijätyypille.`))
  }
  if (placed('lighting')) {
    const glare = n((p) => !!p.attrs.glareSensitive)
    const segs = d.route.filter((s) => !s.existing), cost = segs.length * c('tactile_route')
    const span = segs.length ? `${segs[0].id}–${segs[segs.length - 1].id}` : ''
    out.push(tx(`${nm('lighting')} cost ${m(c('lighting'))}; it helps visitors with some sight but not the ${glare} of ${total} types who are glare-sensitive. Extending the route over ${span} would cost ${m(cost)}.`,
      `${nm('lighting')} maksoi ${m(c('lighting'))}; se auttaa näkevämpiä mutta ei ${glare}/${total} häikäisylle herkkää tyyppiä. Reitin jatkaminen osuuksille ${span} maksaisi ${m(cost)}.`))
  }
  if (placed('robot_guide')) {
    const share = Math.round((c('robot_guide') / (d.settings.budget_eur || 1)) * 100)
    out.push(tx(`${nm('robot_guide')} cost ${m(c('robot_guide'))}, ${share}% of the budget.`, `${nm('robot_guide')} maksoi ${m(c('robot_guide'))}, eli ${share} % budjetista.`))
  }
  return out.slice(0, 5)
}

/** Everything the debrief shows except money efficiency (that needs the slow benchmark; see `efficiency`). */
export function debrief(d: GameData, placements: Placement[], v: Visit, lang: Lang) {
  const std = score(d, placements) // standard day, all personas, visitorShare-weighted
  const ctx = visitCtx(d, v)
  const day = score(d, placements, ctx)
  const persona = d.personas.find((p) => p.id === v.personaId) ?? d.personas[0]
  const events = walk(d, placements, persona, ctx, lang)
  const names = visitNames(d, lang, v)
  const min = d.scoring.min_channels_full_value
  const zr = (p: Persona, z: string) => std.zones[z][p.id]
  const items = d.items.reduce((m, i) => m.set(i.id, i), new Map<string, (typeof d.items)[number]>())
  const marg = marginalContributions(d, placements)
  const label = (pl: Placement) => `${itemName(lang, items.get(pl.item)!)} (${targetName(d, lang, pl.at)})`
  const single = (pl: Placement) => new Plan(d, [pl]).cost()
  const inactiveTotal = std.inactive.filter((x) => placements.some((p) => p.item === x.placement.item && p.at === x.placement.at)).reduce((a, x) => a + single(x.placement), 0)
  return {
    band: band(d, std.overall),
    focal: { persona: names.persona, situation: names.situation, band: band(d, day.personas[persona.id] ?? 0),
      skipped: events.filter((e) => e.key === 'not_reachable').map((e) => e.text), end: events[events.length - 1].text },
    others: d.personas.map((p) => ({ id: p.id, name: nameOf(p, lang), share: p.visitorShare, band: band(d, std.personas[p.id]) })),
    dims: {
      reach: band(d, weighted(d, (p, z) => zr(p, z).reach)),
      info: band(d, weighted(d, (p, z) => zr(p, z).info)),
      richness: band(d, weighted(d, (p, z) => (zr(p, z).channels.filter((c) => c !== 'visual').length >= min ? 1 : 0))),
    },
    leftOut: d.personas.filter((p) => std.leftOut.includes(p.id)).map((p) => nameOf(p, lang)),
    inactiveTotal,
    values: marg.filter((x) => !SIDE.has(items.get(x.placement.item)?.kind ?? '')).sort((a, b) => b.delta - a.delta).map((x) =>
      t(d, lang, 'deb_item_value', { item: label(x.placement), cost: money(lang, x.cost), n: x.helped.length, total: d.personas.length, points: Math.round(x.delta * 100) })),
    side: marg.filter((x) => SIDE.has(items.get(x.placement.item)?.kind ?? '')).map((x) => `${label(x.placement)}: ${money(lang, x.cost)}`),
    notes: tradeoffs(d, lang, placements, v),
  }
}

/** Money efficiency lines from moneyEfficiency(): player ÷ full-budget benchmark (primary), same-spend benchmark, unspent, one concrete difference. */
export function efficiency(d: GameData, lang: Lang, placements: Placement[], me: ReturnType<typeof moneyEfficiency>) {
  const spend = (ps: Placement[]) => ps.reduce((m, p) => m.set(p.item, (m.get(p.item) ?? 0) + new Plan(d, [p]).cost()), new Map<string, number>())
  const top = (a: Map<string, number>, b: Map<string, number>) => [...a].filter(([k]) => !b.has(k)).sort((x, y) => y[1] - x[1])[0]
  const mine = spend(placements), theirs = spend(me.benchmarkAtSpend.placements)
  const bt = top(theirs, mine), pt = top(mine, theirs)
  const nm = (id: string) => itemName(lang, d.items.find((i) => i.id === id)!)
  return {
    band: band(d, me.efficiency), atSpendBand: band(d, me.benchmarkAtSpend.result.overall), fullBand: band(d, me.benchmark.result.overall),
    spent: money(lang, me.player.spent), benchSpent: money(lang, me.benchmarkAtSpend.result.spent),
    unspent: t(d, lang, 'deb_unspent', { amount: money(lang, me.unspent) }),
    diff: bt && pt ? t(d, lang, 'deb_benchmark_diff', { amount: money(lang, bt[1]), item: nm(bt[0]), other: nm(pt[0]) }) : '',
  }
}
