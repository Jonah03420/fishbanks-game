import { useState } from 'react'
import StartPage from './pages/StartPage'
import SoloConfigPage from './pages/SoloConfigPage'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'
import EndPage from './pages/EndPage'
import { erstelleStartzustand, erstelleStartzustandAusLobby } from './game/gameState'

function App() {
  const [gameState, setGameState] = useState(null)
  const [phase, setPhase] = useState('start')

  function handleSoloStart(playerName, maxRunden, schwierigkeitsgrad) {
    setGameState(erstelleStartzustand(playerName, maxRunden, schwierigkeitsgrad))
    setPhase('game')
  }

  function handleMultiplayerStart(room, playerIndex) {
    setGameState(erstelleStartzustandAusLobby(room, playerIndex))
    setPhase('game')
  }

  function handleRestart() {
    setGameState(null)
    setPhase('start')
  }

  if (gameState && (gameState.phase === 'ende' || gameState.fischbestand === 0)) {
    return <EndPage gameState={gameState} onRestart={handleRestart} />
  }

  return (
    <div className="w-full h-full">
      {phase === 'start' && (
        <StartPage onSolo={() => setPhase('soloConfig')} onMultiplayer={() => setPhase('lobby')} />
      )}
      {phase === 'soloConfig' && (
        <SoloConfigPage onStart={handleSoloStart} onBack={() => setPhase('start')} />
      )}
      {phase === 'lobby' && (
        <LobbyPage onStart={handleMultiplayerStart} onBack={() => setPhase('start')} />
      )}
      {phase === 'game' && gameState && (
        <GamePage gameState={gameState} setGameState={setGameState} />
      )}
    </div>
  )
}

export default App
