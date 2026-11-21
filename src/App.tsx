import { installClickCues } from './ui/sound'
import { lazy, Suspense, useEffect, useState } from 'react'
import { t, useGame, type Lang } from './store'
import A11yMenu from './ui/A11yMenu'
import Budget from './ui/Budget'
import Debrief from './ui/Debrief'
import Catalogue from './ui/Catalogue'
import Intro from './ui/Intro'
import Launch from './ui/Launch'
import Menu from './ui/Menu'
import Loader from './ui/Loader'
import Logo from './ui/Logo'
import Visit from './ui/Visit'

const sceneChunk = import('./scene/Scene') // start fetching the 3D code at once, so the loader covers it too
const Scene = lazy(() => sceneChunk)

export default function App() {
  const { data: d, error, lang, setLang, phase } = useGame()
  const [intro, setIntro] = useState(true), [launch, setLaunch] = useState(false)
  const [sceneReady, setSceneReady] = useState(false), [loaded, setLoaded] = useState(false)
  useEffect(() => { sceneChunk.then(() => setSceneReady(true), () => setSceneReady(true)) }, [])
  useEffect(() => {
    document.documentElement.lang = lang
    if (d) document.title = t(d, lang, 'app_title')
  }, [d, lang])
  useEffect(() => installClickCues(() => useGame.getState().sound), [])

  // Before the workbook loads there are no Texts yet, so the loading screen has no text of its own beyond a hidden status.
  if (error) return <main id="main"><h1>Museum Builder</h1><p role="alert" className="bad">{error}</p></main>
  if (!d || !loaded) return <Loader done={!!d && sceneReady} onFinished={() => setLoaded(true)} />

  return (
    <>
      <a className="skip" href="#main">{t(d, lang, 'skip_link')}</a>
      <header className="hud">
        <h1 className="brand">
          <Logo />
          <span>{t(d, lang, 'app_title').split(' ').map((w, i) => <span key={i} className={i ? 'b2' : undefined}>{i ? ' ' : ''}{w}</span>)}</span>
        </h1>
        <Budget d={d} />
        <nav className="hud-right">
          <button type="button" className="submit" onClick={() => setLaunch(true)}>{t(d, lang, 'open_museum')}</button>
          <button type="button" className="icon" aria-label={t(d, lang, 'intro_help')} title={t(d, lang, 'intro_help')} onClick={() => setIntro(true)}><span aria-hidden="true" className="q">?</span></button>
          <A11yMenu d={d} />
          <Menu id="lang-panel" label={t(d, lang, 'language')} icon={<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><ellipse cx="12" cy="12" rx="4.2" ry="10" /><path d="M2 12h20M3.5 7h17M3.5 17h17" /></svg>}>
            {(close) => (
              <div className="lang">
                {(['en', 'fi'] as Lang[]).map((l) => (
                  <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => { setLang(l); close() }}>{l === 'en' ? 'English' : 'Suomi'}</button>
                ))}
              </div>
            )}
          </Menu>
        </nav>
      </header>
      <Intro d={d} open={intro} onClose={() => setIntro(false)} />
      <Launch d={d} open={launch} onClose={() => setLaunch(false)} />
      {phase === 'visiting' && <Visit d={d} />}
      {phase === 'debrief' && <Debrief d={d} onRestart={() => setIntro(true)} />}
      <main id="main" tabIndex={-1}>
        <div className="play">
          <Suspense fallback={<p>{t(d, lang, 'loading')}</p>}><Scene d={d} /></Suspense>
          <Catalogue d={d} />
        </div>
      </main>
    </>
  )
}
