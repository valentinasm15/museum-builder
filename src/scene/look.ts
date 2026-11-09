import type { Item } from '../data/load'

export const P = {
  floor: '#cfc6b8', line: '#b9ae9d', base: '#5c4a3a', wall: '#d8cbb5', trim: '#d98f94', wood: '#2f6f85', ring: '#f5f0e6',
  yellow: '#f2c230', amber: '#d9a21b', blue: '#7fb0e8', green: '#5f9b6e', plum: '#9a6aa8', neutral: '#a79a8a', dim: '#b8b2a8',
}

// Shape + colour + icon per channel, so meaning is never colour alone. Yellow stays with tactile/wayfinding.
export type Shape = 'box' | 'cyl' | 'slab' | 'panel' | 'cone'
const LOOK: Record<string, { color: string; glyph: string; shape: Shape }> = {
  audio: { color: P.blue, glyph: '♪', shape: 'cyl' },
  braille: { color: P.amber, glyph: '⠿', shape: 'slab' },
  tactile: { color: P.yellow, glyph: '▦', shape: 'box' },
  visual_enhanced: { color: P.green, glyph: 'Aa', shape: 'panel' },
  visual: { color: P.green, glyph: '◉', shape: 'panel' },
  human: { color: P.plum, glyph: '☺', shape: 'cone' },
}
const FALLBACK = { color: P.neutral, glyph: '◼', shape: 'box' as Shape }

export const channelKey = (item: Item) => item.channel.replace(/[\s-]/g, '_')
export const lookOf = (item: Item) => LOOK[channelKey(item)] ?? FALLBACK
