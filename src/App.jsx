import { useState } from 'react'
import StartPage from './pages/StartPage'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'
import EndPage from './pages/EndPage'
import { erstelleStartzustandAusLobby } from './game/gameState'

function App() {
  const [gameState, setGameState] = useState(null)
  const [phase, setPhase] = useState('start')
  const [lobbyView, setLobbyView] = useState('create')

  function handleGameStart(room, playerIndex) {
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
        <StartPage
          onCreateGame={() => { setLobbyView('create'); setPhase('lobby') }}
          onJoinGame={() => { setLobbyView('join'); setPhase('lobby') }}
        />
      )}
      {phase === 'lobby' && (
        <LobbyPage
          initialView={lobbyView}
          onStart={handleGameStart}
          onBack={() => setPhase('start')}
        />
      )}
      {phase === 'game' && gameState && (
        <GamePage gameState={gameState} setGameState={setGameState} />
      )}
    </div>
  )
}

export default App
