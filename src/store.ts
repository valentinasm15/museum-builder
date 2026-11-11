import { play, type Cue } from './ui/sound'
import { create } from 'zustand'
import type { GameData, Item, Level } from './data/load'
import { Plan, score, type Placement, type VisitContext } from './engine/score'

export type Lang = 'en' | 'fi'
export type Phase = 'planning' | 'visiting' | 'debrief'

interface State {
  data: GameData | null; base: GameData | null; level: string; error: string | null; lang: Lang
  placements: Placement[]; selected: string | null; announcement: string
  sound: boolean; setSound: (on: boolean) => void // click cues, off by default, remembered in the browser
  visit: Visit; round: number; phase: Phase
  focus: string | null // zone id shown as selected in both the scene and the Room text view
  setFocus: (id: string | null) => void
  init: (data: GameData) => void
  fail: (message: string) => void
  setLang: (lang: Lang) => void
  setLevel: (id: string) => void
  startRound: (n: number) => void
  openMuseum: () => void
  openDebrief: () => void
  closeVisit: () => void
  select: (item: string | null) => void
  place: (item: string, at: string) => boolean
  remove: (p: Placement) => void
}

export interface Visit { personaId: string; situationId: string }
/** One persona weighted by visitorShare (never `excludePersonaId` while others exist), one situation uniformly and independently. */
export function drawVisit(d: GameData, excludePersonaId?: string): Visit {
  const pool = d.personas.filter((p) => p.id !== excludePersonaId)
  const ps = pool.length ? pool : d.personas
  let r = Math.random() * ps.reduce((a, p) => a + p.visitorShare, 0)
  const persona = ps.find((p) => (r -= p.visitorShare) < 0) ?? ps[ps.length - 1]
  const situation = d.situations[Math.min(d.situations.length - 1, Math.floor(Math.random() * d.situations.length))]
  return { personaId: persona.id, situationId: situation.id }
}
/** Today's conditions (Situations sheet) for a drawn visit, as score() ctx. */
export function visitCtx(d: GameData, v: Visit): VisitContext {
  const x = d.situations.find((s) => s.id === v.situationId)
  return x ? { hasMuseumDevice: x.hasMuseumDevice, phoneWorks: x.phoneWorks, staffAvailable: x.staffAvailable } : {}
}
/** Localised names of the drawn persona and situation. */
export function visitNames(d: GameData, lang: Lang, v: Visit) {
  const p = d.personas.find((x) => x.id === v.personaId), s = d.situations.find((x) => x.id === v.situationId)
  return { persona: (p && ((lang === 'fi' && p.nameFi) || p.name)) || '', situation: (s && ((lang === 'fi' && s.nameFi) || s.name)) || '' }
}
const noVisit: Visit = { personaId: '', situationId: '' }

// ---- derived budget (Plan.cost() handles existing items and existing segments as free) ----
export const budget = (d: GameData) => d.settings.budget_eur
export const spent = (d: GameData, ps: Placement[]) => new Plan(d, ps).cost()
export const remaining = (d: GameData, ps: Placement[]) => budget(d) - spent(d, ps)
export const isExisting = (d: GameData, item: string, at: string) =>
  d.existing.some((e) => e.itemId === item && e.zoneId === at) ||
  (d.items.find((i) => i.id === item)?.scope === 'path' && d.route.some((s) => s.id === at && s.existing))
export const isPlaced = (ps: Placement[], item: string, at: string) => ps.some((p) => p.item === item && p.at === at)
export function canPlace(d: GameData, ps: Placement[], item: string, at: string) {
  if (isPlaced(ps, item, at) || isExisting(d, item, at)) return false
  return spent(d, [...ps, { item, at }]) <= budget(d)
}

/** `item@at` → unmet requirement groups, for placements that are placed but do not work yet. */
export function inactiveMap(d: GameData, ps: Placement[]) {
  const m = new Map<string, string[][]>()
  for (const x of score(d, ps).inactive) m.set(`${x.placement.item}@${x.placement.at}`, x.missing.map((g) => g.split(' or ')))
  return m
}

// ---- texts ----
export function t(d: GameData, lang: Lang, key: string, vars: Record<string, string | number> = {}) {
  const row = d.texts[key]
  if (!row) console.warn(`Texts sheet: missing key "${key}"`)
  const s = row ? row[lang] || row.en : `[${key}]`
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}
export const money = (lang: Lang, n: number) =>
  new Intl.NumberFormat(lang === 'fi' ? 'fi-FI' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
export const itemName = (lang: Lang, i: Item) => (lang === 'fi' && i.nameFi) || i.name
/** Requirement groups in plain words: groups joined by "and", alternatives by "or". */
export function needsText(d: GameData, lang: Lang, groups: string[][]) {
  if (!groups.length) return t(d, lang, 'nothing_needed')
  const word = (tok: string) => {
    if (tok === 'route' || tok === 'has_screen') return t(d, lang, `req_${tok}`)
    const i = d.items.find((x) => x.id === tok)
    return i ? itemName(lang, i) : tok
  }
  return groups.map((g) => g.map(word).join(` ${t(d, lang, 'or')} `)).join(`; ${t(d, lang, 'and')} `)
}
export const helpsText = (d: GameData, lang: Lang, i: Item) =>
  i.reach === 'all' ? t(d, lang, 'everyone') : t(d, lang, `attr_${i.reach}`)
export function targetName(d: GameData, lang: Lang, at: string) {
  if (at === '') return t(d, lang, 'whole_museum')
  const z = d.zones.find((z) => z.id === at)
  if (z) return (lang === 'fi' && z.nameFi) || z.nameEn
  const s = d.route.find((s) => s.id === at)
  return s ? `${t(d, lang, 'route_segment')} ${s.id}: ${s.description}` : at
}

/** Level shown first: the one whose budget equals Settings.budget_eur, else the first row. */
export const defaultLevel = (d: GameData) => (d.levels.find((l) => l.budgetEur === d.settings.budget_eur) ?? d.levels[0]).id
export const levelName = (lang: Lang, l: Level) => (lang === 'fi' && l.nameFi) || l.name
const withLevel = (base: GameData, id: string): GameData => ({
  ...base, settings: { ...base.settings, budget_eur: base.levels.find((l) => l.id === id)!.budgetEur },
})

const SOUND_KEY = 'mb-sound'
const soundSaved = () => { try { return localStorage.getItem(SOUND_KEY) === '1' } catch { return false } }
export const cue = (k: Cue) => { if (useGame.getState().sound) play(k) }

export const useGame = create<State>((set, get) => {
  const say = (key: string, item: string, at: string) => {
    const { data: d, lang, placements } = get()
    if (!d) return
    const i = d.items.find((x) => x.id === item)!
    set({ announcement: t(d, lang, key, { item: itemName(lang, i), target: targetName(d, lang, at), remaining: money(lang, remaining(d, placements)) }) })
  }
  const drawn = (d: GameData, lang: Lang, v: Visit) => {
    const n = visitNames(d, lang, v)
    return `${t(d, lang, 'drawn_visitor')}: ${n.persona}. ${t(d, lang, 'drawn_situation')}: ${n.situation}.`
  }
  return {
    data: null, base: null, level: '', error: null, lang: 'en', placements: [], selected: null, announcement: '', sound: soundSaved(), focus: null, visit: noVisit, round: 1, phase: 'planning',
    setFocus: (focus) => set({ focus }),
    init: (base) => {
      const level = defaultLevel(base), data = withLevel(base, level), visit = drawVisit(base)
      set({ base, level, data, error: null, placements: [], selected: null, focus: null, visit, round: 1, phase: 'planning', announcement: drawn(data, get().lang, visit) })
    },
    openMuseum: () => { if (get().data) set({ phase: 'visiting', selected: null }) },
    openDebrief: () => set({ phase: 'debrief' }),
    closeVisit: () => set({ phase: 'planning' }),
    startRound: (n) => {
      const { data, lang, visit: prev } = get()
      if (!data) return
      const visit = drawVisit(data, n > 1 ? prev.personaId : undefined)
      // Same budget and plan: the player may revise it for the new visitor.
      set({ round: n, visit, phase: 'planning', selected: null, focus: null, announcement: `${t(data, lang, 'round')} ${n}. ${drawn(data, lang, visit)}` })
    },
    setLevel: (id) => {
      const { base, lang, level } = get()
      const l = base?.levels.find((x) => x.id === id)
      if (!base || !l || id === level) return
      const data = withLevel(base, id)
      const visit = drawVisit(base)
      set({ level: id, data, placements: [], selected: null, focus: null, visit, round: 1, phase: 'planning',
        announcement: `${t(data, lang, 'level_announce', { level: levelName(lang, l), budget: money(lang, l.budgetEur) })} ${drawn(data, lang, visit)}` })
    },
    fail: (error) => set({ error }),
    setLang: (lang) => set({ lang }),
    setSound: (sound) => {
      try { localStorage.setItem(SOUND_KEY, sound ? '1' : '0') } catch { /* ignore */ }
      set({ sound }); if (sound) play('placed')
    },
    select: (selected) => {
      set({ selected })
      const d = get().data
      if (!d) return
      if (selected) say('choose_target', selected, '')
      else set({ announcement: t(d, get().lang, 'announce_cancel') })
    },
    place: (item, at) => {
      const { data: d, placements } = get()
      if (!d || !canPlace(d, placements, item, at)) { cue('refused'); return false }
      set({ placements: [...placements, { item, at }], selected: null })
      cue('placed'); say('announce_placed', item, at)
      return true
    },
    remove: (p) => {
      set({ placements: get().placements.filter((x) => !(x.item === p.item && x.at === p.at)) })
      cue('removed'); say('announce_removed', p.item, p.at)
    },
  }
})
