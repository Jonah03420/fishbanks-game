import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function applyViewportScale() {
  const scale = Math.min(1, window.innerWidth / 1280)
  document.documentElement.style.zoom = String(scale)
}
applyViewportScale()
window.addEventListener('resize', applyViewportScale)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
