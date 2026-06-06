import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function applyViewportScale() {
  const designW = 1280
  const vw = window.innerWidth
  const scale = Math.min(vw / designW, 1)
  const root = document.getElementById('root')
  if (scale < 0.99) {
    const vh = window.innerHeight
    root.style.width = designW + 'px'
    root.style.height = Math.ceil(vh / scale) + 'px'
    root.style.transform = 'scale(' + scale + ')'
    root.style.transformOrigin = 'top left'
    document.body.style.width = vw + 'px'
    document.body.style.height = vh + 'px'
    document.body.style.overflow = 'hidden'
  } else {
    root.style.cssText = ''
    document.body.style.cssText = ''
  }
}
applyViewportScale()
window.addEventListener('resize', applyViewportScale)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
