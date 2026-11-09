import { readFileSync } from 'node:fs'
import { beforeEach, expect, it } from 'vitest'
import { loadData } from './data/load'
import { budget, remaining, useGame } from './store'

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
