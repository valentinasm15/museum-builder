import type { GameData, Persona } from '../data/load'
import { budget, itemName, money, t, targetName, visitCtx, visitNames, type Lang, type Visit } from '../store'
import { bundles, candidates, marginalContributions, type moneyEfficiency } from './benchmark'
import { Plan, score, type Placement, type VisitContext } from './score'
import { museumGap, stops, visit as walk } from './visit'

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
  navA: { en: "Today's visitor", fi: 'Päivän kävijä' },
  navB: { en: 'All visitor types', fi: 'Kaikki kävijätyypit' },
  navC: { en: 'Your money', fi: 'Rahasi' },
  navD: { en: 'Next step', fi: 'Seuraava askel' },
  titleA: { en: "A. Today's visitor, today's conditions", fi: 'A. Päivän kävijä, päivän olosuhteet' },
  titleB: { en: 'B. All visitor types, on a normal day', fi: 'B. Kaikki kävijätyypit, tavallisena päivänä' },
  titleC: { en: 'C. Your money', fi: 'C. Rahasi' },
  titleD: { en: 'D. Next step', fi: 'D. Seuraava askel' },
  verdict: { en: 'Your plan works for {n} of {total} visitor types.', fi: 'Suunnitelmasi toimii {n}/{total} kävijätyypille.' },
  gapLead: { en: 'Biggest gap:', fi: 'Suurin aukko:' },
  spentOf: { en: 'Spent {spent} of {budget}', fi: 'Käytetty {spent} / {budget}' },
  roomsLegend: { en: 'Guided = a route leads here and there is something to experience · With effort = found from the floor plan, no guiding route · Empty = reached, nothing to experience · Not guided = nothing leads here', fi: 'Opastettu = opaslinja johtaa tänne ja on koettavaa · Vaivalla = löytyy kartalta, ei opaslinjaa · Tyhjä = perillä, ei koettavaa · Ei opastusta = mikään ei johda tänne' },
  st_full: { en: 'Guided', fi: 'Opastettu' }, st_partial: { en: 'With effort', fi: 'Vaivalla' }, st_empty: { en: 'Empty', fi: 'Tyhjä' }, st_none: { en: 'Not guided', fi: 'Ei opastusta' },
  worked: { en: 'What worked: {rooms}.', fi: 'Toimi: {rooms}.' },
  needRoute: { en: 'A tactile route to {rooms} ({cost}) would make the visit easier and more independent, and lead visitors to what is there.', fi: 'Opaslinja huoneisiin {rooms} ({cost}) tekisi vierailusta helpomman ja itsenäisemmän ja johdattaisi kävijät esineiden luo.' },
  emptyRooms: { en: 'Reached, but nothing this visitor can use: {rooms}.', fi: 'Perillä, mutta ei käytettävää tälle kävijälle: {rooms}.' },
  showWalk: { en: 'Show the full walkthrough', fi: 'Näytä koko kierros' },
  colType: { en: 'Visitor type', fi: 'Kävijätyyppi' }, colShare: { en: 'Share', fi: 'Osuus' }, colResult: { en: 'Result', fi: 'Tulos' }, colRooms: { en: 'Rooms', fi: 'Huoneet' },
  checks: { en: 'Three checks', fi: 'Kolme tarkistusta' },
  wasted: { en: "Spent on items that don't work yet", fi: 'Käytetty kohteisiin, jotka eivät vielä toimi' },
  bestBuy: { en: 'Biggest effect', fi: 'Suurin vaikutus' }, weakBuy: { en: 'Smallest effect', fi: 'Pienin vaikutus' },
  showTable: { en: 'Show all visitor types', fi: 'Näytä kaikki kävijätyypit' },
  benchLine: { en: 'Benchmark at your spend: {band} ({bench}; you {you}).', fi: 'Vertailu samalla summalla: {band} ({bench}; sinä {you}).' },
  moreTrade: { en: 'Trade-offs in your plan', fi: 'Suunnitelmasi valinnat' },
  nextBuy: { en: 'Best next buy: {what} ({cost}). It would help {n} of {total} visitor types more.', fi: 'Paras seuraava ostos: {what} ({cost}). Se auttaisi {n}/{total} kävijätyyppiä enemmän.' },
  nextShort: { en: 'The biggest step would be {what} ({cost}); you are {short} short.', fi: 'Suurin askel olisi {what} ({cost}); sinulta puuttuu {short}.' },
  gameTitle: { en: 'Your game', fi: 'Pelisi' },
  roundLine: { en: 'Round {n}: {visitor}. For this visitor: {focal}. Whole museum: {overall}.', fi: 'Kierros {n}: {visitor}. Tälle kävijälle: {focal}. Koko museo: {overall}.' },
  playAgain: { en: 'Start Over', fi: 'Aloita alusta' },
  launchH: { en: 'Open the museum?', fi: 'Avataanko museo?' },
  launchSummary: { en: 'Spent {spent} of {budget}. Items placed: {n}.', fi: 'Käytetty {spent} / {budget}. Sijoitettuja kohteita: {n}.' },
  launchInactive: { en: 'Placed but not working yet:', fi: 'Sijoitettu, mutta ei vielä toimi:' },
  launchWaiting: { en: 'Placed but unused by anything yet:', fi: 'Sijoitettu, mutta mikään ei käytä vielä:' },
  launchGo: { en: 'Open the museum', fi: 'Avaa museo' },
  launchBack: { en: 'Keep planning', fi: 'Jatka suunnittelua' },
  roundsNote: { en: 'The game has {rounds} rounds, each with a different visitor. Your plan and budget carry over.', fi: 'Pelissä on {rounds} kierrosta, kullakin eri kävijä. Suunnitelmasi ja budjettisi säilyvät.' },
  keepPlan: { en: 'Your plan and budget are kept. You may remove or add items before the next visitor.', fi: 'Suunnitelmasi ja budjettisi säilyvät. Voit poistaa tai lisätä kohteita ennen seuraavaa kävijää.' },
  nextNone: { en: 'Nothing you can still afford adds access. Consider removing something that does not pay off.', fi: 'Mikään jäljellä olevalla rahalla ostettava ei lisää saavutettavuutta. Harkitse heikon ostoksen poistamista.' },
  left: { en: 'left', fi: 'jäljellä' },
  idleWait: { en: '{item} ({cost}) is waiting: nothing you placed uses it yet. It carries {needs}.', fi: '{item} ({cost}) odottaa: mikään sijoittamasi ei käytä sitä vielä. Se tarvitsee sisältöä: {needs}.' },
  idleRoute: { en: '{item} ({cost}, {where}) leads nowhere yet: the route is not connected to a room.', fi: '{item} ({cost}, {where}) ei johda vielä minnekään: reitti ei ulotu huoneeseen.' },
  idleDup: { en: '{item} ({cost}) adds nothing now: something else already does the same job.', fi: '{item} ({cost}) ei lisää nyt mitään: jokin muu hoitaa jo saman tehtävän.' },
  roundOf: { en: 'Round {n} of {total}', fi: 'Kierros {n}/{total}' },
}
export const local = (lang: Lang, k: keyof typeof LOCAL, vars: Record<string, string | number> = {}) =>
  LOCAL[k][lang].replace(/\{(\w+)\}/g, (m, v) => (v in vars ? String(vars[v]) : m))

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
  const min = d.scoring.min_channels_full_value
  const zr = (p: Persona, z: string) => std.zones[z][p.id]
  const items = d.items.reduce((m, i) => m.set(i.id, i), new Map<string, (typeof d.items)[number]>())
  const marg = marginalContributions(d, placements)
  const label = (pl: Placement) => `${itemName(lang, items.get(pl.item)!)} (${targetName(d, lang, pl.at)})`
  const single = (pl: Placement) => new Plan(d, [pl]).cost()
  const plan = new Plan(d, placements, ctx)
  const route = d.items.find((i) => i.scope === 'path')
  const names = visitNames(d, lang, v)
  const rooms = stops(d, placements, persona, ctx, lang).filter((s) => s.kind === 'room').map((s) => ({ id: s.id, name: s.name, status: s.status as 'full' | 'partial' | 'empty' | 'none' })) // one source of truth: the walkthrough stops
  const list = (st: string[]) => rooms.filter((r) => st.includes(r.status)).map((r) => r.name).join(', ')
  const lacking = rooms.filter((r) => r.status === 'none' || r.status === 'partial')
  const segs = new Set(lacking.flatMap((r) => plan.chain(d.zones.find((z) => z.id === r.id)!.routeSegment).filter((s) => !plan.segmentExists(s))))
  const gaps = [
    list(['full']) && local(lang, 'worked', { rooms: list(['full']) }),
    segs.size && route ? local(lang, 'needRoute', { rooms: lacking.map((r) => r.name).join(', '), cost: money(lang, segs.size * route.costEur) }) : '',
    list(['empty']) && local(lang, 'emptyRooms', { rooms: list(['empty']) }),
  ].filter(Boolean)
  // Bought, nothing missing, but no effect: the item waits for a partner (content, a connected route) or duplicates another.
  const inactiveKeys = new Set(std.inactive.map((i) => `${i.placement.item}@${i.placement.at}`))
  const dependents = (id: string) => d.items.filter((i) => i.requires.some((g) => g.includes(id)))
  const idle = marg.filter((x) => x.cost > 0 && x.helped.length === 0 && x.delta < 1e-9 && !SIDE.has(items.get(x.placement.item)?.kind ?? '') && !inactiveKeys.has(`${x.placement.item}@${x.placement.at}`)).map((x) => {
    const it = items.get(x.placement.item)!, deps = dependents(it.id)
    const vars = { item: itemName(lang, it), cost: money(lang, x.cost), where: targetName(d, lang, x.placement.at), needs: deps.slice(0, 2).map((i) => itemName(lang, i)).join(', ') }
    const placedDeps = deps.some((i) => placements.some((p) => p.item === i.id))
    const kind = it.scope === 'path' ? 'idleRoute' : deps.length && !placedDeps ? 'idleWait' : 'idleDup'
    return { key: `${x.placement.item}@${x.placement.at}`, cost: x.cost, text: local(lang, kind, vars) }
  })
  const idleKeys = new Set(idle.map((i) => i.key))
  const roomsOf = (p: Persona) => d.zones.filter((z) => std.zones[z.id][p.id].score > 0).length
  const others = d.personas.map((p) => ({ id: p.id, name: nameOf(p, lang), share: p.visitorShare, band: band(d, std.personas[p.id]), rooms: roomsOf(p), total: d.zones.length }))
  const gap = museumGap(d, placements, lang)
  const zero = others.filter((o) => o.rooms === 0)
  const inactiveTotal = std.inactive.filter((x) => placements.some((p) => p.item === x.placement.item && p.at === x.placement.at)).reduce((a, x) => a + single(x.placement), 0)
  return {
    band: zero.length ? 'partial' as Band : band(d, std.overall), // a plan that leaves some visitor type with nothing is never better than Partial overall
    focal: { persona: names.persona, situation: names.situation, band: band(d, day.personas[persona.id] ?? 0),
      skipped: events.filter((e) => e.key === 'not_reachable').map((e) => e.text), end: events[events.length - 1].text,
      rooms, gaps, walk: events.map((e) => e.text) },
    verdict: { works: others.filter((o) => o.band !== 'partial').length, total: others.length, gap: gap ? `${local(lang, 'gapLead')} ${gap}` : '' },
    others,
    dims: {
      reach: band(d, weighted(d, (p, z) => zr(p, z).reach)),
      info: band(d, weighted(d, (p, z) => zr(p, z).info)),
      richness: band(d, weighted(d, (p, z) => (zr(p, z).channels.filter((c) => c !== 'visual').length >= min ? 1 : 0))),
    },
    leftOut: d.personas.filter((p) => std.leftOut.includes(p.id)).map((p) => `${nameOf(p, lang)} (${d.zones.filter((z) => std.zones[z.id][p.id].score === 0).length}/${d.zones.length})`),
    inactiveTotal, spent: std.spent, budget: budget(d),
    idle,
    values: marg.filter((x) => !SIDE.has(items.get(x.placement.item)?.kind ?? '') && !idleKeys.has(`${x.placement.item}@${x.placement.at}`)).sort((a, b) => b.delta - a.delta).map((x) =>
      t(d, lang, 'deb_item_value', { item: label(x.placement), cost: money(lang, x.cost), n: x.helped.length, total: d.personas.length, points: Math.round(x.delta * 100) })),
    side: marg.filter((x) => SIDE.has(items.get(x.placement.item)?.kind ?? '')).map((x) => `${label(x.placement)}: ${money(lang, x.cost)}`),
    notes: tradeoffs(d, lang, placements, v),
  }
}

/** Money efficiency lines from moneyEfficiency(): player ÷ full-budget benchmark (primary), same-spend benchmark, unspent, one concrete difference. */
export function efficiency(d: GameData, lang: Lang, placements: Placement[], me: ReturnType<typeof moneyEfficiency>, ctx: VisitContext = {}) {
  const spend = (ps: Placement[]) => ps.reduce((m, p) => m.set(p.item, (m.get(p.item) ?? 0) + new Plan(d, [p]).cost()), new Map<string, number>())
  // The benchmark plans a standard day; do not advise swapping in something that cannot work in today's situation.
  const idle = (id: string) => { const i = d.items.find((x) => x.id === id)
    return (ctx.staffAvailable === false && (i?.reachGrant === 'staff_guided' || id === 'guided_touch_tour')) || (ctx.hasMuseumDevice === false && id === 'audio_guide_devices') || (ctx.phoneWorks === false && i?.reach === 'usesSmartphone') }
  const top = (a: Map<string, number>, b: Map<string, number>) => [...a].filter(([k]) => !b.has(k) && !idle(k)).sort((x, y) => y[1] - x[1])[0]
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

/** Best affordable next purchase (access gain per euro), as one sentence. Slow like the benchmark: call it off the main render. */
export function nextStep(d: GameData, lang: Lang, placements: Placement[]): string {
  const plan = new Plan(d, placements), cur = score(d, placements), left = budget(d) - plan.cost()
  const name = (id: string) => itemName(lang, d.items.find((i) => i.id === id)!)
  type Opt = { add: Placement[]; cost: number; gain: number; helped: number }
  const opts: Opt[] = []
  for (const c of candidates(d)) for (const add of bundles(plan, c)) {
    if (!add.length) continue
    const next = [...placements, ...add], cost = new Plan(d, next).cost() - plan.cost()
    if (cost <= 0 || cost > budget(d)) continue // anything beyond the whole budget is not advice
    const r = score(d, next), gain = r.overall - cur.overall
    if (gain > 1e-9) opts.push({ add, cost, gain, helped: d.personas.filter((p) => r.personas[p.id] - cur.personas[p.id] > 1e-9).length })
  }
  const bigger = (a: Opt | undefined, b: Opt) => (!a || b.gain > a.gain + 1e-9 || (Math.abs(b.gain - a.gain) <= 1e-9 && b.cost < a.cost) ? b : a) // most gain, then cheapest
  const top = opts.reduce<Opt | undefined>(bigger, undefined), best = opts.filter((o) => o.cost <= left).reduce<Opt | undefined>(bigger, undefined)
  const what = (o: Opt) => { // zone items with their room, venue items by name, route segments as a count
    const kind = (p: Placement) => d.items.find((i) => i.id === p.item)!.scope
    const part = (p: Placement) => `${name(p.item)}${kind(p) === 'zone' ? `, ${targetName(d, lang, p.at)}` : ''}`
    const routes = o.add.filter((p) => kind(p) === 'path')
    return [...o.add.filter((p) => kind(p) !== 'path').map(part), ...(routes.length ? [`${name(routes[0].item)}${routes.length > 1 ? ` ×${routes.length}` : ''}`] : [])].join(' + ')
  }
  const buy = (o: Opt) => local(lang, 'nextBuy', { what: what(o), cost: money(lang, o.cost), n: o.helped, total: d.personas.length })
  if (!top) return local(lang, 'nextNone')
  if (!best) return local(lang, 'nextShort', { what: what(top), cost: money(lang, top.cost), short: money(lang, top.cost - left) })
  return best === top ? buy(best) : `${local(lang, 'nextShort', { what: what(top), cost: money(lang, top.cost), short: money(lang, top.cost - left) })} ${buy(best)}`
}
