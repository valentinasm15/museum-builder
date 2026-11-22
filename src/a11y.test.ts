import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import { P } from './scene/look'

// WCAG 2.2 A/AA audit of the running UI with axe-core (incl. colour contrast). Needs Playwright + Chromium; skipped when absent.
type Page = { goto(u: string): Promise<unknown>; waitForTimeout(ms: number): Promise<void>; addScriptTag(o: { content: string }): Promise<unknown>; evaluate<T>(f: string): Promise<T>; getByRole(r: string, o: { name: string | RegExp }): { first(): { click(): Promise<void> }; last(): { click(): Promise<void> }; click(): Promise<void> } }
type Browser = { newPage(o: object): Promise<Page>; close(): Promise<void> }
let pw: { chromium: { launch(): Promise<Browser> } } | null = null
try { pw = createRequire(import.meta.url)('playwright') } catch { /* not installed */ }

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
type Result = { violations: { id: string; help: string; nodes: { target: string[] }[] }[] }

const lum = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0)
const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

// 1.4.11: the selection ring and the platforms it sits on must differ from the floor by 3:1.
it('map: selection ring and platforms contrast with the floor (3:1)', () => {
  expect(ratio(P.ring, P.floor)).toBeGreaterThanOrEqual(3)
  expect(ratio(P.wood, P.floor)).toBeGreaterThanOrEqual(3)
})

// 1.4.3 fallback for text axe cannot resolve (icon glyphs, text over overlapping layers): composite ancestor backgrounds ourselves.
// Returns failing text; text on a background image or gradient is returned too, as it cannot be verified.
const SCAN = `(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r, g, b, a } }
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const lum = ({ r, g, b }) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  const over = (t, d) => ({ r: t.r * t.a + d.r * (1 - t.a), g: t.g * t.a + d.g * (1 - t.a), b: t.b * t.a + d.b * (1 - t.a), a: 1 })
  const out = [], seen = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n; (n = w.nextNode());) {
    const el = n.parentElement
    if (!n.textContent.trim() || seen.has(el)) continue
    seen.add(el)
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || !el.getClientRects().length || el.closest('.sr')) continue
    const chain = []; let img = false
    for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none') img = true; const c = parse(s.backgroundColor); if (c && c.a > 0) { chain.push(c); if (c.a >= 1) break } }
    let bg = { r: 255, g: 255, b: 255, a: 1 }; for (const c of chain.reverse()) bg = over(c, bg)
    const fg0 = parse(cs.color), fg = over({ ...fg0, a: fg0.a * (parseFloat(cs.opacity) || 1) }, bg)
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a), ratio = (hi + 0.05) / (lo + 0.05)
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700)
    if (img) out.push('unverifiable (background image): ' + n.textContent.trim().slice(0, 30))
    else if (ratio < (large ? 3 : 4.5)) out.push(ratio.toFixed(2) + ':1 "' + n.textContent.trim().slice(0, 30) + '"')
  }
  return out
})()`

describe.skipIf(!pw)('WCAG 2.2 AA (axe-core)', () => {
  let server: ViteDevServer, browser: Browser, page: Page
  beforeAll(async () => {
    server = await createServer({ logLevel: 'silent', server: { port: 0, host: '127.0.0.1' } })
    await server.listen()
    browser = await pw!.chromium.launch()
    page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
    await page.goto(server.resolvedUrls!.local[0])
    await page.waitForTimeout(3000)
  })
  afterAll(async () => { await browser?.close(); await server?.close() })

  const audit = async (): Promise<Result> => {
    await page.addScriptTag({ content: AXE })
    return page.evaluate<Result>(`axe.run(document, { runOnly: ${JSON.stringify(TAGS)} })`)
  }
  const clean = (r: Result) => r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' ; ')}`)
  const btn = (name: string | RegExp) => page.getByRole('button', { name })

  const screens: [string, () => Promise<void>][] = [
    ['intro tour', async () => {}],
    ['planning view', async () => { await btn('Skip tour').click(); await page.waitForTimeout(400) }],
    ['text view of the room', async () => { await btn('Text view of the room').click(); await page.waitForTimeout(400) }],
    ['walkthrough', async () => { await btn('Launch exhibition').first().click(); await btn('Launch exhibition').last().click(); await page.waitForTimeout(1500) }],
    ['debrief', async () => { await btn('Skip walkthrough').click(); await btn('See the summary').click(); await page.waitForTimeout(2500) }],
  ]
  for (const [name, go] of screens) {
    it(`${name}: no axe violations, all text meets contrast`, async () => {
      await go()
      const r = await audit()
      expect(clean(r)).toEqual([])
      expect(await page.evaluate<string[]>(SCAN), 'text below WCAG contrast or unverifiable').toEqual([])
    })
  }
})
