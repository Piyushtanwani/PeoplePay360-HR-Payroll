import React from 'react'
import ReactDOM from 'react-dom/client'
import './design/tokens.css'
import { AppRoot } from './app/AppRoot'

// The app always talks to the real backend. The request fixtures that used to run in the browser now
// live under src/test and serve the component tests, where a stub cannot drift out of sight.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
)
