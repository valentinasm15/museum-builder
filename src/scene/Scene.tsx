import { ContactShadows, Html, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { GameData } from '../data/load'
import { Plan } from '../engine/score'
import { inactiveMap, itemName, t, targetName, useGame } from '../store'
import { P } from './look'
import { wallRuns } from './footprint'
import { ItemBlock, Platform, RouteStrip, Wall, world } from './Pieces'
import Props from './Props'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Rig({ rot, zoom }: { rot: number; zoom: number }) {
  const { camera, size } = useThree()
  const a = useRef(Math.PI / 4 + rot * (Math.PI / 2))
  useFrame((_, dt) => {
    const target = Math.PI / 4 + rot * (Math.PI / 2)
    a.current = reduced() ? target : a.current + (target - a.current) * Math.min(1, dt * 8)
    const r = 40, el = 0.615 // true isometric elevation
    camera.position.set(r * Math.cos(el) * Math.sin(a.current), r * Math.sin(el), r * Math.cos(el) * Math.cos(a.current))
    camera.lookAt(0, 0, 0)
    camera.zoom = Math.min(size.width / 29, size.height / 20) * zoom
    camera.updateProjectionMatrix()
  })
  return null
}

function CanvasLabel({ text }: { text: string }) {
  const el = useThree((s) => s.gl.domElement)
  useEffect(() => { el.setAttribute('role', 'img'); el.setAttribute('aria-label', text) }, [el, text])
  return null
}

function Room3D({ d, rot }: { d: GameData; rot: number }) {
  const { lang, placements, selected, focus, setFocus, place } = useGame()
  const W = d.settings.grid_w, H = d.settings.grid_h
  const plan = useMemo(() => new Plan(d, placements), [d, placements])
  const missing = useMemo(() => inactiveMap(d, placements), [d, placements])
  const picked = selected ? d.items.find((i) => i.id === selected) : undefined
  const itemsAt = (at: string) =>
    [...d.existing.filter((e) => e.zoneId === at).map((e) => e.itemId), ...placements.filter((p) => p.at === at).map((p) => p.item)]
      .map((id) => d.items.find((i) => i.id === id)!)
      .filter((i) => i.scope !== 'path' && i.costEur > 0) // zero-cost existing items are baseline, not objects
  const blocks = (at: string, x: number, y: number, w: number, h: number, w0: [number, number]) => {
    const cols = Math.max(1, Math.floor((w - 0.2) / 0.9))
    return itemsAt(at).map((it, k) => {
      const [px, pz] = world(d, x + 0.6 + (k % cols) * 0.9, y + 0.6 + Math.floor(k / cols) * 0.9)
      return <ItemBlock key={it.id} item={it} active={!missing.has(`${it.id}@${at}`)} pos={[px - w0[0], 0.18, pz - w0[1]]} />
    })
  }
  const a = Math.PI / 4 + rot * (Math.PI / 2)
  const near = (nx: number, nz: number) => nx * Math.sin(a) + nz * Math.cos(a) > 0.01
  const hh = (nx: number, nz: number) => (near(nx, nz) ? 0.3 : 1.7)
  const [ex, ez] = world(d, d.settings.entrance_x, d.settings.entrance_y)
  const walls = useMemo(() => wallRuns(d), [d])
  const lines = useMemo(() => {
    const v: number[] = []
    for (const r of d.floor) {
      for (let i = 0; i <= r.w; i++) v.push(r.x + i - W / 2, 0.01, r.y - H / 2, r.x + i - W / 2, 0.01, r.y + r.h - H / 2)
      for (let j = 0; j <= r.h; j++) v.push(r.x - W / 2, 0.01, r.y + j - H / 2, r.x + r.w - W / 2, 0.01, r.y + j - H / 2)
    }
    return new Float32Array(v)
  }, [d, W, H])
  const vx = d.settings.entrance_x + 2, vy = d.settings.entrance_y - 3.4, vw = W - 1 - vx, vh = 2.4
  const [vcx, vcz] = world(d, vx + vw / 2, vy + vh / 2)

  const pickZone = (id: string) => {
    if (picked?.scope === 'zone' && place(picked.id, id)) setFocus(id)
    else setFocus(focus === id ? null : id)
  }
  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#fff4e0', '#b9895b', 0.6]} />
      <directionalLight position={[-10, 20, 12]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005}
        shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} />
      {d.floor.map((r) => {
        const [cx, cz] = world(d, r.x + r.w / 2, r.y + r.h / 2)
        return (
          <group key={r.id} position={[cx, 0, cz]}>
            <RoundedBox args={[r.w + 0.6, 0.6, r.h + 0.6]} radius={0.15} position={[0, -0.4, 0]} receiveShadow><meshStandardMaterial color={P.base} roughness={0.9} /></RoundedBox>
            <mesh position={[0, -0.05, 0]} receiveShadow><boxGeometry args={[r.w, 0.1, r.h]} /><meshStandardMaterial color={P.floor} roughness={1} /></mesh>
          </group>
        )
      })}
      <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[lines, 3]} /></bufferGeometry><lineBasicMaterial color={P.line} /></lineSegments>
      <ContactShadows position={[0, 0.02, 0]} scale={30} far={2.5} blur={2.4} opacity={0.35} resolution={512} />
      {walls.map((w, i) => {
        const [cx, cz] = w.horiz ? world(d, (w.a + w.b) / 2, w.line) : world(d, w.line, (w.a + w.b) / 2)
        return <Wall key={i} cx={cx} cz={cz} len={w.b - w.a + 0.3} horiz={w.horiz} h={hh(w.nx, w.nz)} />
      })}
      <Props d={d} lang={lang} />
      <Html position={[ex, 0.9, ez + 0.2]} center zIndexRange={[10, 0]}><span className="elabel">{t(d, lang, 'entrance')}</span></Html>

      {d.route.map((s) => (
        <RouteStrip key={s.id} d={d} s={s} built={plan.segmentExists(s.id)}
          onPick={() => { if (picked?.scope === 'path') place(picked.id, s.id) }} />
      ))}
      {d.zones.map((z, n) => (
        <Platform key={z.id} num={n + 1} d={d} x={z.x} y={z.y} w={z.w} h={z.h} selected={focus === z.id} target={picked?.scope === 'zone'} onPick={() => pickZone(z.id)}
          label={targetName(d, lang, z.id)} hint={picked?.scope === 'zone' ? `${t(d, lang, 'place')} ${itemName(lang, picked)}` : undefined}>
          {blocks(z.id, z.x, z.y, z.w, z.h, world(d, z.x + z.w / 2, z.y + z.h / 2))}
        </Platform>
      ))}
      <Platform num="⌂" d={d} x={vx} y={vy} w={vw} h={vh} selected={focus === 'venue'} onPick={() => setFocus(focus === 'venue' ? null : 'venue')}
        label={t(d, lang, 'whole_museum')}>
        {blocks('', vx, vy, vw, vh, [vcx, vcz])}
      </Platform>
    </>
  )
}

export default function Scene({ d }: { d: GameData }) {
  const lang = useGame((s) => s.lang)
  const selected = useGame((s) => s.selected)
  const [rot, setRot] = useState(0)
  const [zoom, setZoom] = useState(1)
  const box = useRef<HTMLDivElement>(null)
  const zoomBy = (f: number) => setZoom((z) => Math.min(2.5, Math.max(0.6, z * f)))
  useEffect(() => {
    const el = box.current
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.001)) }
    el?.addEventListener('wheel', onWheel, { passive: false })
    return () => el?.removeEventListener('wheel', onWheel)
  }, [])
  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'q') setRot((r) => r - 1)
    else if (k === 'e') setRot((r) => r + 1)
    else if (k === '+' || k === '=') zoomBy(1.2)
    else if (k === '-' || k === '_') zoomBy(1 / 1.2)
  }
  const label = t(d, lang, 'scene_label')
  return (
    <div ref={box} className={selected ? 'scene picking' : 'scene'} role="group" aria-label={label} onKeyDown={onKey}>
      <div className="scene-bar">
        <button type="button" onClick={() => setRot((r) => r - 1)} aria-label={t(d, lang, 'rotate_left')}>⟲</button>
        <button type="button" onClick={() => setRot((r) => r + 1)} aria-label={t(d, lang, 'rotate_right')}>⟳</button>
        <button type="button" onClick={() => zoomBy(1.2)} aria-label={t(d, lang, 'zoom_in')}>+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label={t(d, lang, 'zoom_out')}>−</button>
        <span className="hint">{t(d, lang, 'scene_keys')}</span>
      </div>
      <Canvas orthographic shadows camera={{ near: 0.1, far: 200, position: [20, 20, 20] }} dpr={[1, 2]}>
        <CanvasLabel text={label} />
        <Rig rot={rot} zoom={zoom} />
        <Room3D d={d} rot={((rot % 4) + 4) % 4} />
      </Canvas>
    </div>
  )
}
