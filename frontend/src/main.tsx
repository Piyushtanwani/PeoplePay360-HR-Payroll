import React from 'react'
import ReactDOM from 'react-dom/client'
import './design/tokens.css'
import { AppRoot } from './app/AppRoot'

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS !== 'false') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppRoot />
    </React.StrictMode>,
  )
}

void bootstrap()
