import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/styles/tokens.css'
import './shared/styles/shell.css'
import './shared/styles/auth.css'
import './shared/styles/notebooks.css'
import './shared/styles/tracker.css'
import './shared/styles/home.css'
import './shared/styles/radio.css'
import './shared/styles/responsive.css'
import App from './App.jsx'
import PublicPage from './features/notebooks/PublicPage.jsx'
import { installExternalLinkHandler } from './shared/lib/openExternal.js'

installExternalLinkHandler()

// A shared-page link (?p=<token>) renders a standalone read-only view,
// skipping auth and the full app shell entirely.
const shareToken = new URLSearchParams(window.location.search).get('p')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {shareToken ? <PublicPage token={shareToken} /> : <App />}
  </StrictMode>,
)
