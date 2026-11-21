import { readFileSync } from 'node:fs'
import { beforeEach, expect, it, vi } from 'vitest'
import { loadData } from './data/load'
import { budget, drawVisit, remaining, t, useGame, waitingMap } from './store'

const data = loadData(readFileSync('src/data/museum-builder-data.xlsx'))
const s = () => useGame.getState()
const left = () => remaining(data, s().placements)
const cost = (id: string) => data.items.find((i) => i.id === id)!.costEur
beforeEach(() => s().init(data))

it('store budget: place, remove, existing free, cannot exceed', () => {
  expect(left()).toBe(budget(data))
  expect(s().place('lighting', 'viestinta')).toBe(true)
  expect(left()).toBe(budget(data) - cost('lighting'))
  expect(s().place('lighting', 'viestinta')).toBe(false) // already placed
  s().remove({ item: 'lighting', at: 'viestinta' })
  expect(left()).toBe(budget(data))

  const ex = data.existing[0]
  expect(s().place(ex.itemId, ex.zoneId)).toBe(false) // already there, not re-bought
  expect(s().place('tactile_route', data.route.find((r) => r.existing)!.id)).toBe(false)

  const zones = data.zones.map((z) => z.id)
  const targets = ['', ...zones, ...data.route.map((r) => r.id)]
  for (const i of [...data.items].sort((a, b) => b.costEur - a.costEur)) for (const at of targets) s().place(i.id, at)
  expect(left()).toBeGreaterThanOrEqual(0)
  const tooDear = data.items.filter((i) => i.costEur > left())
  expect(tooDear.length).toBeGreaterThan(0)
  for (const i of tooDear) for (const at of targets) expect(s().place(i.id, at)).toBe(false)
})

it('levels: easier = bigger budget, switching resets the plan', () => {
  const b = data.levels.map((l) => l.budgetEur)
  expect(b).toEqual([...b].sort((x, y) => y - x))
  s().place('lighting', data.zones[0].id)
  s().setLevel('hard')
  expect(s().placements).toEqual([])
  expect(budget(s().data!)).toBe(data.levels.find((l) => l.id === 'hard')!.budgetEur)
})

const draws = (n: number, ex?: string) => Array.from({ length: n }, () => drawVisit(data, ex))

it('visit: shares are weights, every persona can appear', () => {
  const total = data.personas.reduce((a, p) => a + p.visitorShare, 0)
  let acc = 0
  for (const p of data.personas) { // a roll in the middle of each persona's share interval picks that persona
    const r = (acc + p.visitorShare / 2) / total; acc += p.visitorShare
    vi.spyOn(Math, 'random').mockReturnValueOnce(r).mockReturnValueOnce(0)
    expect(drawVisit(data).personaId).toBe(p.id)
  }
  vi.restoreAllMocks()
  expect(new Set(draws(4000).map((v) => v.personaId)).size).toBe(data.personas.length)
})

it('visit: excluded persona never returned; situation is independent of persona', () => {
  const ex = data.personas[0].id
  expect(draws(500, ex).every((v) => v.personaId !== ex)).toBe(true)
  const sit = vi.spyOn(Math, 'random')
  sit.mockReturnValueOnce(0).mockReturnValueOnce(0.999)
  expect(drawVisit(data).situationId).toBe(data.situations[data.situations.length - 1].id)
  vi.restoreAllMocks()
  const first = data.situations[0].id
  for (const p of data.personas) // any persona can come with any situation
    expect(draws(3000).some((v) => v.situationId === first)).toBe(true)
  expect(new Set(draws(1000).map((v) => v.situationId)).size).toBe(data.situations.length)
})

it('init, setLevel and startRound draw a visit; setLevel resets the plan', () => {
  const ok = () => data.personas.some((p) => p.id === s().visit.personaId) && data.situations.some((x) => x.id === s().visit.situationId)
  expect(ok() && s().round === 1 && s().phase === 'planning').toBe(true)
  expect(s().announcement).not.toMatch(/\[drawn_/)
  s().place('lighting', data.zones[0].id)
  s().setLevel('hard')
  expect(ok() && s().placements).toEqual([])
  s().startRound(2)
  expect(s().round).toBe(2)
})

it('round 2 excludes the round-1 persona; all personas still scored', () => {
  for (let i = 0; i < 100; i++) { s().startRound(1); const p1 = s().visit.personaId; s().startRound(2); expect(s().visit.personaId).not.toBe(p1) }
  expect(t(data, 'fi', 'intro_visitor', { persona: 'a', situation: 'b' })).not.toMatch(/^\[/)
})

it('openMuseum / closeVisit switch phase', () => {
  s().openMuseum(); expect(s().phase).toBe('visiting')
  s().closeVisit(); expect(s().phase).toBe('planning')
})

it('round 2 keeps the plan and budget, redraws without the round-1 persona; debrief phase', () => {
  s().place('lighting', data.zones[0].id)
  const p1 = s().visit.personaId, b = budget(s().data!)
  s().openDebrief(); expect(s().phase).toBe('debrief')
  s().startRound(2)
  expect(s().phase).toBe('planning'); expect(s().round).toBe(2)
  expect(s().placements).toHaveLength(1); expect(budget(s().data!)).toBe(b)
  expect(s().visit.personaId).not.toBe(p1)
  expect(s().announcement).toContain(s().visit.personaId ? data.personas.find((p) => p.id === s().visit.personaId)!.name : '')
})

it('rounds are recorded once each, and restart clears the plan and the record', () => {
  useGame.getState().setRound({ n: 1, visitor: 'A', focal: 'good', overall: 'partial' })
  useGame.getState().setRound({ n: 1, visitor: 'A', focal: 'strong', overall: 'good' })
  useGame.getState().setRound({ n: 2, visitor: 'B', focal: 'partial', overall: 'partial' })
  expect(useGame.getState().rounds.map((r) => r.n)).toEqual([1, 2])
  expect(useGame.getState().rounds[0].focal).toBe('strong')
  useGame.getState().restart()
  expect(useGame.getState().rounds).toEqual([])
  expect(useGame.getState().round).toBe(1)
  expect(useGame.getState().placements).toEqual([])
  expect(useGame.getState().phase).toBe('planning')
})

it('the open item card is closed when a new game or the walkthrough starts', () => {
  s().setInspect({ item: 'audio_description', at: data.zones[0].id })
  s().openMuseum()
  expect(s().inspect).toBeNull()
  s().setInspect({ item: 'audio_description', at: data.zones[0].id })
  s().restart()
  expect(s().inspect).toBeNull()
})

it('screens and other carriers are "waiting" until something placed uses them', () => {
  const screen = data.zones.find((z) => z.hasScreen)!.id
  expect(waitingMap(data, []).has(`video_screen@${screen}`)).toBe(true) // existing screen, nothing accessible yet
  expect(waitingMap(data, [{ item: 'large_print_captions', at: screen }]).has(`video_screen@${screen}`)).toBe(false)
  expect(waitingMap(data, [{ item: 'audio_guide_devices', at: '' }]).has('audio_guide_devices@')).toBe(true)
  expect(waitingMap(data, [{ item: 'audio_guide_devices', at: '' }, { item: 'audio_description', at: data.zones[0].id }]).has('audio_guide_devices@')).toBe(false)
  expect(waitingMap(data, [{ item: 'staff_training', at: '' }]).has('staff_training@')).toBe(false) // staff training has value of its own
})

it('multi-place: zone items stay selected after a place; venue items are one-shot; cancel clears', () => {
  const [a, b] = data.zones.map((z) => z.id)
  expect(data.items.find((i) => i.id === 'lighting')!.scope).toBe('zone')
  s().select('lighting')
  expect(s().place('lighting', a)).toBe(true)
  expect(s().selected).toBe('lighting')
  expect(s().place('lighting', a)).toBe(false) // refused: still selected
  expect(s().selected).toBe('lighting')
  expect(s().place('lighting', b)).toBe(true)
  expect(s().placements.map((p) => p.at)).toEqual([a, b])
  s().select(null)
  expect(s().selected).toBeNull()
  s().select('staff_training')
  expect(s().place('staff_training', '')).toBe(true)
  expect(s().selected).toBeNull()
})
