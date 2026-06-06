import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function applyViewportScale() {
  const threshold = 1440
  const vw = window.innerWidth
  const root = document.getElementById('root')
  if (vw >= threshold) {
    root.style.cssText = ''
    document.body.style.cssText = ''
    return
  }
  const scale = vw / threshold
  const vh = window.innerHeight
  root.style.width = threshold + 'px'
  root.style.height = Math.ceil(vh / scale) + 'px'
  root.style.transform = 'scale(' + scale + ')'
  root.style.transformOrigin = 'top left'
  document.body.style.width = vw + 'px'
  document.body.style.height = vh + 'px'
  document.body.style.overflow = 'hidden'
}
applyViewportScale()
window.addEventListener('resize', applyViewportScale)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
