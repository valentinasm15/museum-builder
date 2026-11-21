import { Html, RoundedBox } from '@react-three/drei'
import type { Feature, GameData } from '../data/load'
import type { Lang } from '../store'
import { world } from './Pieces'

const C = {
  coral: '#d97a7a', birch: '#d9b27c', back: '#8fc1b8', navy: '#1f3a5a', lift: '#9aa5ab', door: '#6f7a80', stairs: '#c9b58f',
  exit: '#3f8f5a', wc: '#7fa3c9', feedback: '#e08a3a', white: '#ffffff', glass: '#cfe8ee', col: '#2f4f9a', disc: '#245b73',
  car: '#e8a82a', tyre: '#2b2b2b', slat: '#c9a77a', chair: '#b9442f', carpet: '#1f5a6b', thing: ['#2b2b2b', '#cbbf9f', '#8a6a4a', '#e8e1d0'],
}
const Mat = ({ c, o = 1 }: { c: string; o?: number }) => <meshStandardMaterial color={c} roughness={0.8} transparent={o < 1} opacity={o} />
const Box = ({ s, p, c, o }: { s: [number, number, number]; p: [number, number, number]; c: string; o?: number }) => (
  <RoundedBox args={s} radius={0.04} position={p} castShadow receiveShadow><Mat c={c} o={o} /></RoundedBox>
)

/** Rotation that puts a display's back against the wall: the side whose neighbour tile is outside every floor rectangle. */
function wallTurn(d: GameData, f: Feature) {
  const inside = (x: number, y: number) => d.floor.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
  if (f.w >= f.h) return inside(f.x + f.w / 2, f.y - 0.5) ? Math.PI : 0 // north wall : south wall
  return inside(f.x - 0.5, f.y + f.h / 2) ? -Math.PI / 2 : Math.PI / 2 // west wall : east wall
}

function Prop({ f, turn }: { f: Feature; turn: number }) {
  const { w, h } = f
  switch (f.kind) {
    case 'display': {
      // Glass display wall; the back panel sits against the wall (the side with no floor behind it), plinth fronts face the room.
      const len = Math.max(w, h), depth = Math.min(w, h), n = Math.max(1, Math.round(len))
      const at = (o: number, y: number): [number, number, number] => [o, y, depth * 0.05]
      return (
        <group rotation-y={turn}>
          <Box s={[len, 1.8, 0.1]} p={[0, 0.9, -depth / 2 + 0.05]} c={C.back} />
          {Array.from({ length: n }, (_, i) => {
            const o = -len / 2 + (i + 0.5) * (len / n)
            return (
              <group key={i}>
                <Box s={[len / n - 0.04, 0.6, depth * 0.8]} p={at(o, 0.3)} c={i % 2 ? C.birch : C.coral} />
                <Box s={[0.4, 0.22 + (i % 3) * 0.12, 0.35]} p={at(o, 0.72 + (i % 3) * 0.06)} c={C.thing[i % 4]} />
              </group>
            )
          })}
        </group>
      )
    }
    case 'column':
      return (
        <>
          <Box s={[w * 0.9, 0.8, h * 0.9]} p={[0, 0.4, 0]} c={C.navy} />
          <Box s={[w * 0.8, 1.1, h * 0.8]} p={[0, 1.35, 0]} c={C.glass} o={0.35} />
          <mesh position={[0, 1.8, 0]} castShadow><cylinderGeometry args={[0.12, 0.12, 3.6, 16]} /><Mat c={C.col} /></mesh>
        </>
      )
    case 'car':
      return (
        <>
          <mesh position={[0, 0.03, 0]} receiveShadow><cylinderGeometry args={[Math.max(w, h) * 0.75, Math.max(w, h) * 0.75, 0.06, 32]} /><Mat c={C.disc} /></mesh>
          <Box s={[1.5, 0.55, 0.9]} p={[0, 0.5, 0]} c={C.car} />
          <Box s={[0.8, 0.45, 0.85]} p={[-0.1, 0.98, 0]} c={C.car} />
          {[[-0.5, -0.45], [-0.5, 0.45], [0.5, -0.45], [0.5, 0.45]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.2, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.12, 16]} /><Mat c={C.tyre} /></mesh>
          ))}
        </>
      )
    case 'booth':
      return (
        <>
          <Box s={[w, 0.03, h]} p={[0, 0.02, 0]} c={C.carpet} />
          <Box s={[w, 1.7, 0.15]} p={[0, 0.85, -h / 2 + 0.08]} c={C.slat} />
          <Box s={[0.7, 0.4, 0.7]} p={[0, 0.3, 0.1]} c={C.chair} />
          <Box s={[0.7, 0.6, 0.15]} p={[0, 0.7, -0.2]} c={C.chair} />
        </>
      )
    case 'lift':
      return (
        <>
          <Box s={[w, 1.5, h]} p={[0, 0.75, 0]} c={C.lift} />
          <mesh position={[0, 0.7, h / 2 + 0.01]}><boxGeometry args={[w * 0.6, 1.2, 0.03]} /><Mat c={C.door} /></mesh>
        </>
      )
    case 'stairs':
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} s={[w / 4, 0.25 * (i + 1), h]} p={[-w / 2 + (i + 0.5) * (w / 4), (0.25 * (i + 1)) / 2, 0]} c={C.stairs} />
          ))}
        </>
      )
    case 'exit':
      return (
        <>
          <Box s={[w, 1.3, h * 0.3]} p={[0, 0.65, 0]} c={C.exit} />
          <mesh position={[0, 0.5, h * 0.16]}><boxGeometry args={[w * 0.5, 0.9, 0.03]} /><Mat c={C.white} /></mesh>
        </>
      )
    case 'wc':
      return <Box s={[w, 1, h]} p={[0, 0.5, 0]} c={C.wc} />
    default:
      return <Box s={[w * 0.6, 0.9, h * 0.6]} p={[0, 0.45, 0]} c={C.feedback} />
  }
}

/** The universal emergency-exit sign (green square, white figure running through a door). Drawn here so the map needs no image file. */
function ExitSign() {
  return (
    <svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true" style={{ display: 'block', borderRadius: 4 }}>
      <rect width="48" height="48" fill="#0a8f3c" />
      <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M31 9h9v30h-9" />
        <path d="M17 20l3 8-6 9M20 28l6 7M17 20l-6 4M17 20l8 3" />
      </g>
      <circle cx="17" cy="13" r="3.4" fill="#fff" />
    </svg>
  )
}

const NAMED: Feature['kind'][] = ['lift', 'stairs', 'wc', 'exit', 'feedback']

/** One fixed part of the building. Names are always visible (keyboard and touch users cannot hover); exits also show the universal sign. */
function Fixture({ d, lang, f }: { d: GameData; lang: Lang; f: Feature }) {
  const [x, z] = world(d, f.x + f.w / 2, f.y + f.h / 2)
  const name = (lang === 'fi' && f.nameFi) || f.nameEn
  return (
    <group position={[x, 0, z]}>
      <Prop f={f} turn={f.kind === 'display' ? wallTurn(d, f) : 0} />
      {NAMED.includes(f.kind) && (
        <Html position={[0, 1.9, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ position: 'relative' }}>
            {f.kind === 'exit' && <ExitSign />}
            <span className="elabel small" style={{ position: 'absolute', bottom: f.kind === 'exit' ? '100%' : 0, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>{name}</span>
          </div>
        </Html>
      )}
    </group>
  )
}

/** Fixed parts of the real building (lift, stairs, exits, feedback point, exhibit walls). Names come from the Features sheet. */
export default function Props({ d, lang }: { d: GameData; lang: Lang }) {
  return <>{d.features.map((f) => <Fixture key={f.id} d={d} lang={lang} f={f} />)}</>
}
