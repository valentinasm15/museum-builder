import type { GameData } from '../data/load'

export interface WallRun { horiz: boolean; line: number; a: number; b: number; nx: number; nz: number }

/** Outer walls = every tile edge of the Floor rects that has no floor behind it, merged into runs. The entrance opening stays free. */
export function wallRuns(d: GameData): WallRun[] {
  const tiles = new Set<string>()
  for (const r of d.floor) for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) tiles.add(`${x},${y}`)
  const has = (x: number, y: number) => tiles.has(`${x},${y}`)
  const { entrance_x: ex, entrance_y: ey } = d.settings
  const edges: Record<string, { horiz: boolean; line: number; at: number; nx: number; nz: number }[]> = {}
  const add = (horiz: boolean, line: number, at: number, nx: number, nz: number) =>
    (edges[`${horiz}:${line}:${nx}:${nz}`] ??= []).push({ horiz, line, at, nx, nz })
  for (const key of tiles) {
    const [x, y] = key.split(',').map(Number)
    const opening = y + 1 === ey && Math.abs(x + 0.5 - ex) <= 1.5
    if (!has(x, y - 1)) add(true, y, x, 0, -1)
    if (!has(x, y + 1) && !opening) add(true, y + 1, x, 0, 1)
    if (!has(x - 1, y)) add(false, x, y, -1, 0)
    if (!has(x + 1, y)) add(false, x + 1, y, 1, 0)
  }
  const runs: WallRun[] = []
  for (const list of Object.values(edges)) {
    const at = list.map((e) => e.at).sort((p, q) => p - q)
    let start = at[0], prev = at[0]
    for (const v of [...at.slice(1), Infinity]) {
      if (v !== prev + 1) { runs.push({ horiz: list[0].horiz, line: list[0].line, a: start, b: prev + 1, nx: list[0].nx, nz: list[0].nz }); start = v }
      prev = v
    }
  }
  return runs
}
