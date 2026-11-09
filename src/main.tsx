import { createRoot } from 'react-dom/client'
import App from './App'
import { loadData } from './data/load'
import xlsxUrl from './data/museum-builder-data.xlsx?url'
import { useGame } from './store'

fetch(xlsxUrl)
  .then((r) => { if (!r.ok) throw new Error(`Data workbook: HTTP ${r.status} loading ${xlsxUrl}`); return r.arrayBuffer() })
  .then((buf) => useGame.getState().init(loadData(new Uint8Array(buf))))
  .catch((e: unknown) => useGame.getState().fail(e instanceof Error ? e.message : String(e)))

createRoot(document.getElementById('root')!).render(<App />)
