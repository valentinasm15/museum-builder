import * as XLSX from 'xlsx'

export type Requires = string[][] // outer = ALL (';'), inner = ANY ('|')
export type Scope = 'zone' | 'venue' | 'path'

export interface Item {
  id: string; name: string; nameFi: string; scope: Scope; channel: string
  requires: Requires; enhances: string[]; reach: string; infoValue: number
  costEur: number; enhanceFactor: number; reachGrant: string; status: string; source: string
}
export interface Persona {
  id: string; name: string; nameFi: string; visitorShare: number
  attrs: Record<string, boolean>; status: string
}
export interface Zone {
  id: string; nameEn: string; nameFi: string; hasScreen: boolean
  exhibitObjects: number; routeSegment: string; exhibits: string[]
}
export interface Segment { id: string; from: string; description: string; existing: boolean }
export interface Existing { itemId: string; zoneId: string }
export interface GameData {
  settings: Record<string, number>
  items: Item[]; personas: Persona[]; zones: Zone[]; route: Segment[]
  existing: Existing[]; scoring: Record<string, number>
  texts: Record<string, { en: string; fi: string }>
}

type Row = Record<string, unknown>
const PERSONA_META = ['id', 'name', 'visitorShare', 'status', 'source', 'name_fi', 'validated_by']

function sheet(wb: XLSX.WorkBook, name: string, cols: string[]): Row[] {
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`Data workbook: missing sheet "${name}"`)
  const header = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })[0] ?? []).map(String)
  for (const c of cols)
    if (!header.includes(c)) throw new Error(`Data workbook: sheet "${name}" is missing column "${c}"`)
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '' }).filter((r) => str(r[cols[0]]) !== '')
}

const str = (v: unknown) => (v == null ? '' : String(v).trim())
const num = (v: unknown, sheetName: string, col: string, dflt?: number) => {
  if (str(v) === '' && dflt !== undefined) return dflt
  const n = Number(v)
  if (Number.isNaN(n)) throw new Error(`Data workbook: sheet "${sheetName}" column "${col}" has non-number "${str(v)}"`)
  return n
}
const bool = (v: unknown) => v === true || /^(true|yes|1)$/i.test(str(v))
const list = (v: unknown, sep: string) => str(v).split(sep).map((s) => s.trim()).filter(Boolean)
export const parseRequires = (v: unknown): Requires => list(v, ';').map((g) => list(g, '|'))

function keyValue(wb: XLSX.WorkBook, name: string, key: string): Record<string, number> {
  return Object.fromEntries(sheet(wb, name, [key, 'value']).map((r) => [str(r[key]), num(r.value, name, 'value')]))
}

export function parseWorkbook(wb: XLSX.WorkBook): GameData {
  const items = sheet(wb, 'Items', ['id', 'name', 'scope', 'channel', 'requires', 'enhances', 'reach',
    'info_value', 'cost_eur', 'status', 'source', 'name_fi', 'enhance_factor', 'reach_grant']).map((r): Item => ({
    id: str(r.id), name: str(r.name), nameFi: str(r.name_fi), scope: str(r.scope) as Scope,
    channel: str(r.channel), requires: parseRequires(r.requires), enhances: list(r.enhances, ';'),
    reach: str(r.reach) || 'all', infoValue: num(r.info_value, 'Items', 'info_value', 0),
    costEur: num(r.cost_eur, 'Items', 'cost_eur'), enhanceFactor: num(r.enhance_factor, 'Items', 'enhance_factor', 1),
    reachGrant: str(r.reach_grant), status: str(r.status), source: str(r.source),
  }))
  const pRows = sheet(wb, 'Personas', ['id', 'name', 'visitorShare', 'status', 'name_fi'])
  const attrCols = Object.keys(pRows[0] ?? {}).filter((k) => !PERSONA_META.includes(k))
  const personas = pRows.map((r): Persona => ({
    id: str(r.id), name: str(r.name), nameFi: str(r.name_fi), status: str(r.status),
    visitorShare: num(r.visitorShare, 'Personas', 'visitorShare'),
    attrs: Object.fromEntries(attrCols.map((c) => [c, bool(r[c])])),
  }))
  const zones = sheet(wb, 'Zones', ['id', 'name_fi', 'name_en', 'has_screen', 'exhibit_objects', 'route_segment',
    'exhibits (names, \';\'-separated)']).map((r): Zone => ({
    id: str(r.id), nameEn: str(r.name_en), nameFi: str(r.name_fi), hasScreen: bool(r.has_screen),
    exhibitObjects: num(r.exhibit_objects, 'Zones', 'exhibit_objects', 0), routeSegment: str(r.route_segment),
    exhibits: list(r["exhibits (names, ';'-separated)"], ';'),
  }))
  const route = sheet(wb, 'Route', ['segment_id', 'from', 'description', 'existing']).map((r): Segment => ({
    id: str(r.segment_id), from: str(r.from), description: str(r.description), existing: bool(r.existing),
  }))
  const existing = sheet(wb, 'Existing', ['item_id', 'zone_id']).map((r) => ({ itemId: str(r.item_id), zoneId: str(r.zone_id) }))
  const texts = Object.fromEntries(sheet(wb, 'Texts', ['key', 'en', 'fi']).map((r) => [str(r.key), { en: str(r.en), fi: str(r.fi) || str(r.en) }]))
  const data: GameData = {
    settings: keyValue(wb, 'Settings', 'setting'), scoring: keyValue(wb, 'Scoring', 'parameter'),
    items, personas, zones, route, existing, texts,
  }
  validate(data, attrCols)
  return data
}

function validate(d: GameData, attrs: string[]) {
  const ids = new Set(d.items.map((i) => i.id))
  const zoneIds = new Set(d.zones.map((z) => z.id))
  const segIds = new Set(d.route.map((s) => s.id))
  const fail = (m: string) => { throw new Error(`Data workbook: ${m}`) }
  for (const k of ['reach_full', 'reach_staff_guided', 'reach_plan_only', 'richness_per_extra_channel',
    'richness_cap', 'min_channels_full_value', 'single_channel_penalty', 'lighting_reach_factor'])
    if (!(k in d.scoring)) fail(`sheet "Scoring" is missing parameter "${k}"`)
  if (!('budget_eur' in d.settings)) fail('sheet "Settings" is missing setting "budget_eur"')
  for (const i of d.items) {
    if (i.reachGrant && !['staff_guided', 'plan_only'].includes(i.reachGrant)) fail(`sheet "Items" column "reach_grant": "${i.reachGrant}" (item ${i.id}); use staff_guided or plan_only`)
    if (!['zone', 'venue', 'path'].includes(i.scope)) fail(`sheet "Items" column "scope": "${i.scope}" (item ${i.id})`)
    if (i.reach !== 'all' && !attrs.includes(i.reach)) fail(`sheet "Items" column "reach": unknown persona attribute "${i.reach}" (item ${i.id})`)
    for (const t of i.requires.flat())
      if (t !== 'route' && t !== 'has_screen' && !ids.has(t)) fail(`sheet "Items" column "requires": unknown id "${t}" (item ${i.id})`)
    for (const t of i.enhances) if (!ids.has(t)) fail(`sheet "Items" column "enhances": unknown id "${t}" (item ${i.id})`)
  }
  for (const z of d.zones) if (!segIds.has(z.routeSegment)) fail(`sheet "Zones" column "route_segment": unknown "${z.routeSegment}" (zone ${z.id})`)
  for (const s of d.route) if (s.from !== 'entrance' && !segIds.has(s.from)) fail(`sheet "Route" column "from": unknown "${s.from}"`)
  for (const e of d.existing) {
    if (!ids.has(e.itemId)) fail(`sheet "Existing" column "item_id": unknown "${e.itemId}"`)
    if (e.zoneId && !zoneIds.has(e.zoneId)) fail(`sheet "Existing" column "zone_id": unknown "${e.zoneId}"`)
  }
}

export const loadData = (buf: ArrayBuffer | Uint8Array) => parseWorkbook(XLSX.read(buf))
