import { create } from 'zustand'
import type { GameData, Item } from './data/load'
import { Plan, score, type Placement } from './engine/score'

export type Lang = 'en' | 'fi'

interface State {
  data: GameData | null; error: string | null; lang: Lang
  placements: Placement[]; selected: string | null; announcement: string
  focus: string | null // zone id shown as selected in both the scene and the Room text view
  setFocus: (id: string | null) => void
  init: (data: GameData) => void
  fail: (message: string) => void
  setLang: (lang: Lang) => void
  select: (item: string | null) => void
  place: (item: string, at: string) => boolean
  remove: (p: Placement) => void
}

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

export const useGame = create<State>((set, get) => {
  const say = (key: string, item: string, at: string) => {
    const { data: d, lang, placements } = get()
    if (!d) return
    const i = d.items.find((x) => x.id === item)!
    set({ announcement: t(d, lang, key, { item: itemName(lang, i), target: targetName(d, lang, at), remaining: money(lang, remaining(d, placements)) }) })
  }
  return {
    data: null, error: null, lang: 'en', placements: [], selected: null, announcement: '', focus: null,
    setFocus: (focus) => set({ focus }),
    init: (data) => set({ data, error: null, placements: [], selected: null, announcement: '', focus: null }),
    fail: (error) => set({ error }),
    setLang: (lang) => set({ lang }),
    select: (selected) => {
      set({ selected })
      const d = get().data
      if (!d) return
      if (selected) say('choose_target', selected, '')
      else set({ announcement: t(d, get().lang, 'announce_cancel') })
    },
    place: (item, at) => {
      const { data: d, placements } = get()
      if (!d || !canPlace(d, placements, item, at)) return false
      set({ placements: [...placements, { item, at }], selected: null })
      say('announce_placed', item, at)
      return true
    },
    remove: (p) => {
      set({ placements: get().placements.filter((x) => !(x.item === p.item && x.at === p.at)) })
      say('announce_removed', p.item, p.at)
    },
  }
})
