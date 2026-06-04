import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/colors_and_type.css'
import './styles/notemd.css'
import './styles/tracker.css'
import App from './App.jsx'
import PublicPage from './components/PublicPage.jsx'

// A shared-page link (?p=<token>) renders a standalone read-only view,
// skipping auth and the full app shell entirely.
const shareToken = new URLSearchParams(window.location.search).get('p')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {shareToken ? <PublicPage token={shareToken} /> : <App />}
  </StrictMode>,
)
