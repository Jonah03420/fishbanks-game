import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function applyViewportScale() {
  const designW = 1920
  const vw = window.innerWidth
  const vh = window.innerHeight
  const root = document.getElementById('root')
  if (vw >= designW) {
    root.style.cssText = ''
    document.body.style.cssText = ''
    return
  }
  const scale = vw / designW
  root.style.width = designW + 'px'
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
