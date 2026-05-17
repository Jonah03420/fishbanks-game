import { useState } from 'react'
import StartPage from './pages/StartPage'
import GamePage from './pages/GamePage'
import EndPage from './pages/EndPage'
import { erstelleStartzustand } from './game/gameState'

function App() {
  const [gameState, setGameState] = useState(null)
  const [phase, setPhase] = useState('start')

  function handleStart(playerName, maxRunden) {
    setGameState(erstelleStartzustand(playerName, maxRunden))
    setPhase('game')
  }

  function handleRestart() {
    setGameState(null)
    setPhase('start')
  }

  // Spielende prüfen
  if (gameState && (gameState.phase === 'ende' || gameState.fischbestand === 0)) {
    return <EndPage gameState={gameState} onRestart={handleRestart} />
  }

  return (
    <div>
      {phase === 'start' && <StartPage onStart={handleStart} />}
      {phase === 'game' && gameState && (
        <GamePage gameState={gameState} setGameState={setGameState} />
      )}
    </div>
  )
}

export default App