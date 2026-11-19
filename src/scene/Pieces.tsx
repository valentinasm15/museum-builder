import { Edges, Html, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import type { GameData, Item, Segment } from '../data/load'
import { lookOf, P, type Shape } from './look'

/** Grid tile (x, y) → world [x, z], floor centred on the origin. */
export const world = (d: GameData, x: number, y: number): [number, number] => [x - d.settings.grid_w / 2, y - d.settings.grid_h / 2]

const HEIGHT: Record<Shape, number> = { box: 0.5, cyl: 0.5, slab: 0.22, panel: 0.6, cone: 0.6 }

/** The symbols of a room's items as one row of real buttons above the room: they never overlap each other or the room name, and keyboard users can reach them. */
export function ItemRow({ y, items }: { y: [number, number]; items: { id: string; glyph: string; active: boolean; label: string; onInspect: () => void }[] }) {
  if (!items.length) return null
  return (
    <Html position={[0, y[0], y[1]]} center zIndexRange={[40, 30]}>
      <div className="itemrow">
        {items.map((i) => (
          <button key={i.id} type="button" className={i.active ? 'glyph' : 'glyph warn'} aria-label={i.label} title={i.label} onClick={(e) => { e.stopPropagation(); i.onInspect() }}>
            <span aria-hidden="true">{i.active ? i.glyph : `⚠ ${i.glyph}`}</span>
          </button>
        ))}
      </div>
    </Html>
  )
}

/** A placed item on the map. Click it to read what it needs (the card lives outside the scene). */
export function ItemBlock({ item, pos, active, inspected, onInspect }: { item: Item; pos: [number, number, number]; active: boolean; inspected: boolean; onInspect: () => void }) {
  const look = lookOf(item)
  const h = HEIGHT[look.shape]
  const mat = <meshStandardMaterial color={active ? look.color : P.dim} transparent={!active} opacity={active ? 1 : 0.5} roughness={0.7} emissive={inspected ? '#f2c230' : '#000000'} emissiveIntensity={inspected ? 0.6 : 0} />
  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onInspect() }}>
      <group position={[0, h / 2, 0]}>
        {look.shape === 'cyl' && <mesh castShadow><cylinderGeometry args={[0.26, 0.26, h, 24]} />{mat}{!active && <Edges color="#6b6458" />}</mesh>}
        {look.shape === 'cone' && <mesh castShadow><coneGeometry args={[0.28, h, 24]} />{mat}{!active && <Edges color="#6b6458" />}</mesh>}
        {look.shape === 'slab' && <RoundedBox args={[0.7, h, 0.45]} radius={0.06} castShadow>{mat}{!active && <Edges color="#6b6458" />}</RoundedBox>}
        {look.shape === 'panel' && <RoundedBox args={[0.55, h, 0.12]} radius={0.04} castShadow>{mat}{!active && <Edges color="#6b6458" />}</RoundedBox>}
        {look.shape === 'box' && <RoundedBox args={[0.5, h, 0.5]} radius={0.08} castShadow>{mat}{!active && <Edges color="#6b6458" />}</RoundedBox>}
      </group>
    </group>
  )
}

/** A low platform with a button label (real HTML) and clickable body. Children are positioned relative to its centre. */
export function Platform({ d, x, y, w, h, label, num, hint, mark, selected, target, onPick, children }: {
  d: GameData; x: number; y: number; w: number; h: number; label: string; num: string | number; hint?: string; mark?: { icon: string; text: string }; selected: boolean; target?: boolean; onPick: () => void; children?: ReactNode
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
      <Html position={[w / 2 - 0.2, 0.9, h / 2 + 0.55]} center zIndexRange={[10, 0]}> {/* just outside the platform edge, so it never covers the items */}
        <button type="button" className="zlabel" aria-pressed={selected} onClick={onPick}><span aria-hidden="true" className="zn">{num}</span>{mark && <span aria-hidden="true" className="zmark">{mark.icon}</span>}<span className="zname">{label}{hint && <span className="sr"> ({hint})</span>}{mark && <span className="sr"> ({mark.text})</span>}</span></button>
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

/** The visitor: a simple figure that walks along the route to each stop at a steady pace (it jumps when reduced motion is on). A red ring marks where the route breaks. */
export function Walker({ d, path, barrier }: { d: GameData; path: [number, number][]; barrier?: [number, number] }) {
  const ref = useRef<Group>(null), s = useRef(0), placed = useRef(false)
  const body = useRef<Group>(null), legL = useRef<Group>(null), legR = useRef<Group>(null), armL = useRef<Group>(null), armR = useRef<Group>(null)
  const last = useRef<[number, number] | null>(null), heading = useRef(0), swing = useRef(0), phase = useRef(0)
  const pts = useMemo(() => path.map(([x, y]) => world(d, x, y)), [d, path])
  const cum = useMemo(() => pts.reduce<number[]>((a, p, i) => [...a, i ? a[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0], []), [pts])
  const total = cum[cum.length - 1] ?? 0
  const pointAt = (dist: number): [number, number] => {
    for (let i = 1; i < pts.length; i++) if (dist <= cum[i] || i === pts.length - 1) {
      const t = cum[i] > cum[i - 1] ? Math.min(1, Math.max(0, (dist - cum[i - 1]) / (cum[i] - cum[i - 1]))) : 1
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
    }
    return pts[0]
  }
  // New stop = new route: keep the visitor where they stand by finding the nearest point on it, then walk from there.
  useEffect(() => {
    const g = ref.current
    if (!g || !placed.current) { s.current = 0; return }
    let best = Infinity
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = cum[i] - cum[i - 1] || 1
      const t = Math.min(1, Math.max(0, ((g.position.x - ax) * (bx - ax) + (g.position.z - az) * (bz - az)) / (len * len)))
      const dd = Math.hypot(g.position.x - (ax + (bx - ax) * t), g.position.z - (az + (bz - az) * t))
      if (dd < best) { best = dd; s.current = cum[i - 1] + t * len }
    }
  }, [pts, cum])
  useFrame((state, dt) => {
    const g = ref.current
    if (!g || !pts.length) return
    const calm = document.documentElement.dataset.motion === 'reduce'
    if (!placed.current || calm) { s.current = total; placed.current = true } else s.current += Math.max(-4.5 * dt, Math.min(4.5 * dt, total - s.current))
    const [x, z] = pointAt(s.current), walking = Math.abs(total - s.current) > 0.01
    // Face the way they walk, swing legs and arms in opposition while walking, settle back to standing when they stop.
    const prev = last.current
    if (prev && walking && Math.hypot(x - prev[0], z - prev[1]) > 1e-5) heading.current = Math.atan2(x - prev[0], z - prev[1])
    last.current = [x, z]
    const k = Math.min(1, dt * 10)
    swing.current += ((walking && !calm ? 1 : 0) - swing.current) * k
    phase.current += dt * 9 * swing.current
    const a = Math.sin(phase.current) * 0.7 * swing.current
    g.position.set(x, Math.abs(Math.cos(phase.current)) * 0.06 * swing.current, z)
    if (body.current) body.current.rotation.y += Math.atan2(Math.sin(heading.current - body.current.rotation.y), Math.cos(heading.current - body.current.rotation.y)) * Math.min(1, dt * 12)
    if (legL.current && legR.current && armL.current && armR.current) { legL.current.rotation.x = a; legR.current.rotation.x = -a; armL.current.rotation.x = -a * 0.8; armR.current.rotation.x = a * 0.8 }
  })
  const [bx, bz] = barrier ? world(d, barrier[0], barrier[1]) : [0, 0]
  return (
    <>
      <group ref={ref}>
        <group ref={body} scale={1.3}>
          {/* legs and arms hang from pivots at hip and shoulder so they can swing */}
          <group ref={legL} position={[-0.1, 0.6, 0]}>
            <mesh position={[0, -0.28, 0]} castShadow><capsuleGeometry args={[0.085, 0.38, 4, 10]} /><meshStandardMaterial color="#2f3e5c" /></mesh>
            <mesh position={[0, -0.57, 0.05]} castShadow><boxGeometry args={[0.15, 0.08, 0.26]} /><meshStandardMaterial color="#222" /></mesh>
          </group>
          <group ref={legR} position={[0.1, 0.6, 0]}>
            <mesh position={[0, -0.28, 0]} castShadow><capsuleGeometry args={[0.085, 0.38, 4, 10]} /><meshStandardMaterial color="#2f3e5c" /></mesh>
            <mesh position={[0, -0.57, 0.05]} castShadow><boxGeometry args={[0.15, 0.08, 0.26]} /><meshStandardMaterial color="#222" /></mesh>
          </group>
          <RoundedBox args={[0.36, 0.5, 0.2]} radius={0.08} position={[0, 0.85, 0]} castShadow><meshStandardMaterial color="#2b6cb0" /></RoundedBox>
          <group ref={armL} position={[-0.25, 1.05, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow><capsuleGeometry args={[0.065, 0.3, 4, 10]} /><meshStandardMaterial color="#2b6cb0" /></mesh>
            <mesh position={[0, -0.4, 0]} castShadow><sphereGeometry args={[0.06, 10, 10]} /><meshStandardMaterial color="#f1c9a5" /></mesh>
          </group>
          <group ref={armR} position={[0.25, 1.05, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow><capsuleGeometry args={[0.065, 0.3, 4, 10]} /><meshStandardMaterial color="#2b6cb0" /></mesh>
            <mesh position={[0, -0.4, 0]} castShadow><sphereGeometry args={[0.06, 10, 10]} /><meshStandardMaterial color="#f1c9a5" /></mesh>
          </group>
          <mesh position={[0, 1.16, 0]} castShadow><cylinderGeometry args={[0.06, 0.07, 0.1, 10]} /><meshStandardMaterial color="#f1c9a5" /></mesh>
          <mesh position={[0, 1.32, 0]} castShadow><sphereGeometry args={[0.17, 20, 20]} /><meshStandardMaterial color="#f1c9a5" /></mesh>
          {/* hair: a cap over the top and back of the head */}
          <mesh position={[0, 1.37, -0.03]} scale={[1, 0.85, 1.02]} castShadow><sphereGeometry args={[0.19, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} /><meshStandardMaterial color="#4a2f1b" /></mesh>
          <mesh position={[0, 1.27, -0.1]} castShadow><sphereGeometry args={[0.14, 14, 14]} /><meshStandardMaterial color="#4a2f1b" /></mesh>
          {/* two eyes show which way they face */}
          <mesh position={[-0.06, 1.33, 0.155]}><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
          <mesh position={[0.06, 1.33, 0.155]}><sphereGeometry args={[0.02, 8, 8]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
        </group>
      </group>
      {barrier && (
        <group position={[bx, 0.1, bz]}>
          <mesh rotation-x={-Math.PI / 2}><ringGeometry args={[0.55, 0.8, 32]} /><meshBasicMaterial color="#a3001b" /></mesh>
          <Html position={[0, 0.9, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}><span aria-hidden="true" className="elabel bad">✕</span></Html>
        </group>
      )}
    </>
  )
}
