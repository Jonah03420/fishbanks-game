import { useState } from 'react'
import StartPage from './pages/StartPage'
import GamePage from './pages/GamePage'
import { erstelleStartzustand } from './game/gameState'

function App() {
  const [gameStarted, setGameStarted] = useState(false)
  const [gameState, setGameState] = useState(null)

  function handleStart() {
    setGameState(erstelleStartzustand())
    setGameStarted(true)
  }

  return (
    <div>
      {!gameStarted && (
        <StartPage onStart={handleStart} />
      )}
      {gameStarted && gameState && (
        <GamePage gameState={gameState} setGameState={setGameState} />
      )}
    </div>
  )
}

export default App