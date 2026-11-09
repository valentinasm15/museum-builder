import { lazy, Suspense, useEffect, useState } from 'react'
import { t, useGame, type Lang } from './store'
import Brief from './ui/Brief'
import Budget from './ui/Budget'
import Catalogue from './ui/Catalogue'
import Intro from './ui/Intro'
import Logo from './ui/Logo'
import Room from './ui/Room'

const Scene = lazy(() => import('./scene/Scene'))

export default function App() {
  const { data: d, error, lang, setLang } = useGame()
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    document.documentElement.lang = lang
    if (d) document.title = t(d, lang, 'app_title')
  }, [d, lang])

  // Before the workbook loads there are no Texts yet, so these two screens show the loader's own message.
  if (error) return <main id="main"><h1>Museum Builder</h1><p role="alert" className="bad">{error}</p></main>
  if (!d) return <main id="main" aria-busy="true"><h1>Museum Builder</h1></main>

  return (
    <>
      <a className="skip" href="#main">{t(d, lang, 'skip_link')}</a>
      <header className="hud">
        <h1 className="brand">
          <Logo />
          <span>{t(d, lang, 'app_title').split(' ').map((w, i) => <span key={i} className={i ? 'b2' : undefined}>{i ? ' ' : ''}{w}</span>)}</span>
        </h1>
        <Brief d={d} />
        <Budget d={d} />
        <nav className="hud-right">
          <button type="button" onClick={() => setIntro(true)}>{t(d, lang, 'intro_help')}</button>
          <a href="#room-h">{t(d, lang, 'room_view')}</a>
          <div role="group" aria-label={t(d, lang, 'language')} className="lang">
            {(['en', 'fi'] as Lang[]).map((l) => (
              <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </nav>
      </header>
      <Intro d={d} open={intro} onClose={() => setIntro(false)} />
      <main id="main" tabIndex={-1}>
        <div className="play">
          <Suspense fallback={<p>{t(d, lang, 'loading')}</p>}><Scene d={d} /></Suspense>
          <Catalogue d={d} />
        </div>
        <Room d={d} />
      </main>
    </>
  )
}
