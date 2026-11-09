import { Edges, Html, RoundedBox } from '@react-three/drei'
import type { ReactNode } from 'react'
import type { GameData, Item, Segment } from '../data/load'
import { lookOf, P, type Shape } from './look'

/** Grid tile (x, y) → world [x, z], floor centred on the origin. */
export const world = (d: GameData, x: number, y: number): [number, number] => [x - d.settings.grid_w / 2, y - d.settings.grid_h / 2]

const HEIGHT: Record<Shape, number> = { box: 0.5, cyl: 0.5, slab: 0.22, panel: 0.6, cone: 0.6 }

export function ItemBlock({ item, pos, active }: { item: Item; pos: [number, number, number]; active: boolean }) {
  const look = lookOf(item)
  const h = HEIGHT[look.shape]
  const mat = <meshStandardMaterial color={active ? look.color : P.dim} transparent={!active} opacity={active ? 1 : 0.5} roughness={0.7} />
  return (
    <group position={pos}>
      <group position={[0, h / 2, 0]}>
        {look.shape === 'cyl' && <mesh castShadow><cylinderGeometry args={[0.26, 0.26, h, 24]} />{mat}{!active && <Edges color="#6b6458" />}</mesh>}
        {look.shape === 'cone' && <mesh castShadow><coneGeometry args={[0.28, h, 24]} />{mat}{!active && <Edges color="#6b6458" />}</mesh>}
        {look.shape === 'slab' && <RoundedBox args={[0.7, h, 0.45]} radius={0.06} castShadow>{mat}{!active && <Edges color="#6b6458" />}</RoundedBox>}
        {look.shape === 'panel' && <RoundedBox args={[0.55, h, 0.12]} radius={0.04} castShadow>{mat}{!active && <Edges color="#6b6458" />}</RoundedBox>}
        {look.shape === 'box' && <RoundedBox args={[0.5, h, 0.5]} radius={0.08} castShadow>{mat}{!active && <Edges color="#6b6458" />}</RoundedBox>}
      </group>
      <Html position={[0, h + 0.3, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <span aria-hidden="true" className={active ? 'glyph' : 'glyph warn'}>{active ? look.glyph : `⚠ ${look.glyph}`}</span>
      </Html>
    </group>
  )
}

/** A low platform with a button label (real HTML) and clickable body. Children are positioned relative to its centre. */
export function Platform({ d, x, y, w, h, label, num, hint, selected, target, onPick, children }: {
  d: GameData; x: number; y: number; w: number; h: number; label: string; num: string | number; hint?: string; selected: boolean; target?: boolean; onPick: () => void; children?: ReactNode
}) {
  const [cx, cz] = world(d, x + w / 2, y + h / 2)
  return (
    <group position={[cx, 0, cz]}>
      {(selected || target) && <RoundedBox args={[w + 0.4, 0.1, h + 0.4]} radius={0.1} position={[0, 0.05, 0]}>
        <meshStandardMaterial color={P.ring} transparent={!selected} opacity={selected ? 1 : 0.45} /></RoundedBox>}
      <RoundedBox args={[w, 0.18, h]} radius={0.08} position={[0, 0.09, 0]} castShadow receiveShadow
        onClick={(e) => { e.stopPropagation(); onPick() }}>
        <meshStandardMaterial color={P.wood} roughness={0.8} />
      </RoundedBox>
      {children}
      <Html position={[w > 5 ? 1.5 - w / 2 : 0, 0.9, 0]} center zIndexRange={[10, 0]}>
        <button type="button" className="zlabel" aria-pressed={selected} onClick={onPick}><span aria-hidden="true" className="zn">{num}</span><span className="zname">{label}{hint && <span className="sr"> ({hint})</span>}</span></button>
      </Html>
    </group>
  )
}

/** Route strip: built = solid yellow with ribs, not built = transparent ghost with outline only. */
export function RouteStrip({ d, s, built, onPick }: { d: GameData; s: Segment; built: boolean; onPick: () => void }) {
  const dx = Math.abs(s.x2 - s.x1), dz = Math.abs(s.y2 - s.y1), len = dx + dz
  const horiz = dx > 0
  const [cx, cz] = world(d, (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2)
  const size: [number, number, number] = horiz ? [len + 0.9, 0.06, 0.9] : [0.9, 0.06, len + 0.9]
  const ribs = built ? Math.floor((len + 0.9) / 0.3) : 0
  return (
    <group position={[cx, 0.03, cz]}>
      <mesh receiveShadow onClick={(e) => { e.stopPropagation(); onPick() }}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={P.yellow} transparent={!built} opacity={built ? 1 : 0.2} roughness={0.6} />
        {!built && <Edges color="#7a5c00" />}
      </mesh>
      {Array.from({ length: ribs }, (_, i) => {
        const o = -(len + 0.9) / 2 + 0.15 + i * 0.3
        return (
          <mesh key={i} position={horiz ? [o, 0.04, 0] : [0, 0.04, o]}>
            <boxGeometry args={horiz ? [0.08, 0.04, 0.7] : [0.7, 0.04, 0.08]} />
            <meshStandardMaterial color={P.amber} roughness={0.6} />
          </mesh>
        )
      })}
    </group>
  )
}

export function Wall({ cx, cz, len, horiz, h }: { cx: number; cz: number; len: number; horiz: boolean; h: number }) {
  return (
    <group position={[cx, 0, cz]}>
      <RoundedBox args={horiz ? [len, h, 0.3] : [0.3, h, len]} radius={0.06} position={[0, h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={P.wall} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={horiz ? [len + 0.1, 0.12, 0.42] : [0.42, 0.12, len + 0.1]} radius={0.04} position={[0, h + 0.06, 0]} castShadow>
        <meshStandardMaterial color={P.trim} roughness={0.8} />
      </RoundedBox>
    </group>
  )
}
